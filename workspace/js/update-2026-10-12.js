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
        btn.textContent=busy?"Refreshing…":"Refresh";
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