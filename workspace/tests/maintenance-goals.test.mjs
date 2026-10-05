import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const sliceBetween=(text,start,end)=>{
  const a=text.indexOf(start),b=text.indexOf(end,a);
  assert.ok(a>=0,`Missing start marker: ${start}`);
  assert.ok(b>a,`Missing end marker: ${end}`);
  return text.slice(a,b);
};

test("Workspace maintenance layer covers unified toolbar, Home, Catalog, Reports and auth",async()=>{
  const [html,css,js]=await Promise.all([
    read("index.html"),
    read("css/maintenance-2026-10-06.css"),
    read("js/maintenance-2026-10-06.js")
  ]);
  assert.match(html,/maintenance-2026-10-06\.css/);
  assert.match(html,/maintenance-2026-10-06\.js/);
  assert.match(html,/id="catalogTypeSelect"/);
  assert.match(html,/Type: All/);
  assert.match(html,/Sort: Default/);
  assert.match(css,/overview-priority-grid/);
  assert.match(css,/height:auto!important/);
  assert.match(css,/quick-actions-fab/);
  assert.match(css,/background:#1d1d1f!important/);
  assert.match(css,/jp-payment-toolbar/);
  assert.match(css,/catalogServiceModal/);
  assert.match(css,/project-details-tabs/);
  assert.match(js,/app\.connectDatabaseManually=async/);
  assert.match(js,/workspaceAuthGate/);
  assert.match(js,/Save Changes/);
  assert.match(js,/Category: All/);
  assert.match(js,/Method: All/);
  assert.match(js,/pricing/i,{});
});

test("public pricing cards are synchronized, collapsible and Platinum is recommended",async()=>{
  const online=await read("../online/js/app.js");
  const source=sliceBetween(online,"function packageInclusions","function priceListServiceRow");
  const ctx={
    state:{
      pricingInclusionsExpanded:false,
      catalog:{
        services:[
          {id:"s1",name:"STUDIO"},
          {id:"s2",name:"LOWER THIRDS"}
        ],
        packageItems:[
          {package_id:"p1",service_id:"s1",sort_order:1},
          {package_id:"p1",service_id:"s2",sort_order:2}
        ]
      }
    },
    esc:v=>String(v),
    peso:v=>"₱"+Number(v).toFixed(2)
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  const pkg={id:"p1",name:"PLATINUM BROADCAST PACKAGE",new_price:10999,original_price:14400};
  const collapsed=ctx.priceListPackageCard(pkg);
  assert.match(collapsed,/RECOMMENDED/);
  assert.match(collapsed,/2 INCLUDED SERVICES/);
  assert.match(collapsed,/2 SERVICES INCLUDED/);
  assert.doesNotMatch(collapsed,/<ul>/);
  ctx.state.pricingInclusionsExpanded=true;
  const expanded=ctx.priceListPackageCard(pkg);
  assert.match(expanded,/<ul>/);
  assert.match(expanded,/STUDIO/);
  assert.match(expanded,/LOWER THIRDS/);
});

test("public pricing contains navigation, legal copy, responsive SaaS layout and no solo-services wording",async()=>{
  const [online,css,pricing]=await Promise.all([
    read("../online/js/app.js"),
    read("../online/css/pricing-saas-2026-10-06.css"),
    read("../online/pricing.html")
  ]);
  assert.match(pricing,/pricing-saas-2026-10-06\.css/);
  assert.match(online,/SERVICES &amp; PACKAGES/);
  assert.match(online,/ABOUT/);
  assert.match(online,/CONTACT/);
  assert.match(online,/TERMS OF SERVICE/);
  assert.match(online,/LAST UPDATED: OCTOBER 2026/);
  assert.match(online,/subject to change without prior notice/);
  assert.doesNotMatch(online,/Browse current packages and solo services/);
  assert.match(css,/width:60%/);
  assert.match(css,/grid-template-columns:repeat\(4/);
  assert.match(css,/grid-template-columns:repeat\(2/);
  assert.match(css,/grid-template-columns:1fr!important/);
  assert.match(css,/is-recommended/);
  assert.match(css,/align-items:stretch/);
});

test("catalog create/edit/delete regression suite remains present",async()=>{
  const testSource=await read("tests/master-cleanup.test.mjs");
  assert.match(testSource,/sample service can be added/);
  assert.match(testSource,/sample service deletion removes package references/);
  assert.match(testSource,/legacy package inclusions repair before unrelated service price edits/);
});
