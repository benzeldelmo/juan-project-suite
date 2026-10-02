(()=>{'use strict';
const peso=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})};
function state(){try{return window.app?.getWorkspaceState?.()||{}}catch{return {}}}
function balance(p){
  const pays=(p.payments||[]).filter(x=>!x.deleted_at).reduce((s,x)=>s+Number(x.amount_paid||x.amount||0),0);
  return Math.max(0,Number(p.total_amount||0)+Number(p.late_fee_total||0)-pays);
}
function statusClass(s){s=String(s||'').toLowerCase();if(s.includes('overdue'))return'overdue';if(s.includes('grace'))return'grace';if(s.includes('review'))return'review';return''}
function financeIcon(type){
  const icons={
    balance:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M6 6.5V4.5h11v2M15.5 11h5v4h-5a2 2 0 0 1 0-4Z"/></svg>',
    status:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16.5h.01"/></svg>',
    due:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 9h16"/></svg>',
    fee:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/></svg>'
  };
  return icons[type]||'';
}
function financeHTML(p){
  const bal=balance(p),fee=Number(p.late_fee_total||0),s=p.financial_status||p.payment_status||(bal<=0?'PAID':'UNPAID');
  const dueInfo='Same as the Project End / Completion Date. A 1-day grace period follows the due date.';
  const feeInfo='₱500 applies on Day 3, then +₱250 only after each completed 7-day period while a balance remains unpaid. No daily fee.';
  return '<section class="jp-project-finance-panel" data-jp-finance-project="'+esc(p.id)+'"><div class="jp-finance-summary">'+
    '<div class="jp-finance-cell balance"><span class="jp-finance-icon mint">'+financeIcon('balance')+'</span><div><span>Current Balance</span><strong>'+peso(bal)+'</strong></div></div>'+
    '<div class="jp-finance-cell"><span class="jp-finance-icon danger">'+financeIcon('status')+'</span><div><span>Payment Status</span><b class="jp-finance-tag '+statusClass(s)+'">'+esc(s)+'</b></div></div>'+
    '<div class="jp-finance-cell"><span class="jp-finance-icon neutral">'+financeIcon('due')+'</span><div><span class="jp-label-with-info">Due Date <button type="button" class="jp-info-button" aria-label="About payment due date" data-info="'+esc(dueInfo)+'">i</button></span><strong>'+date(p.payment_due_date)+'</strong></div></div>'+
    '<div class="jp-finance-cell"><span class="jp-finance-icon danger">'+financeIcon('fee')+'</span><div><span class="jp-label-with-info">Overdue Fees <button type="button" class="jp-info-button" aria-label="About overdue fees" data-info="'+esc(feeInfo)+'">i</button></span><strong class="'+(fee>0?'jp-late-fee-row':'')+'">'+peso(fee)+'</strong></div></div>'+
    '</div></section>';
}
function findProjectFromDialog(root){
  const st=state(),ps=st.projects||[];
  const text=(root.textContent||'');
  return ps.find(p=>text.includes(p.project_code||'__none__')||text.includes(p.id)||text.includes(p.title||'__none__'))||null;
}
function enhanceProjectDialog(root){
  if(!root||root.dataset.jpProjectFinanceContext!=='1'||root.dataset.jpFinanceEnhanced==='1')return;
  const p=findProjectFromDialog(root);if(!p)return;
  root.dataset.jpFinanceEnhanced='1';
  const target=root.querySelector('.modal-body,.jp-suite-body,.suite-panel>div:not(.suite-head),.project-details-content')||root.querySelector('header')?.nextElementSibling||root;
  const wrap=document.createElement('div');wrap.innerHTML=financeHTML(p);
  target.prepend(wrap.firstElementChild);
}
function enhancePaymentReview(root){
  if(!root||root.dataset.jpPaymentFinance==='1')return;
  const text=(root.textContent||'').toLowerCase();
  if(!text.includes('payment')||(!text.includes('approve')&&!text.includes('reject')))return;
  const st=state(),ps=st.projects||[];
  const p=ps.find(x=>(root.textContent||'').includes(x.project_code||'__')||(root.textContent||'').includes(x.title||'__'));
  if(!p)return;
  root.dataset.jpPaymentFinance='1';
  const box=document.createElement('div');box.className='jp-payment-review-finance';
  box.innerHTML='<div><span>Current Balance</span><b>'+peso(balance(p))+'</b></div><div><span>Overdue Fees</span><b>'+peso(p.late_fee_total||0)+'</b></div><div><span>Status</span><b class="jp-finance-tag '+statusClass(p.financial_status)+'">'+esc(p.financial_status||'—')+'</b></div>';
  const body=root.querySelector('.modal-body,.jp-suite-body,.suite-panel')||root;body.prepend(box);
}
function normalizeTables(scope=document){
  scope.querySelectorAll('table').forEach(t=>{
    if(t.dataset.jpUnified==='1')return;t.dataset.jpUnified='1';
    t.querySelectorAll('thead th:last-child').forEach(th=>{const x=(th.textContent||'').trim().toLowerCase();if(x==='actions'||x==='action'||x==='options')th.textContent=''});
    t.querySelectorAll('button').forEach(b=>{
      const txt=(b.textContent||'').trim();
      if((txt==='...'||txt==='•••'||txt==='⋯')&&!b.querySelector('svg')){b.textContent='⋮';b.setAttribute('aria-label',b.getAttribute('aria-label')||'More actions');}
    });
  });
}
function cleanEscapedText(scope=document){
  if(scope?.dataset?.jpTextCleaned==='1')return;
  const w=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(n=>{if(/\\n|\/n/.test(n.nodeValue||'')){n.nodeValue=n.nodeValue.replace(/\\n|\/n/g,' ');n.parentElement?.classList.add('jp-cleaned-escaped-newline')}});
  if(scope?.dataset)scope.dataset.jpTextCleaned='1';
}
function activeProject(){
  const st=state(),id=st.activeProjectId;
  return (st.projects||[]).find(p=>String(p.id)===String(id))||null;
}
const financeHistoryCache=new Map();
async function getProjectFinancialHistory(projectId){
  const now=Date.now(),cached=financeHistoryCache.get(projectId);
  if(cached&&now-cached.at<20000)return cached.data;
  const rt=window.JuanSuiteRuntime;if(!rt?.request)return null;
  const data=await rt.request('/api/suite',{action:'project-financial-history',project_id:projectId});
  financeHistoryCache.set(projectId,{at:now,data});return data;
}
function ledgerLabel(type){
  const map={payment:'Payment',overdue_fee:'Overdue Fee',adjustment:'Adjustment',discount:'Discount',refund:'Refund',reversal:'Reversal',rush_fee:'Rush Fee',maintenance_fee:'Maintenance Fee',workload_surcharge:'Workload Surcharge'};
  return map[type]||String(type||'Entry').replace(/_/g,' ');
}
async function enhanceFinancialHistory(){
  const tab=document.getElementById('projTab-payment-tracker');
  if(!tab||!tab.classList.contains('active'))return;
  const p=activeProject();if(!p)return;
  let card=document.getElementById('jpInvoiceSnapshotsCard');
  document.getElementById('jpFinancialLedgerCard')?.remove();
  if(!card){
    card=document.createElement('section');card.id='jpInvoiceSnapshotsCard';card.className='card jp-invoice-snapshots-card';
    card.innerHTML='<div class="card-header"><div><div class="section-kicker">INVOICES</div><h3 class="card-title">Invoice Snapshots</h3></div></div><div class="jp-invoice-snapshots-body"><div class="jp-history-loading">Loading invoice snapshots…</div></div>';
    tab.append(card);
  }
  if(card.dataset.projectId===String(p.id)&&card.dataset.loaded==='1')return;
  card.dataset.projectId=String(p.id);card.dataset.loaded='0';
  try{
    const data=await getProjectFinancialHistory(p.id);if(!data)return;
    if(card.dataset.projectId!==String(p.id))return;
    const invoices=data.invoices||[],body=card.querySelector('.jp-invoice-snapshots-body');
    body.innerHTML=invoices.length
      ?'<div class="jp-issued-invoices">'+invoices.slice(0,12).map(inv=>
        '<div class="jp-invoice-snapshot-row"><div><strong>'+esc(inv.invoice_number)+'</strong><small>'+date(inv.issued_at)+' · '+esc(inv.status||'issued')+'</small></div><div><b>'+peso(inv.total)+'</b><small>Balance '+peso(inv.balance)+'</small></div></div>'
      ).join('')+'</div>'
      :'<div class="jp-history-empty">No invoice snapshots yet.</div>';
    card.dataset.loaded='1';
  }catch(e){
    const body=card.querySelector('.jp-invoice-snapshots-body');if(body)body.innerHTML='<div class="jp-history-empty">Invoice snapshots could not be loaded.</div>';
  }
}

