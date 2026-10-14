/* JUAN PROJECT Workspace — October 13, 2026 UI system */
(function(){
  "use strict";
  const VIEW_KEY="JUAN_CATALOG_VIEW_MODE_V1";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const paths={
    "grid-2x2":'<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/>',
    "list":'<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    "folder":'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    "folder-open":'<path d="m6 14 1.5-3h11l-2 6H5.5L3 8h4l2-3h5l2 3"/><path d="M3 8h18"/>',
    "monitor-play":'<rect width="20" height="14" x="2" y="3" rx="2"/><path d="m10 8 5 3-5 3Z"/><path d="M8 21h8M12 17v4"/>',
    "video":'<path d="m16 13 5 3V8l-5 3"/><rect width="13" height="14" x="3" y="5" rx="2"/>',
    "camera":'<path d="M14.5 4 16 6h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2Z"/><circle cx="12" cy="12" r="3"/>',
    "palette":'<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 0 0-10 10c0 5.5 4.5 10 10 10h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h1.5A8.5 8.5 0 0 0 22 4.5 2.5 2.5 0 0 0 19.5 2Z"/>',
    "megaphone":'<path d="m3 11 18-5v12L3 13Z"/><path d="M11.6 16.8 13 22H8l-1.3-6.2"/><path d="M21 10v4"/>',
    "briefcase":'<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12h20M10 12v2h4v-2"/>',
    "ellipsis":'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    "pencil":'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    "trash-2":'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
    "arrow-up":'<path d="m18 15-6-6-6 6"/>',
    "arrow-down":'<path d="m6 9 6 6 6-6"/>'
  };
  const icon=(name,cls="")=>'<svg class="jp-lucide '+cls+'" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.folder)+'</svg>';

  function ready(fn,n=0){
    if(window.app&&typeof window.app.getWorkspaceState==="function")return fn();
    if(n<100)setTimeout(()=>ready(fn,n+1),80);
  }

  function catalogData(){
    const st=window.app.getWorkspaceState();
    return {
      categories:Array.isArray(st.catalogCategories)?st.catalogCategories:[],
      icons:st.catalogCategoryIcons||{},
      services:Array.isArray(st.soloServices)?st.soloServices:[],
      packages:Array.isArray(st.packagesList)?st.packagesList:[],
      selected:st.catalogManagerCategory||"ALL"
    };
  }

  function mode(){
    const v=localStorage.getItem(VIEW_KEY)||"grid";
    return ["grid","list","folder"].includes(v)?v:"grid";
  }

  function setMode(v){
    if(!["grid","list","folder"].includes(v))return;
    localStorage.setItem(VIEW_KEY,v);
    drawCatalogBrowser();
  }

  function categoryStats(name,d){
    if(name==="ALL")return {services:d.services.length,packages:d.packages.length};
    return {
      services:d.services.filter(x=>String(x.category||"")===name).length,
      packages:d.packages.filter(x=>String(x.category||"")===name).length
    };
  }

  function actionMenu(name,id,withLabel=false){
    return '<div class="jp-category-actions popover-wrap" id="'+id+'">'+
      '<button type="button" class="jp-category-more" data-cat-menu="'+id+'" aria-label="Category actions">'+icon("ellipsis")+'</button>'+
      '<div class="popover-panel client-row-menu jp-category-menu">'+
        '<button class="popover-action" type="button" data-cat-action="rename" data-cat-name="'+esc(name)+'">'+icon("pencil")+'<span>Rename Category</span></button>'+
        '<button class="popover-action" type="button" data-cat-action="icon" data-cat-name="'+esc(name)+'">'+icon("folder")+'<span>Change Icon</span></button>'+
        '<button class="popover-action" type="button" data-cat-action="up" data-cat-name="'+esc(name)+'">'+icon("arrow-up")+'<span>Move Up</span></button>'+
        '<button class="popover-action" type="button" data-cat-action="down" data-cat-name="'+esc(name)+'">'+icon("arrow-down")+'<span>Move Down</span></button>'+
        '<button class="popover-action text-danger" type="button" data-cat-action="delete" data-cat-name="'+esc(name)+'">'+icon("trash-2")+'<span>Delete Category</span></button>'+
      '</div></div>';
  }

  function closeCatalogMenus(){
    document.querySelectorAll('.jp-catalog-floating-menu[data-owner]').forEach(panel=>{
      const owner=document.getElementById(panel.dataset.owner||'');
      panel.classList.remove('jp-catalog-floating-menu');
      panel.style.display='';
      panel.style.position='';
      panel.style.left='';
      panel.style.top='';
      panel.style.width='';
      panel.style.zIndex='';
      panel.removeAttribute('data-owner');
      if(owner)owner.appendChild(panel);else panel.remove();
    });
  }

  function openCatalogMenu(btn,id,e){
    e?.preventDefault();e?.stopPropagation();
    const wrap=document.getElementById(id);if(!wrap)return;
    const existing=document.querySelector('.jp-catalog-floating-menu[data-owner="'+CSS.escape(id)+'"]');
    if(existing){closeCatalogMenus();return;}
    closeCatalogMenus();
    const panel=wrap.querySelector('.jp-category-menu');if(!panel)return;
    const rect=btn.getBoundingClientRect();
    document.body.appendChild(panel);
    panel.classList.add('jp-catalog-floating-menu');
    panel.dataset.owner=id;
    panel.style.display='block';
    panel.style.position='fixed';
    panel.style.zIndex='2147483000';
    panel.style.width='210px';
    const height=Math.max(120,panel.getBoundingClientRect().height||180);
    const left=Math.max(12,Math.min(window.innerWidth-222,rect.right-210));
    const below=window.innerHeight-rect.bottom;
    const top=below>=height+10?rect.bottom+6:Math.max(12,rect.top-height-6);
    panel.style.left=left+'px';
    panel.style.top=top+'px';
  }

  function bindCategoryActions(host){
    host.querySelectorAll("[data-cat-menu]").forEach(btn=>btn.addEventListener("click",e=>{
      openCatalogMenu(btn,btn.dataset.catMenu,e);
    }));
    host.querySelectorAll("[data-cat-action]").forEach(btn=>btn.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();
      const name=btn.dataset.catName||"",action=btn.dataset.catAction;
      closeCatalogMenus();
      if(action==="rename")window.app.openCatalogCategoryModal(name,"name");
      else if(action==="icon")window.app.openCatalogCategoryModal(name,"icon");
      else if(action==="up"||action==="down")window.app.moveCatalogCategory(name,action);
      else if(action==="delete")window.app.openCatalogDeleteFlow(name);
    }));
  }

  function drawCatalogBrowser(){
    const view=document.getElementById("view-pricelist");
    if(!view)return;
    const main=view.querySelector(".catalog-manager-main");
    if(!main)return;
    let host=document.getElementById("jpCatalogBrowser");
    if(!host){
      host=document.createElement("section");
      host.id="jpCatalogBrowser";
      host.className="jp-catalog-browser";
      main.parentNode.insertBefore(host,main);
    }
    const d=catalogData(),m=mode(),cats=["ALL",...d.categories],selected=d.selected||"ALL";
    host.dataset.view=m;
    const selectedActions=selected!=="ALL"?actionMenu(selected,"jpSelectedCategoryMenu",true):"";
    host.innerHTML=
      '<div class="jp-catalog-browser-head"><div class="jp-catalog-browser-title"><strong>'+(selected==="ALL"?"Catalog Categories":esc(selected))+'</strong>'+selectedActions+'</div>'+
      '<div class="jp-catalog-view-switch" aria-label="Catalog view">'+
      '<button type="button" data-cat-view="grid" class="'+(m==="grid"?"active":"")+'" title="Grid view" aria-label="Grid view">'+icon("grid-2x2")+'</button>'+
      '<button type="button" data-cat-view="list" class="'+(m==="list"?"active":"")+'" title="List view" aria-label="List view">'+icon("list")+'</button>'+
      '<button type="button" data-cat-view="folder" class="'+(m==="folder"?"active":"")+'" title="Folder view" aria-label="Folder view">'+icon("folder")+'</button>'+
      '</div></div>'+
      '<div class="jp-category-grid">'+cats.map((name,i)=>{
        const x=categoryStats(name,d),active=selected===name,label=name==="ALL"?"All Categories":name;
        const iconName=name==="ALL"?"folder-open":(d.icons[name]||"folder");
        return '<div class="jp-category-card '+(active?"active":"")+'" data-category-card="'+esc(name)+'">'+
          '<button type="button" class="jp-category-main" data-category="'+esc(name)+'">'+
            '<span class="jp-category-icon" aria-hidden="true">'+icon(iconName)+'</span>'+
            '<span class="jp-category-copy"><strong>'+esc(label)+'</strong><small>'+x.services+' service'+(x.services===1?'':'s')+' · '+x.packages+' package'+(x.packages===1?'':'s')+'</small></span>'+
          '</button>'+
          (name!=="ALL"?actionMenu(name,"jpCategoryMenu"+i):"")+
        '</div>';
      }).join("")+'</div>';

    host.querySelectorAll("[data-cat-view]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.catView)));
    host.querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>{
      const c=b.dataset.category||"ALL";
      window.app.selectCatalogCategory(c);
      setTimeout(drawCatalogBrowser,0);
    }));
    bindCategoryActions(host);
  }

  function improveRefreshButton(id,loadingId){
    const btn=document.getElementById(id),loading=document.getElementById(loadingId);
    if(!btn||btn.dataset.jpLoadingBound)return;
    btn.dataset.jpLoadingBound="1";
    if(loading){
      const sync=()=>{
        const busy=!loading.classList.contains("hidden");
        btn.setAttribute("aria-busy",busy?"true":"false");
        btn.disabled=busy;
        btn.classList.toggle("jp-refreshing",busy);
        btn.textContent="Refresh";
      };
      new MutationObserver(sync).observe(loading,{attributes:true,attributeFilter:["class"]});
      sync();
    }
  }

  function install(){
    drawCatalogBrowser();
    improveRefreshButton("onlinePortalRefreshBtn","onlinePortalLoading");
    document.addEventListener("click",closeCatalogMenus);
    window.addEventListener("resize",closeCatalogMenus);
    window.addEventListener("scroll",closeCatalogMenus,true);

    const originalCatalog=window.app.renderPricelist;
    if(typeof originalCatalog==="function"){
      window.app.renderPricelist=function(){
        const r=originalCatalog.apply(this,arguments);
        setTimeout(drawCatalogBrowser,0);
        return r;
      };
    }
    const originalSelect=window.app.selectCatalogCategory;
    if(typeof originalSelect==="function"){
      window.app.selectCatalogCategory=function(){
        const r=originalSelect.apply(this,arguments);
        setTimeout(drawCatalogBrowser,0);
        return r;
      };
    }
    const originalNavigate=window.app.navigateTo;
    if(typeof originalNavigate==="function"){
      window.app.navigateTo=function(view){
        const r=originalNavigate.apply(this,arguments);
        if(view==="pricelist")setTimeout(drawCatalogBrowser,0);
        if(view==="online-portal")setTimeout(()=>improveRefreshButton("onlinePortalRefreshBtn","onlinePortalLoading"),0);
        return r;
      };
    }
  }

  ready(install);
})();

