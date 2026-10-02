import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sliceBetween = (text,start,end) => {
  const a=text.indexOf(start), b=text.indexOf(end,a);
  assert.ok(a>=0,`Missing start: ${start}`);
  assert.ok(b>a,`Missing end: ${end}`);
  return text.slice(a,b);
};
const baseHelpers = {
  normalizeHumanText(value,max=120){ return String(value??"").trim().replace(/\s+/g," ").slice(0,max); },
  validReasonableMoney(value){ const n=Number(value); return Number.isFinite(n)&&n>=0&&n<=1e9; },
  showToast(){},
  formatCurrency(value){ return "₱"+Number(value||0).toFixed(2); },
};

test("legacy package inclusions repair before unrelated service price edits", async()=>{
  const html=await read("index.html");
  const source=sliceBetween(html,"function packageDescriptionInclusions","async function commitCatalogMutation");
  const state={
    catalogCategories:["TV Broadcast Graphics"],
    soloServices:[
      {product_code:"SRV-001",name:"STUDIO",category:"TV Broadcast Graphics",price:3000},
      {product_code:"SRV-004",name:"STINGER",category:"TV Broadcast Graphics",price:800},
    ],
    packagesList:[{
      product_code:"PKG-001",name:"BRONZE BROADCAST PACKAGE",category:"TV Broadcast Graphics",
      description:"Includes:\n• STUDIO\n• STINGER",originalPrice:3800,sellingPrice:3500,includedServiceNames:[]
    }]
  };
  const ctx={...baseHelpers,state}; vm.createContext(ctx); vm.runInContext(source,ctx);
  assert.equal(ctx.validateCatalogState(),"");
  assert.deepEqual([...state.packagesList[0].includedServiceNames],["STUDIO","STINGER"]);
  assert.equal(state.packagesList[0].description,"");
  state.soloServices.find(s=>s.product_code==="SRV-004").price=950;
  assert.equal(ctx.validateCatalogState(),"","service price edit must not be blocked by repaired package state");
});

test("sample service can be added and defaults active", async()=>{
  const html=await read("index.html");
  const source=sliceBetween(html,"async function saveCatalogService","function renderPackageServiceChoices");
  const fields={
    catalogServiceCode:{value:""},
    catalogServiceName:{value:"SAMPLE SERVICE"},
    catalogServiceCategory:{value:"TV Broadcast Graphics"},
    catalogServiceDescription:{value:"MP4"},
    catalogServicePrice:{value:"1234"},
    catalogServiceActive:{value:"false"},
  };
  const state={catalogCategories:["TV Broadcast Graphics"],soloServices:[],packagesList:[]};
  const ctx={
    ...baseHelpers,state,
    document:{getElementById:id=>fields[id]||null},
    commitCatalogMutation:async(mutator)=>{mutator();return true;}
  };
  vm.createContext(ctx); vm.runInContext(source,ctx);
  await ctx.saveCatalogService();
  assert.equal(state.soloServices.length,1);
  assert.equal(state.soloServices[0].name,"SAMPLE SERVICE");
  assert.equal(state.soloServices[0].price,1234);
  assert.equal(state.soloServices[0].active,true);
});

test("sample service deletion removes package references and recalculates total", async()=>{
  const html=await read("index.html");
  const source=sliceBetween(html,"function deleteCatalogService","function deleteCatalogPackage");
  const state={
    soloServices:[
      {product_code:"SRV-001",name:"STUDIO",price:3000},
      {product_code:"SRV-999",name:"SAMPLE SERVICE",price:1234},
    ],
    packagesList:[{
      product_code:"PKG-999",name:"SAMPLE PACKAGE",sellingPrice:3000,originalPrice:4234,
      includedServiceNames:["STUDIO","SAMPLE SERVICE"]
    }]
  };
  const ctx={
    ...baseHelpers,state,
    document:{getElementById:id=>id==="catalogServiceCode"?{value:"SRV-999"}:null},
    requestDestructivePin(_title,_message,callback){ return callback(); },
    commitCatalogMutation:async(mutator)=>{mutator();return true;}
  };
  vm.createContext(ctx); vm.runInContext(source,ctx);
  await ctx.deleteCatalogService();
  assert.deepEqual(state.soloServices.map(s=>s.name),["STUDIO"]);
  assert.deepEqual(state.packagesList[0].includedServiceNames,["STUDIO"]);
  assert.equal(state.packagesList[0].originalPrice,3000);
});

test("master cleanup UI rules are wired", async()=>{
  const html=await read("index.html");
  const css=await read("css/master-cleanup-2026-10-02.css");
  const unification=await read("js/workspace-unification-2026-09-22.js");
  const online=await read("../online/js/app.js");
  assert.match(html,/Manage services, packages, and pricing shared with JUAN PROJECT Online/);
  assert.match(html,/\+ New ▾/);
  assert.doesNotMatch(html,/Search services, packages, descriptions, or inclusions/);
  assert.match(unification,/data-catalog-panel="all" class="active">All</);
  assert.match(unification,/data-catalog-panel="services">Services</);
  assert.doesNotMatch(unification,/>Solo Services</);
  assert.match(css,/project-details-tabs \.tab-btn\.active::after/);
  assert.match(css,/deliverable-group-block\.collapsed \.deliverable-package-children/);
  assert.match(css,/jp-payment-activity-scroll/);
  assert.match(online,/<h2>Services<\/h2>/);
  assert.doesNotMatch(online,/x\.description\?'<p>'\+esc\(x\.description\)/);
});