function enhanceDeliverablesUX(){
  const tab=document.getElementById('projTab-deliverables');if(!tab)return;
  const count=document.getElementById('projDetailProgressCount');
  if(count)count.textContent=String(count.textContent||'').replace(/(\d+)\s*\/\s*(\d+)\s*completed/i,'$1 of $2 completed');
  document.getElementById('projDetailProgressPercent')?.classList.add('jp-visually-redundant');
  tab.querySelectorAll('.deliverable-group-block.package-group').forEach(group=>{
    if(group.dataset.jpCollapsible==='1')return;group.dataset.jpCollapsible='1';
    const parent=group.querySelector(':scope > .deliverable-package-row');if(!parent)return;
    const children=[...group.querySelectorAll(':scope > .deliverable-child-row')];if(!children.length)return;
    const copy=parent.querySelector('.deliverable-checklist-copy');
    const toggle=document.createElement('button');toggle.type='button';toggle.className='jp-deliverable-group-toggle';toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Collapse package inclusions');toggle.innerHTML='<span>'+children.length+' items</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    toggle.onclick=e=>{e.stopPropagation();const collapsed=group.classList.toggle('jp-collapsed');toggle.setAttribute('aria-expanded',collapsed?'false':'true');toggle.setAttribute('aria-label',collapsed?'Expand package inclusions':'Collapse package inclusions');};
    if(copy)copy.after(toggle);else parent.append(toggle);
  });
}
function driveConfig(){return window.JUAN_GOOGLE_DRIVE_CONFIG||{}}
function driveFolderId(url){const m=String(url||'').match(/\/folders\/([^/?#]+)/i);return m?m[1]:''}
function loadExternalScript(src,id){
  return new Promise((resolve,reject)=>{if(document.getElementById(id)){resolve();return;}const s=document.createElement('script');s.id=id;s.src=src;s.async=true;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load Google Drive tools.'));document.head.append(s);});
}
let jpDriveToken=null,jpDriveTokenClient=null,jpPickerReady=false;
async function ensureDriveLibraries(){
  const cfg=driveConfig();
  if(!cfg.clientId||!cfg.apiKey||!cfg.appId)throw new Error('Google Drive connection is not configured yet.');
  await Promise.all([loadExternalScript('https://apis.google.com/js/api.js','jpGoogleApi'),loadExternalScript('https://accounts.google.com/gsi/client','jpGoogleIdentity')]);
  await new Promise((resolve,reject)=>{if(jpPickerReady){resolve();return;}if(!window.gapi){reject(new Error('Google Drive tools are unavailable.'));return;}gapi.load('picker',()=>{jpPickerReady=true;resolve();});});
  if(!jpDriveTokenClient)jpDriveTokenClient=google.accounts.oauth2.initTokenClient({client_id:cfg.clientId,scope:'https://www.googleapis.com/auth/drive.file',callback:()=>{}});
  return cfg;
}
async function driveAccessToken(){
  const cfg=await ensureDriveLibraries();if(jpDriveToken)return {cfg,token:jpDriveToken};
  return await new Promise((resolve,reject)=>{
    jpDriveTokenClient.callback=response=>{if(response?.error){reject(new Error(response.error));return;}jpDriveToken=response.access_token;resolve({cfg,token:jpDriveToken});};
    jpDriveTokenClient.requestAccessToken({prompt:'consent'});
  });
}
function renderPickedDriveFiles(docs=[]){
  const rows=document.getElementById('jpDriveFileRows');if(!rows)return;
  if(!docs.length){rows.innerHTML='<div class="jp-files-empty"><strong>No Drive files selected yet</strong><span>Use Add from Drive to choose files for this project.</span></div>';return;}
  rows.innerHTML=docs.map(doc=>'<a class="jp-file-row" href="'+esc(doc.url||'#')+'" target="_blank" rel="noopener noreferrer"><span class="jp-file-icon">'+navIcon('reports')+'</span><span class="jp-file-name"><strong>'+esc(doc.name||'Google Drive file')+'</strong><small>Google Drive</small></span><span class="jp-file-type">'+esc(doc.mimeType||'File')+'</span><span class="jp-file-open">Open</span></a>').join('');
}
window.jpOpenGoogleDrivePicker=async function(){
  try{
    const {cfg,token}=await driveAccessToken();
    const view=new google.picker.DocsView(google.picker.ViewId.DOCS);view.setMode(google.picker.DocsViewMode.LIST);
    const picker=new google.picker.PickerBuilder().enableFeature(google.picker.Feature.MULTISELECT_ENABLED).setOAuthToken(token).setDeveloperKey(cfg.apiKey).setAppId(String(cfg.appId)).addView(view).addView(new google.picker.DocsUploadView()).setCallback(data=>{
      if(data[google.picker.Response.ACTION]!==google.picker.Action.PICKED)return;
      const docs=(data[google.picker.Response.DOCUMENTS]||[]).map(d=>({id:d[google.picker.Document.ID],name:d[google.picker.Document.NAME],url:d[google.picker.Document.URL],mimeType:d[google.picker.Document.MIME_TYPE]}));
      renderPickedDriveFiles(docs);window.showToast?.(docs.length+' Drive item'+(docs.length===1?'':'s')+' selected.');
    }).build();picker.setVisible(true);
  }catch(e){window.showToast?.(e?.message||'Google Drive could not be opened.');}
};
window.jpCreateDriveFolder=async function(){
  try{await driveAccessToken();window.showToast?.('Create the project folder in Google Drive, then save its link in Drive Location.');window.open('https://drive.google.com/drive/my-drive','_blank','noopener,noreferrer');}
  catch(e){window.showToast?.(e?.message||'Google Drive could not be opened.');}
};
function enhanceProjectFilesTab(p){
  const view=document.querySelector('#view-project-details.active');if(!view||!p)return;
  const tabs=view.querySelector('.project-details-tabs'),notesBtn=tabs?.querySelector('[data-project-tab="notes"]');
  if(tabs&&!tabs.querySelector('[data-project-tab="files"]')){
    const btn=document.createElement('button');btn.className='tab-btn';btn.dataset.projectTab='files';btn.innerHTML='<span>Files</span>';btn.onclick=e=>window.app?.switchProjectTab?.('files',e);tabs.insertBefore(btn,notesBtn||null);
  }
  const notes=document.getElementById('projTab-notes'),content=notes?.parentElement;if(!content)return;
  let panel=document.getElementById('projTab-files');
  if(!panel){
    panel=document.createElement('div');panel.id='projTab-files';panel.className='tab-content';
    panel.innerHTML='<div class="jp-files-workspace"><section class="card jp-files-browser"><div class="jp-files-head"><div><div class="section-kicker">PROJECT FILES</div><h3 class="card-title">Files</h3><p>Google Drive-backed files for this project.</p></div><div class="jp-files-actions"><button type="button" class="btn btn-secondary btn-sm" id="jpDriveNewFolder">New Folder</button><button type="button" class="btn btn-primary btn-sm" id="jpDriveAdd">Add from Drive</button></div></div><div class="jp-files-toolbar"><label class="jp-files-search">'+navIcon('reports')+'<input type="search" id="jpDriveSearch" placeholder="Search project files" aria-label="Search project files"></label></div><div class="jp-file-table-head"><span>Name</span><span>Type</span><span></span></div><div id="jpDriveFileRows"></div></section><aside class="jp-files-context"><section class="card"><div class="section-kicker">GOOGLE DRIVE</div><h3 class="jp-files-side-title">Drive Location</h3><div id="jpDriveLocation" class="jp-drive-location"></div></section><section class="card"><div class="section-kicker">STORAGE</div><strong class="jp-drive-context-value">Google Drive</strong><p class="jp-drive-context-copy">Files stay in Drive. Workspace stores project information and links.</p></section><section class="card"><div class="section-kicker">RECENT ACTIVITY</div><div class="jp-drive-context-copy">Drive activity appears after the Google connection is enabled.</div></section><div id="jpProjectDriveAdminSlot"></div></aside></div>';
    content.insertBefore(panel,notes);
    panel.querySelector('#jpDriveAdd').onclick=()=>window.jpOpenGoogleDrivePicker?.();
    panel.querySelector('#jpDriveNewFolder').onclick=()=>window.jpCreateDriveFolder?.();
    panel.querySelector('#jpDriveSearch').oninput=e=>{const q=String(e.target.value||'').trim().toLowerCase();panel.querySelectorAll('.jp-file-row').forEach(row=>row.hidden=q&&!row.textContent.toLowerCase().includes(q));};
  }
  const admin=document.getElementById('projectFilesAccessCard'),slot=panel.querySelector('#jpProjectDriveAdminSlot');if(admin&&slot&&!slot.contains(admin))slot.append(admin);
  const loc=panel.querySelector('#jpDriveLocation'),folder=driveFolderId(p.drive_url);
  if(loc)loc.innerHTML=p.drive_url?'<a href="'+esc(p.drive_url)+'" target="_blank" rel="noopener noreferrer"><strong>Project Drive Folder</strong><span>Open in Google Drive</span></a>':'<div class="jp-files-empty compact"><strong>No Drive folder linked</strong><span>Save a Google Drive folder below.</span></div>';
  const rows=panel.querySelector('#jpDriveFileRows');
  if(rows&&!rows.children.length)rows.innerHTML=p.drive_url?'<a class="jp-file-row" href="'+esc(p.drive_url)+'" target="_blank" rel="noopener noreferrer"><span class="jp-file-icon">'+navIcon('projects')+'</span><span class="jp-file-name"><strong>Project Drive Folder</strong><small>'+(folder?'Linked folder':'Google Drive')+'</small></span><span class="jp-file-type">Folder</span><span class="jp-file-open">Open</span></a>':'<div class="jp-files-empty"><strong>No project files yet</strong><span>Link a Drive folder or use Add from Drive.</span></div>';
}

function enhanceProjectPage(){
  const view=document.querySelector('#view-project-details.active');if(!view)return;
  const p=activeProject();if(!p)return;
  enhanceProjectFilesTab(p);
  enhanceDeliverablesUX();
  const progress=document.getElementById('projectOverallProgress'),tabs=view.querySelector('.project-details-tabs');
  const percent=document.getElementById('projectOverallProgressPercent')?.textContent||'0%';
  const bal=balance(p),fee=Number(p.late_fee_total||0),status=p.financial_status||p.payment_status||(bal<=0?'PAID':'UNPAID');
  let summary=document.getElementById('jpProjectCompactSummary');
  if(!summary){
    summary=document.createElement('div');summary.id='jpProjectCompactSummary';summary.className='jp-project-compact-summary';
    if(progress)progress.after(summary);else if(tabs)tabs.before(summary);
  }
  summary.innerHTML='<div><span>Progress</span><strong>'+esc(percent)+' Complete</strong></div><div><span>Balance</span><strong>'+peso(bal)+'</strong></div><div><span>Status</span><strong class="jp-summary-status '+statusClass(status)+'">'+esc(status)+'</strong></div><div><span>Due</span><strong>'+date(p.payment_due_date)+'</strong></div>'+(fee>0?'<div><span>Overdue Fees</span><strong>'+peso(fee)+'</strong></div>':'');
  if(progress)progress.classList.add('jp-progress-collapsed');
  document.getElementById('jpProjectFinanceSummary')?.remove();
  if(tabs){
    const labels={'project-data':'Overview','deliverables':'Deliverables','payment-tracker':'Payments','invoice':'Invoice','files':'Files','notes':'Notes'};
    tabs.querySelectorAll('[data-project-tab]').forEach(btn=>{const span=btn.querySelector('span');if(span)span.textContent=labels[btn.dataset.projectTab]||span.textContent;});
  }
  enhanceInvoiceActions(p);
  enhanceProjectNotes();
}
async function issueInvoiceSnapshot(project){
  const rt=window.JuanSuiteRuntime;
  if(!rt?.request)throw new Error('Workspace API is not ready.');
  const out=await rt.request('/api/suite',{action:'issue-invoice',project_id:project.id});
  window.showToast?.('Invoice snapshot issued'+(out?.invoice?.invoice_number?' · '+out.invoice.invoice_number:'')+'.');
  return out;
}
function enhanceProjectNotes(){
  const tab=document.getElementById('projTab-notes');if(!tab)return;
  const textarea=tab.querySelector('textarea');if(!textarea)return;
  const host=textarea.closest('.card')||tab;
  host.querySelector(':scope > .card-title')?.classList.add('hidden');
  let wrap=host.querySelector('.jp-notes-view');
  if(!wrap){
    wrap=document.createElement('section');wrap.className='jp-notes-view';
    wrap.innerHTML='<div class="jp-notes-head"><div><div class="section-kicker">PROJECT</div><h3>Notes</h3></div><button type="button" class="btn btn-secondary btn-sm jp-notes-edit">Edit</button></div><div class="jp-notes-readable"></div>';
    host.insertBefore(wrap,textarea);
  }
  const readable=wrap.querySelector('.jp-notes-readable'),edit=wrap.querySelector('.jp-notes-edit');
  const sync=()=>{readable.textContent=textarea.value.trim()||'No notes yet.'};sync();
  textarea.classList.add('jp-notes-editor-hidden');readable.classList.remove('hidden');edit.textContent='Edit';
  if(textarea.dataset.jpNotesBound!=='1'){
    textarea.dataset.jpNotesBound='1';
    textarea.addEventListener('input',sync);
    edit.onclick=async()=>{
      const editing=textarea.classList.contains('jp-notes-editor-hidden');
      textarea.classList.toggle('jp-notes-editor-hidden',!editing);
      readable.classList.toggle('hidden',editing);
      edit.textContent=editing?'Done':'Edit';
      if(editing){textarea.focus();return;}
      try{await window.app?.saveProjectNotes?.();}catch(e){window.showToast?.(e?.message||'Notes could not be saved.');}
    };
  }
}
function enhanceInvoiceActions(p){
  const tab=document.getElementById('projTab-invoice'),bar=tab?.querySelector('.invoice-actions-bar');if(!bar||!p)return;
  if(bar.dataset.jpSaasInvoice==='1')return;
  bar.dataset.jpSaasInvoice='1';
  bar.innerHTML='<button type="button" class="btn btn-primary btn-sm" id="jpInvoicePrimaryAction">Send Balance Email</button>'+
    '<div class="popover-wrap" id="jpInvoiceMore"><button type="button" class="icon-more-button vertical-more" aria-label="More invoice actions">⋮</button>'+
    '<div class="popover-panel client-row-menu">'+
      '<button type="button" class="popover-action" data-invoice-action="snapshot">Issue Snapshot</button>'+
      '<button type="button" class="popover-action" data-invoice-action="pdf">Save as PDF</button>'+
      '<button type="button" class="popover-action" data-invoice-action="image">Save as Image</button>'+
      '<button type="button" class="popover-action" data-invoice-action="deadline">Send Deadline Reminder</button>'+
    '</div></div>';
  bar.querySelector('#jpInvoicePrimaryAction').onclick=()=>window.app?.sendBalanceReminderEmail?.();
  const more=bar.querySelector('#jpInvoiceMore .icon-more-button');
  more.onclick=e=>window.app?.togglePopover?.('jpInvoiceMore',e);
  bar.querySelector('[data-invoice-action="snapshot"]').onclick=async()=>{try{await issueInvoiceSnapshot(p)}catch(e){window.showToast?.(e?.message||String(e))}};
  bar.querySelector('[data-invoice-action="pdf"]').onclick=()=>window.app?.saveInvoicePDF?.();
  bar.querySelector('[data-invoice-action="image"]').onclick=()=>window.app?.saveInvoiceImage?.();
  bar.querySelector('[data-invoice-action="deadline"]').onclick=()=>window.app?.sendDeadlineReminderEmail?.();
}
function enhancePaymentsPage(){
  const view=document.querySelector('#view-payments.active');if(!view)return;
  view.querySelectorAll('tbody tr').forEach(row=>{
    if(row.dataset.jpFinancialRow==='1')return;
    row.dataset.jpFinancialRow='1';
    const cells=[...row.cells];if(cells.length<8)return;
    const statusCell=cells[7],text=(statusCell?.textContent||'').trim().toUpperCase();
    if(!text)return;
    statusCell.classList.add('jp-financial-status-cell',statusClass(text));
  });
}
function enhanceSettingsPage(){
  const view=document.querySelector('#view-settings.active');if(!view)return;
  view.querySelectorAll('.jp-settings-segment').forEach(seg=>seg.setAttribute('tabindex','-1'));
}

function ensureSaaSStyles(){
  if(document.getElementById('jpSaaSRefreshStyles'))return;
  const link=document.createElement('link');
  link.id='jpSaaSRefreshStyles';link.rel='stylesheet';link.href='/css/saas-refresh-2026-10-02.css?v=20261002-ultra-approved-1';
  document.head.append(link);
}
function navIcon(name){
  const paths={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9.5 21v-7h5v7"/>',
    projects:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M8 5V3h8v2M7 10h10M7 14h7"/>',
    clients:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.7M16 3.3a4 4 0 0 1 0 7.4"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    finance:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
    reports:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
    services:'<path d="M4 7h16l-1 14H5L4 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/>',
    online:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1.1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8L4.3 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.8A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"/>'
  };
  return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||'')+'</svg>';
}
function makeNavLabel(text){
  const el=document.createElement('div');el.className='nav-section-label';el.textContent=text;return el;
}
function restructureSaaSSidebar(){
  const menu=document.querySelector('.nav-menu');if(!menu)return;
  const byView={};
  menu.querySelectorAll('.nav-item').forEach(el=>{if(el.dataset.view)byView[el.dataset.view]=el;});
  if(menu.dataset.jpSaasNav!=='ultra-2'){
    const spec=[
      ['WORK',[
        ['my-works','Home','home'],['projects','Projects','projects'],['clients','Clients','clients']
      ]],
      ['FINANCE',[
        ['payments','Finance','finance'],['reports','Reports','reports']
      ]],
      ['OPERATIONS',[
        ['calendar','Calendar','calendar'],['pricelist','Services & Pricing','services'],['online-portal','Online','online']
      ]],
      ['SYSTEM',[
        ['settings','Settings','settings']
      ]]
    ];
    menu.innerHTML='';
    spec.forEach(group=>{
      menu.append(makeNavLabel(group[0]));
      group[1].forEach(item=>{
        const el=byView[item[0]];if(!el)return;
        el.innerHTML='<span class="icon">'+navIcon(item[2])+'</span><span class="nav-label">'+item[1]+'</span>';
        el.title=item[1];el.removeAttribute('id');
        if(item[0]==='online-portal')el.id='jpOnlineNav';
        menu.append(el);
      });
    });
    menu.dataset.jpSaasNav='ultra-2';
  }
  const brand=document.querySelector('.brand');
  if(brand){
    const title=brand.querySelector('.brand-title'),sub=brand.querySelector('.brand-subtitle-large');
    if(title)title.textContent='JUAN PROJECT';
    if(sub)sub.innerHTML='WORKSPACE ULTRA <span class="jp-private-badge">PRIVATE</span>';
    const status=document.getElementById('connectionStatusIndicator');
    if(status){status.classList.add('jp-compact-connection');const st=status.querySelector('#statusText');if(st)st.textContent=/offline/i.test(st.textContent||'')?'Offline':'Connected';}
  }
  syncSaaSNavActive();
}
function syncSaaSNavActive(){
  const st=state(),active=String(st.activeView||'my-works');
  document.querySelectorAll('.nav-menu .nav-item').forEach(el=>el.classList.remove('active'));
  const view=active==='in-house-ads'?'online-portal':active;
  document.querySelector('.nav-menu .nav-item[data-view="'+view+'"]')?.classList.add('active');
}
function standardizePageNames(){
  const names={
    'view-my-works':['Workspace','Home'],
    'view-payments':['Billing & Collections','Finance'],
    'view-pricelist':['Catalog','Services & Pricing'],
    'view-reports':['Finance & Insights','Reports']
  };
  Object.entries(names).forEach(entry=>{
    const root=document.getElementById(entry[0]);if(!root)return;
    const sub=root.querySelector('.greeting-subtitle'),title=root.querySelector('.page-title');
    if(sub)sub.textContent=entry[1][0];if(title)title.textContent=entry[1][1];
  });
}
function syncCatalogPanel(panel='all'){
  const view=document.getElementById('view-pricelist');if(!view)return;
  const tabs=view.querySelector('.jp-catalog-tabs');
  tabs?.querySelectorAll('button').forEach(x=>{const active=x.dataset.catalogPanel===panel;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false');});
  const map={all:'All',services:'Services',packages:'Packages'};
  window.app?.setCatalogManagerFilter?.(map[panel]||'All');
}
function enhanceServicesPricing(){
  const view=document.querySelector('#view-pricelist.active');if(!view)return;
  const header=view.querySelector('.page-header');if(!header)return;
  const title=header.querySelector('.page-title'),sub=header.querySelector('.greeting-subtitle');
  if(title)title.textContent='Services & Pricing';if(sub)sub.textContent='Catalog';
  let desc=header.querySelector('.jp-services-description');
  if(!desc){desc=document.createElement('p');desc.className='jp-services-description';header.querySelector('div')?.append(desc);}
  desc.textContent='Manage services, packages, and pricing shared with JUAN PROJECT Online.';
  let tabs=view.querySelector('.jp-catalog-tabs');
  if(!tabs){
    tabs=document.createElement('div');tabs.className='jp-catalog-tabs';tabs.setAttribute('role','tablist');
    tabs.innerHTML='<button type="button" role="tab" data-catalog-panel="all" class="active">All</button><button type="button" role="tab" data-catalog-panel="services">Services</button><button type="button" role="tab" data-catalog-panel="packages">Packages</button>';
    const toolbar=view.querySelector('.catalog-toolbar');if(toolbar)toolbar.before(tabs);else header.after(tabs);
    tabs.querySelectorAll('button').forEach(btn=>btn.onclick=()=>syncCatalogPanel(btn.dataset.catalogPanel));
  }
  const active=tabs.querySelector('button.active')?.dataset.catalogPanel||'all';
  syncCatalogPanel(active);
}
function makeOnlineTabs(active){
  const tabs=document.createElement('div');tabs.className='jp-online-tabs';tabs.setAttribute('role','tablist');
  tabs.innerHTML='<button type="button" data-online-view="online-portal">Portal</button><button type="button" data-online-view="in-house-ads">In-House Ads</button>';
  tabs.querySelectorAll('button').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.onlineView===active);
    btn.setAttribute('aria-selected',btn.dataset.onlineView===active?'true':'false');
    btn.onclick=()=>window.app?.navigateTo?.(btn.dataset.onlineView);
  });
  return tabs;
}
function ensureOnlineTabs(){
  const portal=document.getElementById('view-online-portal');
  if(portal){
    const header=portal.querySelector('.page-header');
    const sub=header?.querySelector('.greeting-subtitle'),title=header?.querySelector('.page-title');
    if(sub)sub.textContent='Online';if(title)title.textContent='Online';
    let tabs=portal.querySelector(':scope > .jp-online-tabs');
    if(!tabs&&header){tabs=makeOnlineTabs('online-portal');header.after(tabs);}
    tabs?.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',btn.dataset.onlineView==='online-portal'));
  }
  const ads=document.getElementById('view-in-house-ads');
  if(ads){
    let header=ads.querySelector(':scope > .jp-online-shell-header');
    if(!header){
      header=document.createElement('header');header.className='page-header jp-online-shell-header';
      header.innerHTML='<div><div class="greeting-subtitle">Online</div><h1 class="page-title">Online</h1></div>';
      ads.prepend(header);
    }
    let tabs=ads.querySelector(':scope > .jp-online-tabs');
    if(!tabs){tabs=makeOnlineTabs('in-house-ads');header.after(tabs);}
    tabs.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',btn.dataset.onlineView==='in-house-ads'));
  }
}
const reportFilters={search:'',date:'all',method:'all',sort:'newest'};
function reportData(){
  const st=state(),projects=(st.projects||[]).filter(p=>p&&!p.deleted),payments=[],seen=new Set();
  projects.forEach(p=>(p.payments||[]).filter(x=>x&&!x.deleted_at).forEach(pay=>{
    const id=String(pay.id||'');if(id)seen.add(id);payments.push(Object.assign({},pay,{project_id:pay.project_id||p.id}));
  }));
  (st.payments||[]).filter(x=>x&&!x.deleted_at).forEach(pay=>{const id=String(pay.id||'');if(!id||!seen.has(id))payments.push(pay);});
  return {st,projects,payments};
}
function reportPaymentDate(pay){const raw=pay.payment_date||pay.created_at||pay.updated_at;if(!raw)return null;const d=new Date(raw);return Number.isNaN(d.getTime())?null:d}
function reportProjectCode(p){return p?.project_code||p?.legacy_reference||p?.reference_no||'—'}
function reportRowsHTML(data){
  const q=reportFilters.search.trim().toLowerCase(),now=new Date(),projectMap=new Map(data.projects.map(p=>[String(p.id),p]));
  const clientMap=new Map((data.st.clients||[]).map(x=>[String(x.id),x]));
  let list=data.payments.slice().filter(pay=>{
    const p=projectMap.get(String(pay.project_id||'')),client=clientMap.get(String(pay.client_id||p?.client_id||''));
    const method=String(pay.payment_method||pay.method||'Payment'),d=reportPaymentDate(pay);
    if(reportFilters.method!=='all'&&method!==reportFilters.method)return false;
    if(reportFilters.date!=='all'){
      if(!d)return false;
      if(reportFilters.date==='this-month'&&(d.getFullYear()!==now.getFullYear()||d.getMonth()!==now.getMonth()))return false;
      if(reportFilters.date==='30-days'&&(now.getTime()-d.getTime()>30*86400000))return false;
      if(reportFilters.date==='this-year'&&d.getFullYear()!==now.getFullYear())return false;
    }
    if(q){
      const hay=[pay.reference_no,pay.reference_number,method,pay.notes,p?.project_code,p?.title,p?.client_name,client?.name].join(' ').toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });
  list.sort((a,b)=>{
    const at=reportPaymentDate(a)?.getTime()||0,bt=reportPaymentDate(b)?.getTime()||0;
    return reportFilters.sort==='oldest'?at-bt:bt-at;
  });
  const count=document.getElementById('jpPaymentActivityCount');if(count)count.textContent=list.length+' payment'+(list.length===1?'':'s');
  if(!list.length)return '<tr><td colspan="9" class="jp-payment-activity-empty">No payments match the current filters.</td></tr>';
  return list.map(pay=>{
    const p=projectMap.get(String(pay.project_id||'')),client=clientMap.get(String(pay.client_id||p?.client_id||''));
    const method=String(pay.payment_method||pay.method||'Payment');
    const type=String(pay.type||pay.payment_type||(/adjust/i.test(method)?'Adjustment':'Payment'));
    const status=String(pay.status||'Recorded');
    const ref=pay.reference_no||pay.reference_number||'—';
    const clientName=client?.name||p?.client_name||'—',projectTitle=p?.title||'—',projectCode=reportProjectCode(p);
    const action=p?'<button type="button" class="jp-open-record" data-project-id="'+esc(p.id)+'" aria-label="Open payment record">'+navIcon('reports')+'</button>':'—';
    return '<tr><td class="jp-date-cell">'+date(pay.payment_date||pay.created_at)+'</td><td><span class="jp-activity-ref">'+esc(ref)+'</span></td><td>'+esc(clientName)+'</td><td class="jp-activity-project"><strong>'+esc(projectTitle)+'</strong><small>'+esc(projectCode)+'</small></td><td>'+esc(method)+'</td><td>'+esc(type)+'</td><td><strong>'+peso(Number(pay.amount_paid??pay.amount??0))+'</strong></td><td><span class="jp-payment-status">'+esc(status)+'</span></td><td>'+action+'</td></tr>';
  }).join('');
}
function drawReportRows(data){
  const body=document.getElementById('jpPaymentActivityRows');if(!body)return;
  body.innerHTML=reportRowsHTML(data);
  body.querySelectorAll('[data-project-id]').forEach(btn=>btn.onclick=()=>window.app?.openProjectDetails?.(btn.dataset.projectId,'payment-tracker'));
}
function renderSaaSReports(){
  const box=document.getElementById('reportsContent');if(!box)return;
  const data=reportData(),safeNumber=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const totalReceivables=data.projects.reduce((sum,p)=>sum+Math.max(0,safeNumber(p.total_amount))+Math.max(0,safeNumber(p.late_fee_total)),0);
  const collected=data.payments.reduce((sum,p)=>sum+Math.max(0,safeNumber(p.amount_paid??p.amount)),0);
  const outstanding=Math.max(0,totalReceivables-collected);
  const rate=totalReceivables?Math.round(Math.max(0,Math.min(100,collected/totalReceivables*100))):0;
  const methods=[...new Set(data.payments.map(p=>String(p.payment_method||p.method||'Payment')).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  box.innerHTML=
    '<div class="jp-report-kpi-grid">'+
      '<section class="card jp-report-kpi"><span>Total Receivables</span><div><strong>'+peso(totalReceivables)+'</strong><small>Total amount expected from customers</small></div></section>'+
      '<section class="card jp-report-kpi"><span>Collected</span><div><strong>'+peso(collected)+'</strong><small>'+rate+'% of total receivables collected</small></div></section>'+
      '<section class="card jp-report-kpi"><span>Outstanding</span><div><strong>'+peso(outstanding)+'</strong><small>Remaining balance to be collected</small></div></section>'+
    '</div>'+
    '<section class="card jp-payment-activity">'+
      '<div class="jp-payment-activity-head"><div><h2>Payment Activity</h2><p>Complete recorded payment history with project and client details.</p></div><span class="jp-payment-count" id="jpPaymentActivityCount"></span></div>'+
      '<div class="jp-payment-toolbar">'+
        '<input id="jpPaymentSearch" type="search" placeholder="Search reference, client, project…" value="'+esc(reportFilters.search)+'">'+
        '<select id="jpPaymentDateFilter"><option value="all">All dates</option><option value="this-month">This month</option><option value="30-days">Last 30 days</option><option value="this-year">This year</option></select>'+
        '<select id="jpPaymentMethodFilter"><option value="all">All methods</option>'+methods.map(m=>'<option value="'+esc(m)+'">'+esc(m)+'</option>').join('')+'</select>'+
        '<select id="jpPaymentSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>'+
      '</div>'+
      '<div class="jp-payment-activity-scroll"><table class="data-table unified-table jp-payment-activity-table"><thead><tr><th>Date</th><th>Reference</th><th>Client</th><th>Project</th><th>Payment Method</th><th>Type</th><th>Amount</th><th>Status</th><th aria-label="Open"></th></tr></thead><tbody id="jpPaymentActivityRows"></tbody></table></div>'+
    '</section>';
  const dateFilter=document.getElementById('jpPaymentDateFilter'),methodFilter=document.getElementById('jpPaymentMethodFilter'),sort=document.getElementById('jpPaymentSort'),search=document.getElementById('jpPaymentSearch');
  if(dateFilter)dateFilter.value=reportFilters.date;
  if(methodFilter)methodFilter.value=methods.includes(reportFilters.method)?reportFilters.method:'all';
  if(sort)sort.value=reportFilters.sort;
  if(search)search.oninput=()=>{reportFilters.search=search.value||'';drawReportRows(data)};
  if(dateFilter)dateFilter.onchange=()=>{reportFilters.date=dateFilter.value;drawReportRows(data)};
  if(methodFilter)methodFilter.onchange=()=>{reportFilters.method=methodFilter.value;drawReportRows(data)};
  if(sort)sort.onchange=()=>{reportFilters.sort=sort.value;drawReportRows(data)};
  drawReportRows(data);
}
function minimizeLoading(){
  const shell=document.getElementById('workspaceLoadingSkeleton');if(shell)shell.classList.add('hidden');
  const loader=document.getElementById('onlinePortalLoading');
  if(loader){
    const hasData=Boolean(document.querySelector('#onlinePortalAccountRows tr')||document.querySelector('#onlinePortalAccountSummary>*')||document.querySelector('#onlinePortalPaymentRows tr'));
    loader.classList.toggle('jp-redundant-loading',hasData);
  }
}
let loadingGuardBound=false;
function bindLoadingGuard(){
  if(loadingGuardBound)return;loadingGuardBound=true;
  const loader=document.getElementById('onlinePortalLoading');
  if(loader)new MutationObserver(minimizeLoading).observe(loader,{attributes:true,attributeFilter:['class']});
}

function enhanceModals(){
  document.querySelectorAll('[role="dialog"],.modal,.jp-suite-modal,.suite-panel,.modal-card').forEach(d=>enhancePaymentReview(d));
}
let scheduled=false;
function run(){
  scheduled=false;
  ensureSaaSStyles();
  restructureSaaSSidebar();
  standardizePageNames();
  ensureOnlineTabs();
  syncSaaSNavActive();
  minimizeLoading();
  const active=document.querySelector('.view.active')?.id||'';
  cleanEscapedText(document.querySelector('.view.active')||document);
  normalizeTables(document.querySelector('.view.active')||document);
  enhanceModals();
  if(active==='view-project-details'){enhanceProjectPage();enhanceFinancialHistory();}
  else if(active==='view-payments')enhancePaymentsPage();
  else if(active==='view-reports')renderSaaSReports();
  else if(active==='view-pricelist')enhanceServicesPricing();
  else if(active==='view-settings')enhanceSettingsPage();
}
function scheduleRun(){
  if(scheduled)return;scheduled=true;requestAnimationFrame(run);
}
function patchAppHooks(){
  const app=window.app;if(!app||app.__jpPerformanceHooks)return;
  app.__jpPerformanceHooks=true;
  ['navigateTo','openProjectDetails','switchProjectTab','renderPaymentsView','renderProjects','renderClients','renderOnlinePortal','loadOnlinePortalData','renderPricelist'].forEach(name=>{
    const fn=app[name];if(typeof fn!=='function')return;
    app[name]=function(...args){
      const out=fn.apply(this,args);
      Promise.resolve(out).finally(scheduleRun);
      return out;
    };
  });
}
document.addEventListener('DOMContentLoaded',()=>{ensureSaaSStyles();patchAppHooks();restructureSaaSSidebar();bindLoadingGuard();scheduleRun();});
document.addEventListener('click',e=>{
  if(e.target.closest('.nav-item,[data-project-tab],[data-settings-tab],[role="dialog"],.icon-more-button,.table-action-button,.jp-online-tabs'))scheduleRun();
},true);
window.addEventListener('juan:realtime-sync',scheduleRun);
window.addEventListener('focus',()=>{if(!document.hidden)scheduleRun();});
setTimeout(()=>{ensureSaaSStyles();patchAppHooks();restructureSaaSSidebar();bindLoadingGuard();scheduleRun();},250);
})();