/* 2026-10-13 UPDATE #11 — KPI COPY */
(() => {
  const normalizeHomeKpiCopy = () => {
    const host = document.getElementById("overviewKpis");
    if (!host) return;
    const labels = host.querySelectorAll(".kpi-label");
    const todo = labels[1];
    if (todo && /^not\s+done$/i.test(todo.textContent.trim())) {
      todo.textContent = "To Do";
    }
  };

  const bindHomeKpiCopy = () => {
    const host = document.getElementById("overviewKpis");
    if (!host || host.dataset.jpTodoCopyBound === "1") {
      normalizeHomeKpiCopy();
      return;
    }
    host.dataset.jpTodoCopyBound = "1";
    normalizeHomeKpiCopy();
    new MutationObserver(normalizeHomeKpiCopy).observe(host, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindHomeKpiCopy, { once: true });
  } else {
    bindHomeKpiCopy();
  }
})();


/* 2026-10-14 UPDATE LIST #1–#4 — runtime state harmonizer */
(() => {
  "use strict";
  const BRAND="#56EB97";
  const soft="rgba(86,235,151,.075)";
  const border="rgba(86,235,151,.36)";

  const iconPaths={
    inbox:'<path d="M4 4h16v13H4z"/><path d="M4 13h4l2 3h4l2-3h4"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    folder:'<path d="M3 6h6l2 2h10v11H3z"/>',
    card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    activity:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    warning:'<path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
    check:'<path d="M20 6 9 17l-5-5"/>'
  };
  const icon=(name="inbox")=>'<span class="jp-state-icon"><svg viewBox="0 0 24 24" aria-hidden="true">'+(iconPaths[name]||iconPaths.inbox)+'</svg></span>';
  const loadingIcon=(name="activity")=>'<span class="jp-state-icon is-loading"><svg viewBox="0 0 24 24" aria-hidden="true">'+(iconPaths[name]||iconPaths.activity)+'</svg></span>';

  function enforceHomeBrand(){
    const root=document.getElementById("overviewDashboard");
    if(!root)return;
    const todo=root.querySelector(".home-kpi-todo");
    if(todo){
      todo.style.setProperty("background",soft,"important");
      todo.style.setProperty("border-color",border,"important");
      const ico=todo.querySelector(".overview-kpi-icon");
      if(ico){
        ico.style.setProperty("background","rgba(86,235,151,.16)","important");
        ico.style.setProperty("color","#24B86A","important");
      }
    }
    root.querySelectorAll(".current-project-progress .progress-bar-fill").forEach(el=>el.style.setProperty("background",BRAND,"important"));
    root.querySelectorAll(".overview-cal-dot").forEach(el=>el.style.setProperty("background",BRAND,"important"));
    root.querySelectorAll(".overview-cal-day.today").forEach(el=>{
      el.style.setProperty("border-color",BRAND,"important");
      el.style.setProperty("background","rgba(86,235,151,.12)","important");
    });
  }

  function skeletonRows(tbody,cols,count=5){
    if(!tbody||tbody.querySelector("tr:not(.jp-state-skeleton-row):not(.jp-state-loading-message-row)"))return;
    tbody.innerHTML='<tr class="jp-state-loading-message-row"><td colspan="'+cols+'"><div class="jp-state-inline">'+loadingIcon("activity")+'<div class="jp-state-inline-copy"><strong>Loading latest data</strong><span>Fetching the information for this view…</span></div></div></td></tr>'+
      Array.from({length:count},()=>'<tr class="jp-state-skeleton-row" aria-hidden="true">'+Array.from({length:cols},()=>'<td><span class="jp-skeleton"></span></td>').join("")+'</tr>').join("");
  }
  function clearSkeletonRows(tbody){
    if(!tbody)return;
    tbody.querySelectorAll(".jp-state-skeleton-row,.jp-state-loading-message-row").forEach(x=>x.remove());
  }

  function stateMeta(text){
    const t=String(text||"").toLowerCase();
    if(t.includes("order"))return {icon:"inbox",title:"No orders here",body:"New order requests will appear here when they are available."};
    if(t.includes("client"))return {icon:"users",title:t.includes("matching")?"No matching clients":"No clients yet",body:t.includes("matching")?"Try adjusting your search or filters.":"Clients will appear here once they are added."};
    if(t.includes("project"))return {icon:"folder",title:t.includes("matching")?"No matching projects":"No projects yet",body:t.includes("matching")?"Try adjusting your search or filters.":"Projects will appear here once they are created."};
    if(t.includes("payment"))return {icon:"card",title:"No payments yet",body:"Recorded or submitted payments will appear here."};
    if(t.includes("service")||t.includes("package"))return {icon:"grid",title:"Nothing to show yet",body:"Catalog items matching this view will appear here."};
    if(t.includes("activity"))return {icon:"activity",title:"No activity yet",body:"Recent portal activity will appear here."};
    if(t.includes("task")||t.includes("deliverable"))return {icon:"check",title:"Nothing pending here",body:"Items will appear here when there is something to review."};
    return {icon:"inbox",title:"Nothing here yet",body:"New records will appear here when available."};
  }

  function upgradeEmptyRow(tbody){
    if(!tbody||tbody.querySelector(".jp-state-empty-row,.jp-state-error-row,.jp-state-skeleton-row"))return;
    const rows=[...tbody.children].filter(x=>x.tagName==="TR");
    if(rows.length!==1)return;
    const row=rows[0],text=row.textContent.trim();
    if(!/^no\b/i.test(text))return;
    const meta=stateMeta(text),cols=Math.max(1,row.querySelector("td")?.colSpan||tbody.closest("table")?.querySelectorAll("thead th").length||1);
    row.className="jp-state-empty-row";
    row.innerHTML='<td colspan="'+cols+'"><div class="jp-state-panel">'+icon(meta.icon)+'<h3>'+meta.title+'</h3><p>'+meta.body+'</p></div></td>';
  }

  function syncPortalState(){
    const loading=document.getElementById("onlinePortalLoading");
    if(!loading)return;
    const busy=!loading.classList.contains("hidden");
    if(busy){
      if(!loading.querySelector(".jp-state-inline")){
        loading.innerHTML='<div><div class="jp-state-inline">'+loadingIcon("activity")+'<div class="jp-state-inline-copy"><strong>Syncing Portal</strong><span>Refreshing client access and payment activity…</span></div></div></div>';
      }
      const panel=document.querySelector("#view-online-portal .portal-panel:not(.hidden)");
      const tbody=panel?.querySelector("tbody");
      if(tbody&&!tbody.querySelector("tr:not(.jp-state-empty-row):not(.jp-state-skeleton-row):not(.jp-state-loading-message-row)")){
        const cols=tbody.closest("table")?.querySelectorAll("thead th").length||6;
        skeletonRows(tbody,cols,4);
      }
    }else{
      document.querySelectorAll("#view-online-portal tbody").forEach(tbody=>{clearSkeletonRows(tbody);upgradeEmptyRow(tbody);});
    }

    const refresh=document.getElementById("onlinePortalRefreshBtn");
    if(refresh){
      refresh.classList.toggle("jp-refreshing",busy);
      refresh.setAttribute("aria-busy",busy?"true":"false");
    }
  }

  function upgradePortalError(){
    const err=document.getElementById("onlinePortalError");
    if(!err||err.classList.contains("hidden")||err.querySelector(".jp-state-panel"))return;
    const message=err.textContent.trim()||"The Portal could not be loaded.";
    err.innerHTML='<div class="jp-state-panel is-error">'+icon("warning")+'<h3>Could not load Portal</h3><p>'+message+'</p><button type="button" class="btn btn-secondary btn-sm" data-jp-portal-retry>Try Again</button></div>';
    err.querySelector("[data-jp-portal-retry]")?.addEventListener("click",()=>document.getElementById("onlinePortalRefreshBtn")?.click());
  }

  function watch(){
    enforceHomeBrand();
    const home=document.getElementById("overviewDashboard");
    if(home&&!home.dataset.jpBrandObserver){
      home.dataset.jpBrandObserver="1";
      new MutationObserver(enforceHomeBrand).observe(home,{childList:true,subtree:true});
    }

    const loading=document.getElementById("onlinePortalLoading");
    if(loading&&!loading.dataset.jpSmartState){
      loading.dataset.jpSmartState="1";
      new MutationObserver(()=>{syncPortalState();upgradePortalError();}).observe(loading,{attributes:true,attributeFilter:["class"],childList:true,subtree:true});
    }
    const error=document.getElementById("onlinePortalError");
    if(error&&!error.dataset.jpSmartState){
      error.dataset.jpSmartState="1";
      new MutationObserver(upgradePortalError).observe(error,{attributes:true,attributeFilter:["class"],childList:true});
    }
    ["onlinePortalAccountRows","onlinePortalPaymentRows","onlinePortalActivityRows"].forEach(id=>{
      const tbody=document.getElementById(id);
      if(tbody&&!tbody.dataset.jpSmartState){
        tbody.dataset.jpSmartState="1";
        new MutationObserver(()=>{if(!document.getElementById("onlinePortalLoading")?.classList.contains("hidden"))return;upgradeEmptyRow(tbody);}).observe(tbody,{childList:true});
      }
      if(tbody)upgradeEmptyRow(tbody);
    });

    /* Normalize simple one-row empty tables elsewhere, without creating loaders for synchronous pages. */
    document.querySelectorAll(".main-content tbody").forEach(upgradeEmptyRow);
    syncPortalState();
    upgradePortalError();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch,{once:true});
  else watch();
  document.addEventListener("click",()=>setTimeout(watch,0),true);
})();


