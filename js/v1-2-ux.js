/* JUAN PROJECT Workspace V1.2 — non-destructive UX enhancement layer */
(function(){
  const iconPaths={
    'my-works':'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/>',
    projects:'<path d="M3 7h7l2 2h9v10H3z"/><path d="M3 7V5h7l2 2"/>',
    clients:'<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M18 8a3 3 0 0 1 0 6M22 21v-2a4 4 0 0 0-3-3.7"/>',
    'new-order':'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    'orders':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    payments:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
    reports:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    pricelist:'<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/>',
    'online-portal':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h5"/><path d="M15 15h4v3h-4z"/>',
    'in-house-ads':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6M7 13h4"/><path d="m17 9 .7 1.4 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z"/>'
  };
  const descriptions={
    'my-works':'See what needs attention across active projects, deadlines, and deliverables.',
    projects:'Track project status, progress, deadlines, and balances from one place.',
    clients:'Find each unique client and the projects connected to their Client ID.',
    'new-order':'Create a project with the client, services, timeline, and pricing in one flow.',
    payments:'Review project totals, recorded payments, outstanding balances, and invoice status.',
    reports:'Understand revenue, collections, outstanding balances, and current workload.',
    calendar:'Review project deadlines and operational dates in a single schedule.',
    pricelist:'Manage the shared JUAN PROJECT catalog used by Workspace and Online.',
    'online-portal':'Manage client accounts, payment reviews, project Drive access, and payment setup.',
    'in-house-ads':'Create, schedule, publish, pause, archive, and remove In-House Ads.',
    settings:'Manage Workspace profile, preferences, and system settings.'
  };
  const labels={work:'WORK',finance:'FINANCE',operations:'OPERATIONS',system:'SYSTEM'};
  const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const svg=path=>`<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

  function makeLabel(text){const d=document.createElement('div');d.className='nav-section-label';d.textContent=text;return d}
  function restructureSidebar(){
    const menu=q('.nav-menu');if(!menu||menu.dataset.v12==='1')return;menu.dataset.v12='1';
    const items={};
    qa('.nav-item',menu).forEach(el=>{const key=el.dataset.view||el.id;if(key)items[key]=el});
    menu.innerHTML='';
    const placed=new Set();
    const append=(label,views)=>{menu.append(makeLabel(label));views.forEach(v=>{const el=items[v];if(el){menu.append(el);placed.add(v)}})};
    append(labels.work,['my-works','projects','clients','new-order','orders']);
    if(items['new-order'])items['new-order'].classList.remove('workspace-primary-action');
    append(labels.finance,['payments','reports']);
    append(labels.operations,['calendar','pricelist','online-portal','in-house-ads']);
    append(labels.system,['settings']);
    // Never delete newly added navigation destinations just because this legacy enhancer
    // does not know about them yet. Preserve any remaining items after the known groups.
    Object.entries(items).forEach(([key,el])=>{if(!placed.has(key))menu.append(el)});
    qa('.nav-item',menu).forEach(el=>{const key=el.dataset.view||el.id,ic=q('.icon',el),path=iconPaths[key];if(ic&&path)ic.innerHTML=svg(path);el.setAttribute('aria-label',el.textContent.trim())});
  }

  function addDescriptions(){
    Object.entries(descriptions).forEach(([view,text])=>{
      const section=q(`#view-${view}`);if(!section)return;
      const head=q('.page-header',section),title=q('.page-title',head);if(!head||!title||q('.page-description',head))return;
      const p=document.createElement('div');p.className='page-description';p.textContent=text;title.insertAdjacentElement('afterend',p);
    });
  }

  function improveAccessibility(){
    qa('button[title]').forEach(b=>{if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',b.title)});
    qa('.icon-more-button').forEach(b=>{if(!b.getAttribute('aria-label'))b.setAttribute('aria-label','More actions')});
    const toast=q('#toast');if(toast){toast.setAttribute('role','status');toast.setAttribute('aria-live','polite')}
  }

  function clearError(input){
    input?.classList.remove('jp-invalid');
    const sibling=input?.parentElement?.querySelector('.jp-field-error');if(sibling)sibling.remove();
  }
  function fieldError(input,message){
    if(!input)return;clearError(input);input.classList.add('jp-invalid');
    const span=document.createElement('span');span.className='jp-field-error';span.textContent=message;input.insertAdjacentElement('afterend',span);
  }
  function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())}
  function setupValidation(){
    qa('input[type="email"]').forEach(input=>{if(input.dataset.v12Validation)return;input.dataset.v12Validation='1';input.addEventListener('blur',()=>{clearError(input);if(input.value.trim()&&!validEmail(input.value))fieldError(input,'Enter a valid email address.')});input.addEventListener('input',()=>clearError(input))});
  }
  function validateNewOrder(){
    let ok=true;const project=q('#orderProjectName');clearError(project);if(!project?.value.trim()){fieldError(project,'Project name is required.');ok=false}
    const newMode=q('#clientNewMode');if(newMode&&!newMode.classList.contains('hidden')){
      const name=q('#newClientName'),email=q('#newClientEmail');clearError(name);clearError(email);
      if(!name?.value.trim()){fieldError(name,'Client name is required.');ok=false}
      if(!email?.value.trim()){fieldError(email,'Client email is required.');ok=false}else if(!validEmail(email.value)){fieldError(email,'Enter a valid client email address.');ok=false}
    }else{
      const selected=q('#orderClientSelect'),search=q('#orderClientSearch');clearError(search);if(!selected?.value){fieldError(search,'Select an existing client from the suggestions.');ok=false}
    }
    const start=q('#orderStartDate'),due=q('#orderDeadlineDate');clearError(start);clearError(due);
    if(!start?.value){fieldError(start,'Start date is required.');ok=false}
    if(!due?.value){fieldError(due,'Deadline is required.');ok=false}
    if(start?.value&&due?.value&&new Date(due.value)<new Date(start.value)){fieldError(due,'Deadline cannot be earlier than the start date.');ok=false}
    if(!ok){q('.jp-invalid')?.scrollIntoView({behavior:'smooth',block:'center'});q('.jp-invalid')?.focus()}
    return ok;
  }

  function processing(title='Processing…',detail='Please keep this page open for a moment.'){
    let o=q('#jpProcessingOverlay');if(o)o.remove();o=document.createElement('div');o.id='jpProcessingOverlay';o.className='jp-processing-overlay';o.innerHTML=`<div class="jp-processing-card"><div class="jp-spinner"></div><strong>${title}</strong><span>${detail}</span></div>`;document.body.append(o);return()=>o.remove();
  }
  function wrapAsync(name,title,detail){if(typeof app==='undefined'||typeof app[name]!=='function'||app[name].__v12)return;const orig=app[name];const fn=async function(...args){const stop=processing(title,detail);try{return await orig.apply(app,args)}finally{stop()}};fn.__v12=true;app[name]=fn}
  function wrapValidation(){if(typeof app==='undefined'||typeof app.showOrderConfirmation!=='function'||app.showOrderConfirmation.__v12)return;const orig=app.showOrderConfirmation;const fn=function(...args){if(!validateNewOrder())return;return orig.apply(app,args)};fn.__v12=true;app.showOrderConfirmation=fn}

  function decorateSnapshot(){
    qa('.report-snapshot-card').forEach(card=>{card.classList.add('snapshot-v12');const title=q('.card-title',card);if(title)title.textContent='Business Snapshot';const sub=q('.text-sm.text-muted',card);if(sub)sub.textContent='Decision-focused view of workload and cash collection';const stats=qa('.snapshot-stat',card);if(stats[0])stats[0].classList.add('primary');if(stats[2])stats[2].classList.add('attention')});
  }

  function upgradeEmptyStates(){
    qa('td.text-center.text-muted').forEach(td=>{const t=td.textContent.trim();if(t==='No projects found.')td.innerHTML='<strong>No matching projects</strong><div class="text-sm text-muted mt-1">Try another filter or create a new order.</div>';if(t==='No matching clients.')td.innerHTML='<strong>No matching clients</strong><div class="text-sm text-muted mt-1">Try a different name, email, or Client ID.</div>'});
  }

  function install(){
    restructureSidebar();addDescriptions();improveAccessibility();setupValidation();decorateSnapshot();upgradeEmptyStates();wrapValidation();
    wrapAsync('confirmAndCreateOrder','Creating project…','Saving the client, order items, timeline, and pricing.');
    wrapAsync('saveProjectData','Saving project…','Updating project information and connected records.');
    wrapAsync('finalizePaymentRecord','Recording payment…','Updating payment history and project balance.');
    wrapAsync('saveInvoicePDF','Preparing invoice…','Formatting the JUAN PROJECT invoice for export.');
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,120));
  window.addEventListener('juan:realtime-sync',()=>requestAnimationFrame(()=>{decorateSnapshot();upgradeEmptyStates();}));
})();
