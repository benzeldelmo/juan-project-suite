/* JUAN PROJECT Workspace maintenance behavior — goals 1–18 — 2026-10-06 */
(()=>{
  'use strict';
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const $=(s,r=document)=>r.querySelector(s);
  let sweeping=false;

  function currencyNumber(value){
    const clean=String(value??'').replace(/[^0-9.-]/g,'');
    const n=Number(clean);
    return Number.isFinite(n)?n:0;
  }
  function moneyText(value){
    return '₱ '+currencyNumber(value).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function enhanceMoneyInput(input){
    if(!input||input.dataset.jpMoney==='1')return;
    input.dataset.jpMoney='1';
    input.type='text';
    input.inputMode='decimal';
    const format=()=>{if(String(input.value).trim()!=='')input.value=moneyText(input.value)};
    const raw=()=>{if(String(input.value).trim()!=='')input.value=String(currencyNumber(input.value))};
    input.addEventListener('focus',raw);
    input.addEventListener('blur',format);
    format();
  }
  function normalizeMoneyInput(input){
    if(input&&String(input.value).trim()!=='')input.value=String(currencyNumber(input.value));
  }

  function relabelSelect(select,labels){
    if(!select)return;
    Array.from(select.options).forEach(o=>{if(labels[o.value])o.textContent=labels[o.value]});
  }

  function syncToolbarLanguage(){
    relabelSelect($('#projectsSort'),{default:'Sort: Default',date:'Sort: Date',payment:'Sort: Payment'});
    relabelSelect($('#clientsSort'),{default:'Sort: Default',date:'Sort: Date',payment:'Sort: Payment'});
    relabelSelect($('#paymentsSort'),{default:'Sort: Default',date:'Sort: Due Date',payment:'Sort: Amount Paid',balance:'Sort: Balance'});
    relabelSelect($('#catalogSort'),{default:'Sort: Default',name:'Sort: Name A–Z','price-asc':'Sort: Price Low to High','price-desc':'Sort: Price High to Low'});
    const category=$('#catalogCategorySelect');
    if(category){
      Array.from(category.options).forEach(o=>{
        const raw=String(o.textContent||'').replace(/^Category:\s*/i,'').replace(/^All Categories$/i,'All');
        o.textContent=o.value==='ALL'?'Category: All':'Category: '+raw;
      });
    }
    const type=$('#catalogTypeSelect');
    if(type){
      const services=$('#catalogServicesCard'),packages=$('#catalogPackagesCard');
      if(services&&packages){
        type.value=services.style.display==='none'?'Packages':packages.style.display==='none'?'Services':'All';
      }
    }
    relabelSelect($('#jpPaymentDateFilter'),{all:'Date: All','this-month':'Date: This month','30-days':'Date: Last 30 days','this-year':'Date: This year'});
    const method=$('#jpPaymentMethodFilter');
    if(method)Array.from(method.options).forEach(o=>{if(o.value==='all')o.textContent='Method: All';else if(!/^Method:\s/.test(o.textContent))o.textContent='Method: '+o.textContent});
    relabelSelect($('#jpPaymentSort'),{newest:'Sort: Newest',oldest:'Sort: Oldest'});
  }

  function markEmptyHomeCards(){
    [['#overviewCurrentProjects',/no (active|current) projects/i],['#overviewUpcomingDeadlines',/no upcoming deadlines/i]].forEach(([sel,re])=>{
      const content=$(sel); if(!content)return;
      const card=content.closest('.card'); if(!card)return;
      const empty=re.test(content.textContent||'');
      card.classList.toggle('jp-maintenance-empty-card',empty);
      $$('button',card).forEach(btn=>{
        const isExpand=/expand|open/i.test(btn.getAttribute('aria-label')||'')||String(btn.getAttribute('onclick')||'').includes('openOverviewListModal');
        if(isExpand)btn.hidden=empty;
      });
    });
  }

  function syncOnlineManagementState(){
    const portal=document.getElementById('view-online-portal');
    const ads=document.getElementById('view-in-house-ads');
    const active=portal?.classList.contains('active')||ads?.classList.contains('active');
    document.body.classList.toggle('jp-online-management-active',!!active);
  }

  function applyAuthCopy(){
    const foot=$('.workspace-auth-foot');
    if(foot)foot.textContent='Admin access is protected by Supabase Auth. Sign in to load and synchronize Workspace data.';
    const offline=$('.workspace-auth-offline'); if(offline)offline.hidden=true;
  }

  function setCatalogModalAction(modalId,isEdit,createLabel){
    const modal=$('#'+modalId); if(!modal)return;
    const primary=$('.catalog-modal-footer .btn-primary',modal);
    if(primary)primary.textContent=isEdit?'Save Changes':createLabel;
  }
  function afterServiceOpen(code){
    queueMicrotask(()=>{
      setCatalogModalAction('catalogServiceModal',!!code,'Add Service');
      enhanceMoneyInput($('#catalogServicePrice'));
    });
  }
  function afterCategoryOpen(existing){queueMicrotask(()=>setCatalogModalAction('catalogCategoryModal',!!existing,'Add Category'))}
  function afterPackageOpen(code){
    queueMicrotask(()=>{
      setCatalogModalAction('catalogPackageModal',!!code,'Create Package');
      enhanceMoneyInput($('#catalogPackageSellingPrice'));
    });
  }

  function patchApp(){
    const app=window.app;
    if(!app||app.__jpMaintenancePatched)return;
    app.__jpMaintenancePatched=true;

    const openService=app.openCatalogServiceModal?.bind(app);
    if(openService)app.openCatalogServiceModal=(code='')=>{const r=openService(code);afterServiceOpen(code);return r};
    const openCategory=app.openCatalogCategoryModal?.bind(app);
    if(openCategory)app.openCatalogCategoryModal=(existing='')=>{const r=openCategory(existing);afterCategoryOpen(existing);return r};
    const openPackage=app.openCatalogPackageModal?.bind(app);
    if(openPackage)app.openCatalogPackageModal=(code='')=>{const r=openPackage(code);afterPackageOpen(code);return r};
    if(app.openEditServiceModal)app.openEditServiceModal=(code)=>app.openCatalogServiceModal(code);
    if(app.openEditPackageModal)app.openEditPackageModal=(code)=>app.openCatalogPackageModal(code);

    const saveService=app.saveCatalogService?.bind(app);
    if(saveService)app.saveCatalogService=async()=>{normalizeMoneyInput($('#catalogServicePrice'));return saveService()};
    const savePackage=app.saveCatalogPackage?.bind(app);
    if(savePackage)app.saveCatalogPackage=async()=>{normalizeMoneyInput($('#catalogPackageSellingPrice'));return savePackage()};

    /* Goal 18: clicking Sign In & Connect must open authentication immediately.
       adminSignIn remains the only credential submission path and performs config,
       session setup, role verification, data load, and realtime startup. */
    app.connectDatabaseManually=async()=>{
      const gate=$('#workspaceAuthGate');
      const msg=$('#workspaceAuthMessage');
      if(msg)msg.textContent='Sign in with your JUAN PROJECT Workspace admin account to connect Supabase.';
      if(gate)gate.classList.add('show');
      applyAuthCopy();
      setTimeout(()=>$('#workspaceAuthEmail')?.focus(),40);
      return false;
    };
  }

  function sweep(){
    if(sweeping)return;sweeping=true;
    try{
      patchApp();
      syncToolbarLanguage();
      markEmptyHomeCards();
      applyAuthCopy();
      syncOnlineManagementState();
      if($('#catalogServiceModal')?.classList.contains('active'))enhanceMoneyInput($('#catalogServicePrice'));
      if($('#catalogPackageModal')?.classList.contains('active'))enhanceMoneyInput($('#catalogPackageSellingPrice'));
    }finally{sweeping=false}
  }

  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(sweep,40)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sweep,{once:true});else sweep();
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('juan-workspace-render',schedule);
})();
