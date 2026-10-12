/* JUAN PROJECT Workspace — October 12, 2026 UI system pass */
(function(){
  "use strict";
  const VIEW_KEY="JUAN_CATALOG_VIEW_MODE_V1";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function ready(fn,n=0){
    if(window.app&&typeof window.app.getWorkspaceState==="function")return fn();
    if(n<100)setTimeout(()=>ready(fn,n+1),80);
  }

  function catalogData(){
    const st=window.app.getWorkspaceState();
    return {
      categories:Array.isArray(st.catalogCategories)?st.catalogCategories:[],
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
    const d=catalogData(),m=mode(),cats=["ALL",...d.categories];
    host.dataset.view=m;
    host.innerHTML=
      '<div class="jp-catalog-browser-head"><strong>Catalog Categories</strong>'+
      '<div class="jp-catalog-view-switch" aria-label="Catalog view">'+
      '<button type="button" data-cat-view="grid" class="'+(m==="grid"?"active":"")+'" title="Grid view" aria-label="Grid view">▦</button>'+
      '<button type="button" data-cat-view="list" class="'+(m==="list"?"active":"")+'" title="List view" aria-label="List view">☷</button>'+
      '<button type="button" data-cat-view="folder" class="'+(m==="folder"?"active":"")+'" title="Folder view" aria-label="Folder view">▰</button>'+
      '</div></div>'+
      '<div class="jp-category-grid">'+cats.map(name=>{
        const x=categoryStats(name,d),active=(d.selected||"ALL")===name;
        const label=name==="ALL"?"All Categories":name;
        return '<button type="button" class="jp-category-card '+(active?"active":"")+'" data-category="'+esc(name)+'">'+
          '<span class="jp-category-folder" aria-hidden="true"></span>'+
          '<span><strong>'+esc(label)+'</strong><small>'+x.services+' service'+(x.services===1?'':'s')+' · '+x.packages+' package'+(x.packages===1?'':'s')+'</small></span>'+
          '<span class="jp-category-count" aria-hidden="true">›</span></button>';
      }).join("")+'</div>';
    host.querySelectorAll("[data-cat-view]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.catView)));
    host.querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>{
      const c=b.dataset.category||"ALL";
      window.app.selectCatalogCategory(c);
      setTimeout(drawCatalogBrowser,0);
    }));
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
        btn.textContent=busy?"↻ Refreshing…":"↻ Refresh";
      };
      new MutationObserver(sync).observe(loading,{attributes:true,attributeFilter:["class"]});
      sync();
    }
  }

  function install(){
    drawCatalogBrowser();
    improveRefreshButton("onlinePortalRefreshBtn","onlinePortalLoading");

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