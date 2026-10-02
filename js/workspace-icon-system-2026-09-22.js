(()=>{'use strict';
const paths={
  home:'<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M9 21v-7h6v7"></path>',
  folder:'<path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  plusCircle:'<circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path>',
  clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"></rect><path d="M9 4.5V3h6v1.5"></path><path d="M8 9h8M8 13h8M8 17h5"></path>',
  card:'<rect x="2.5" y="5" width="19" height="14" rx="2"></rect><path d="M2.5 10h19"></path><path d="M6 15h4"></path>',
  chart:'<path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20H2"></path>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path>',
  tag:'<path d="M20 13 11 22l-9-9V4h9z"></path><circle cx="7.5" cy="8.5" r="1"></circle>',
  monitor:'<rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M8 22h8M12 18v4"></path>',
  image:'<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="8.5" cy="10" r="1.5"></circle><path d="m21 15-4.5-4.5L8 19"></path>',
  settings:'<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21h-4v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.39.32.75.6 1H21v4h-.05a1.7 1.7 0 0 0-1.55 1z"></path>',
  x:'<path d="M6 6l12 12M18 6 6 18"></path>',
  more:'<circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle>',
  arrowLeft:'<path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path>',
  arrowRight:'<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
  check:'<path d="m5 12 4 4L19 6"></path>',
  refresh:'<path d="M20 11a8 8 0 0 0-14.9-4"></path><path d="M4 4v5h5"></path><path d="M4 13a8 8 0 0 0 14.9 4"></path><path d="M20 20v-5h-5"></path>',
  file:'<path d="M6 2h8l4 4v16H6z"></path><path d="M14 2v5h5"></path>',
  qr:'<rect x="3" y="3" width="6" height="6" rx="1"></rect><rect x="15" y="3" width="6" height="6" rx="1"></rect><rect x="3" y="15" width="6" height="6" rx="1"></rect><path d="M15 15h3v3h-3zM18 18h3v3h-3M18 15h3"></path>',
  camera:'<path d="M4 7h3l2-3h6l2 3h3v13H4z"></path><circle cx="12" cy="13" r="4"></circle>',
  stop:'<rect x="7" y="7" width="10" height="10" rx="1"></rect>',
  link:'<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"></path>',
  upload:'<path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 20h14"></path>',
  info:'<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
  trash:'<path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="m7 7 1 14h8l1-14"></path><path d="M10 11v6M14 11v6"></path>',
  edit:'<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"></path>',
  project:'<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M8 9h8M8 13h5M8 17h3"></path>',
  wallet:'<path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6z"></path><path d="M4 6V4h12"></path><path d="M16 12h4"></path>',
  clock:'<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
  user:'<circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6"></path>',
  building:'<path d="M4 21V5h10v16"></path><path d="M14 9h6v12"></path><path d="M7 8h2M7 12h2M7 16h2M17 12h1M17 16h1"></path>',
  database:'<ellipse cx="12" cy="5" rx="7" ry="3"></ellipse><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"></path><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"></path>',
  appearance:'<path d="M4 20 16.5 7.5"></path><path d="m14 5 5 5"></path><path d="M6 18 4 20l2-5 10-10 3 3-10 10-3 0Z"></path>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
  shieldCheck:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"></path><path d="m9.5 12 1.7 1.7 3.6-4"></path>',
  search:'<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>'
};
function svg(name,cls=''){return '<svg class="jp-family-icon '+cls+'" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.project)+'</svg>'}
window.JuanWorkspaceIcon=(name,cls='')=>svg(name,cls);

const navMap={
  'Overview':'home','Projects':'folder','Clients':'users','New Order':'plusCircle','Orders':'clipboard',
  'Invoices & Payments':'card','Reports':'chart','Calendar':'calendar','Shop':'tag',
  'Online Portal':'monitor','In-House Ads':'image','Settings':'settings'
};
function normalizeNav(){
  document.querySelectorAll('.nav-item').forEach(a=>{
    const label=(a.textContent||'').trim().replace(/\s+/g,' ');
    const name=navMap[label];if(!name)return;
    const holder=a.querySelector('.icon');if(holder)holder.innerHTML=svg(name);
  });
}
function iconOnly(el,name){
  if(!el||el.dataset.jpIconFamily==='1')return;
  el.dataset.jpIconFamily='1';el.innerHTML=svg(name);el.classList.add('jp-family-icon-button');
}
function replaceGlyphs(scope=document){
  scope.querySelectorAll('.jp-suite-close,[data-close],.jp-settings-modal-x,.modal-close,.close-modal,[aria-label="Close"]').forEach(el=>iconOnly(el,'x'));
  scope.querySelectorAll('.icon-more-button,.vertical-more,.table-action-button,.jp-icon-button').forEach(el=>iconOnly(el,'more'));
  scope.querySelectorAll('button,a').forEach(el=>{
    if(el.closest('.nav-item'))return;
    const raw=(el.textContent||'').trim();
    if(raw==='←'||raw==='← Back'||raw.startsWith('← Back')){const txt=raw.replace(/^←\s*/,'');el.innerHTML=svg('arrowLeft')+(txt?'<span>'+txt+'</span>':'');return}
    if(raw==='→'){iconOnly(el,'arrowRight');return}
    if(raw==='Refresh'){el.innerHTML=svg('refresh')+'<span>Refresh</span>';return}
    if(raw==='Record Payment'){el.innerHTML=svg('plusCircle')+'<span>Record Payment</span>';return}
    if(raw==='Mark as Delivered'){el.innerHTML=svg('check')+'<span>Mark as Delivered</span>';return}
    if(/^\+\s*New\s+/i.test(raw)){el.innerHTML=svg('plusCircle')+'<span>'+raw.replace(/^\+\s*/,'')+'</span>';return}
    if(raw.includes('✓ Completed')){el.innerHTML=svg('check')+'<span>Completed</span>';return}
    if(raw==='View All →'){el.innerHTML='<span>View All</span>'+svg('arrowRight');return}
  });
  scope.querySelectorAll('.jp-summary-icon').forEach(el=>{
    const row=el.closest('.jp-client-summary-row'),label=(row?.querySelector('span')?.textContent||'').trim();
    const name=label==='Total Projects'?'grid':label==='Total Project Value'?'wallet':label==='Total Paid'?'check':label==='Outstanding Balance'?'clock':null;
    if(name)el.innerHTML=svg(name);
  });
  scope.querySelectorAll('.jp-scanner-support').forEach(el=>{if(el.textContent.trim().startsWith('ⓘ'))el.innerHTML=svg('info')+'<span>'+el.textContent.trim().replace(/^ⓘ\s*/,'')+'</span>'});
}
function unifyExistingSvgs(scope=document){
  scope.querySelectorAll('svg.icon-svg').forEach(s=>{
    s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width','1.8');
    s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');
  });
}
let queued=false;
function run(){
  queued=false;normalizeNav();
  const active=document.querySelector('.view.active');
  if(active){replaceGlyphs(active);unifyExistingSvgs(active);}
  document.querySelectorAll('[role="dialog"],.modal.show,.jp-suite-overlay,.suite-overlay').forEach(scope=>{replaceGlyphs(scope);unifyExistingSvgs(scope)});
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
document.addEventListener('DOMContentLoaded',schedule);
document.addEventListener('click',e=>{
  if(e.target.closest('.nav-item,button,[data-settings-tab],[data-project-tab]'))schedule();
},true);
window.addEventListener('juan:realtime-sync',schedule);
setTimeout(schedule,200);
})();