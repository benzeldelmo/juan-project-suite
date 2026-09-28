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
  let card=document.getElementById('jpFinancialLedgerCard');
  if(!card){
    card=document.createElement('section');card.id='jpFinancialLedgerCard';card.className='card jp-financial-ledger-card';
    card.innerHTML='<div class="card-header"><div><div class="section-kicker">AUDIT</div><h3 class="card-title">Financial Ledger</h3></div></div><div class="jp-financial-ledger-body"><div class="jp-history-loading">Loading financial history…</div></div>';
    tab.append(card);
  }
  if(card.dataset.projectId===String(p.id)&&card.dataset.loaded==='1')return;
  card.dataset.projectId=String(p.id);card.dataset.loaded='0';
  try{
    const data=await getProjectFinancialHistory(p.id);if(!data)return;
    if(card.dataset.projectId!==String(p.id))return;
    const ledger=data.ledger||[],invoices=data.invoices||[],notifications=data.notifications||[],body=card.querySelector('.jp-financial-ledger-body');
    body.innerHTML=
      '<div class="jp-ledger-summary">'+
        '<div><span>Ledger Entries</span><b>'+ledger.length+'</b></div>'+
        '<div><span>Issued Invoices</span><b>'+invoices.filter(x=>x.status!=='void').length+'</b></div>'+
        '<div><span>Latest Invoice</span><b>'+esc(invoices[0]?.invoice_number||'—')+'</b></div>'+
      '</div>'+
      (ledger.length?'<div class="jp-ledger-list">'+ledger.slice(0,12).map(x=>
        '<div class="jp-ledger-row"><div><strong>'+esc(ledgerLabel(x.entry_type))+'</strong><small>'+esc(x.note||'Financial update')+' · '+date(x.occurred_at)+'</small></div><b class="'+(x.direction==='credit'?'credit':'debit')+'">'+(x.direction==='credit'?'- ':'+ ')+peso(x.amount)+'</b></div>'
      ).join('')+'</div>':'<div class="jp-history-empty">No financial ledger entries yet.</div>')+
      (invoices.length?'<div class="jp-issued-invoices"><h4>Invoice Snapshots</h4>'+invoices.slice(0,6).map(inv=>
        '<div class="jp-invoice-snapshot-row"><div><strong>'+esc(inv.invoice_number)+'</strong><small>'+date(inv.issued_at)+' · '+esc(inv.status||'issued')+'</small></div><div><b>'+peso(inv.total)+'</b><small>Balance '+peso(inv.balance)+'</small></div></div>'
      ).join('')+'</div>':'')+
      (notifications.length?'<div class="jp-client-events"><h4>Client & Payment Events</h4><div class="jp-client-event-list">'+notifications.slice(0,10).map(n=>
        '<div class="jp-client-event"><i class="jp-client-event-dot '+esc(n.severity||'info')+'"></i><div class="jp-client-event-copy"><strong>'+esc(n.title||n.type||'Event')+'</strong><small>'+esc(n.body||'')+'</small></div><time>'+date(n.created_at)+'</time></div>'
      ).join('')+'</div></div>':'');
    card.dataset.loaded='1';
  }catch(e){
    const body=card.querySelector('.jp-financial-ledger-body');if(body)body.innerHTML='<div class="jp-history-empty">Financial history could not be loaded.</div>';
  }
}
function enhanceProjectPage(){
  const view=document.querySelector('#view-project-details.active');if(!view)return;
  const p=activeProject();if(!p)return;
  const sig=[p.id,p.total_amount,p.late_fee_total,p.financial_status,p.payment_due_date,p.grace_period_end,p.overdue_started_at,(p.payments||[]).length].join('|');
  let panel=document.getElementById('jpProjectFinanceSummary');
  if(!panel||panel.dataset.signature!==sig){
    const wrap=document.createElement('div');wrap.innerHTML=financeHTML(p);
    const fresh=wrap.firstElementChild;fresh.id='jpProjectFinanceSummary';fresh.dataset.signature=sig;
    if(panel)panel.replaceWith(fresh);
    else{
      const progress=document.getElementById('projectOverallProgress');
      const tabs=view.querySelector('.project-details-tabs');
      if(progress)progress.after(fresh);else if(tabs)tabs.before(fresh);
    }
  }
  enhanceInvoiceActions(p);
}
async function issueInvoiceSnapshot(project){
  const rt=window.JuanSuiteRuntime;
  if(!rt?.request)throw new Error('Workspace API is not ready.');
  const out=await rt.request('/api/suite',{action:'issue-invoice',project_id:project.id});
  window.showToast?.('Invoice snapshot issued'+(out?.invoice?.invoice_number?' · '+out.invoice.invoice_number:'')+'.');
  return out;
}
function enhanceInvoiceActions(p){
  const tab=document.getElementById('projTab-invoice'),bar=tab?.querySelector('.invoice-actions-bar');if(!bar||!p)return;
  let btn=document.getElementById('jpIssueInvoiceSnapshot');
  if(!btn){
    btn=document.createElement('button');btn.id='jpIssueInvoiceSnapshot';btn.className='btn btn-secondary btn-sm';
    const icon=window.JuanWorkspaceIcon?.('file','sm')||'';
    btn.innerHTML=icon+'<span>Issue Snapshot</span>';
    bar.prepend(btn);
  }
  btn.onclick=async()=>{
    if(btn.disabled)return;btn.disabled=true;
    const old=btn.innerHTML;btn.textContent='Issuing…';
    try{await issueInvoiceSnapshot(p)}catch(e){window.showToast?.(e?.message||String(e))}
    finally{btn.disabled=false;btn.innerHTML=old;}
  };
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
function enhanceModals(){
  document.querySelectorAll('[role="dialog"],.modal,.jp-suite-modal,.suite-panel,.modal-card').forEach(d=>enhancePaymentReview(d));
}
let scheduled=false;
function run(){
  scheduled=false;
  const active=document.querySelector('.view.active')?.id||'';
  cleanEscapedText(document.querySelector('.view.active')||document);
  normalizeTables(document.querySelector('.view.active')||document);
  enhanceModals();
  if(active==='view-project-details'){enhanceProjectPage();enhanceFinancialHistory();}
  else if(active==='view-payments')enhancePaymentsPage();
  else if(active==='view-settings')enhanceSettingsPage();
}
function scheduleRun(){
  if(scheduled)return;scheduled=true;requestAnimationFrame(run);
}
function patchAppHooks(){
  const app=window.app;if(!app||app.__jpPerformanceHooks)return;
  app.__jpPerformanceHooks=true;
  ['navigateTo','openProjectDetails','switchProjectTab','renderPaymentsView','renderProjects','renderClients'].forEach(name=>{
    const fn=app[name];if(typeof fn!=='function')return;
    app[name]=function(...args){
      const out=fn.apply(this,args);
      Promise.resolve(out).finally(scheduleRun);
      return out;
    };
  });
}
document.addEventListener('DOMContentLoaded',()=>{patchAppHooks();scheduleRun();});
document.addEventListener('click',e=>{
  if(e.target.closest('.nav-item,[data-project-tab],[data-settings-tab],[role="dialog"],.icon-more-button,.table-action-button'))scheduleRun();
},true);
window.addEventListener('juan:realtime-sync',scheduleRun);
window.addEventListener('focus',()=>{if(!document.hidden)scheduleRun();});
setTimeout(()=>{patchAppHooks();scheduleRun();},250);
})();