/* 2026-10-14 HOME EXACT VIEWPORT FIT */
(() => {
  "use strict";
  let raf=0;

  function px(v){const n=parseFloat(v);return Number.isFinite(n)?n:0;}

  function syncHomeViewport(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      if(window.innerWidth<1024)return;
      const main=document.querySelector(".main-content");
      const home=document.getElementById("view-my-works");
      const dashboard=document.getElementById("overviewDashboard");
      const kpis=document.getElementById("overviewKpis");
      const priority=dashboard?.querySelector(":scope > .overview-priority-grid");
      const header=home?.querySelector(":scope > .page-header");
      if(!main||!home||!dashboard||!kpis||!priority||!header||!home.classList.contains("active"))return;

      const mainStyle=getComputedStyle(main);
      const available=Math.max(0,main.clientHeight-px(mainStyle.paddingTop)-px(mainStyle.paddingBottom));
      const outerGap=24;

      home.style.setProperty("height",available+"px","important");
      home.style.setProperty("min-height",available+"px","important");
      home.style.setProperty("max-height",available+"px","important");

      const headerH=Math.ceil(header.getBoundingClientRect().height);
      const dashboardH=Math.max(0,available-headerH-outerGap);
      dashboard.style.setProperty("height",dashboardH+"px","important");
      dashboard.style.setProperty("min-height",dashboardH+"px","important");
      dashboard.style.setProperty("max-height",dashboardH+"px","important");
      dashboard.style.setProperty("flex","0 0 "+dashboardH+"px","important");

      const kpiH=Math.ceil(kpis.getBoundingClientRect().height);
      const priorityH=Math.max(0,dashboardH-kpiH-outerGap);
      priority.style.setProperty("height",priorityH+"px","important");
      priority.style.setProperty("min-height",priorityH+"px","important");
      priority.style.setProperty("max-height",priorityH+"px","important");
      priority.style.setProperty("flex","0 0 "+priorityH+"px","important");
    });
  }

  function bind(){
    syncHomeViewport();
    window.addEventListener("resize",syncHomeViewport,{passive:true});

    const main=document.querySelector(".main-content");
    const header=document.querySelector("#view-my-works > .page-header");
    const kpis=document.getElementById("overviewKpis");
    if("ResizeObserver" in window){
      const ro=new ResizeObserver(syncHomeViewport);
      if(main)ro.observe(main);
      if(header)ro.observe(header);
      if(kpis)ro.observe(kpis);
    }
    if(kpis){
      new MutationObserver(syncHomeViewport).observe(kpis,{childList:true,subtree:true,characterData:true});
    }
    document.addEventListener("click",()=>setTimeout(syncHomeViewport,0),true);
    window.addEventListener("load",syncHomeViewport,{once:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
