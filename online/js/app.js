// JUAN PROJECT Online release sync: 2026-09-20
import {getSupabase,session,signIn,setPassword,changePasswordWithCurrent,sendPasswordReset,signOut} from './auth.js';
import {getPortal,getCatalog,markPasswordSet,setProfilePhoto} from './data.js';
import {uploadReceipt,submitPayment as submitPaymentApi} from './payments.js';
import {peso,esc,fmtDate,remaining,toast} from './utils.js';
import {PAYMENT_INSTITUTIONS,getPaymentInstitution,validatePaymentReference,sanitizePaymentReference} from './payment-institutions.js';

const root=document.getElementById('root');
const QR_FALLBACK='/assets/unionbank-bankqr-placeholder.jpg';
const REMEMBERED_CLIENT_KEY='JUAN_REMEMBERED_CLIENT';

let state={
  route:'home',portal:null,selected:null,receiptPath:null,extractedReceipt:null,
  catalog:{categories:[],services:[],packages:[],packageItems:[]},catalogLoaded:false,
  gateOpen:false,orderFilter:'requests',shopItem:null,paymentProjectId:null,
  shopQuery:'',shopSort:'default',shopCategory:'all',paymentFlow:'',
  notificationOpen:false,senderInstitution:'',guestGateContext:'default',receiptPreviewUrl:'',receiptPreviewType:'',receiptPreviewName:'',clientMessage:null,pendingClientMessage:null
};
window.JPOAppState=state;

let portalRealtimeChannel=null;
let portalRealtimeRefreshTimer=null;
let portalRealtimeFallbackTimer=null;
let portalRealtimeRefreshInFlight=false;
let portalRealtimeRefreshQueued=false;
let portalRealtimeLastEvent=null;

function stopPortalRealtimeSync(){
  if(portalRealtimeRefreshTimer){clearTimeout(portalRealtimeRefreshTimer);portalRealtimeRefreshTimer=null;}
  if(portalRealtimeFallbackTimer){clearInterval(portalRealtimeFallbackTimer);portalRealtimeFallbackTimer=null;}
  const channel=portalRealtimeChannel;portalRealtimeChannel=null;
  if(channel){getSupabase().then(sb=>sb.removeChannel(channel)).catch(()=>{});}
}

function schedulePortalRealtimeRefresh(eventRow=null,delay=280){
  if(eventRow){portalRealtimeLastEvent=eventRow;showPortalBrowserNotification(eventRow).catch(()=>{});}
  if(!state.portal?.profile||navigator.onLine===false)return;
  if(portalRealtimeRefreshTimer)clearTimeout(portalRealtimeRefreshTimer);
  portalRealtimeRefreshTimer=setTimeout(()=>{portalRealtimeRefreshTimer=null;refreshPortalFromRealtime(portalRealtimeLastEvent);portalRealtimeLastEvent=null;},delay);
}

function portalRealtimeCanRender(){
  const el=document.activeElement;
  if(!el)return true;
  return !['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
}

async function refreshPortalFromRealtime(eventRow=null){
  if(!state.portal?.profile||navigator.onLine===false)return false;
  if(portalRealtimeRefreshInFlight){portalRealtimeRefreshQueued=true;return false;}
  portalRealtimeRefreshInFlight=true;
  try{
    const entity=String(eventRow?.entity||'');
    const clientId=String(state.portal.profile.id||'');
    if(eventRow?.client_id&&String(eventRow.client_id)!==clientId)return true;
    const portalPromise=getPortal();
    const catalogPromise=entity.startsWith('catalog_')?getCatalog():Promise.resolve(null);
    const [portal,catalog]=await Promise.all([portalPromise,catalogPromise]);
    state.portal=portal;
    if(catalog){state.catalog=catalog;state.catalogLoaded=true;}
    if(!state.portal.passwordSet){renderSetPassword();return true;}
    if(state.selected&&!state.portal.projects?.some(p=>String(p.id)===String(state.selected))){state.selected=null;if(['project','invoice'].includes(state.route))state.route='orders';}
    if(!state.clientMessage&&!state.pendingClientMessage)state.pendingClientMessage=pickClientMessage();
    if(portalRealtimeCanRender())render();
    if(state.route==='home')scheduleClientMessageAfterAds();
    return true;
  }catch(e){
    console.warn('Live portal refresh failed:',e?.message||e);
    return false;
  }finally{
    portalRealtimeRefreshInFlight=false;
    if(portalRealtimeRefreshQueued){portalRealtimeRefreshQueued=false;schedulePortalRealtimeRefresh(null,120);}
  }
}

async function startPortalRealtimeSync(){
  if(!state.portal?.profile||navigator.onLine===false)return false;
  stopPortalRealtimeSync();
  try{
    const sb=await getSupabase();
    const clientId=String(state.portal.profile.id||'');
    portalRealtimeChannel=sb
      .channel(`juan-online-sync-${clientId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'juan_sync_events'},payload=>{
        const row=payload?.new||null;
        if(row?.client_id&&String(row.client_id)!==clientId)return;
        schedulePortalRealtimeRefresh(row);
      })
      .subscribe(status=>{
        if(['CHANNEL_ERROR','TIMED_OUT'].includes(status))console.warn('JUAN PROJECT Online live sync reconnecting:',status);
      });
    portalRealtimeFallbackTimer=setInterval(()=>{
      if(document.visibilityState==='visible'&&state.portal?.profile&&navigator.onLine!==false)schedulePortalRealtimeRefresh(null,40);
    },60000);
    return true;
  }catch(e){
    console.warn('JUAN PROJECT Online Realtime unavailable; polling fallback is active:',e?.message||e);
    portalRealtimeFallbackTimer=setInterval(()=>{
      if(document.visibilityState==='visible'&&state.portal?.profile&&navigator.onLine!==false)schedulePortalRealtimeRefresh(null,40);
    },60000);
    return false;
  }
}

window.addEventListener('online',()=>{if(state.portal?.profile){startPortalRealtimeSync();schedulePortalRealtimeRefresh(null,80);}});
window.addEventListener('offline',()=>{stopPortalRealtimeSync();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.portal?.profile){schedulePortalRealtimeRefresh(null,60);}});
window.addEventListener('focus',()=>{if(state.portal?.profile)schedulePortalRealtimeRefresh(null,80);});

const isLoggedIn=()=>Boolean(state.portal?.profile);
const initials=()=>esc((state.portal?.profile?.name||state.portal?.profile?.email||'JP').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase());
const brand=(compact=false)=>`<div class="brand-logo ${compact?'compact':''}" aria-label="JUAN PROJECT Online"><img src="/assets/brand/juan-project-online.svg" alt="JUAN PROJECT Online"></div>`;
const invoiceBrand=()=>`<div class="invoice-brand-logo invoice-brand-wordmark" aria-label="JUAN PROJECT">JUAN PROJECT</div>`;

const icons={
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/>',
  orders:'<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4.5h6"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  payment:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
  shop:'<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  drive:'<path d="M12 3 4 17h5l3-5 3 5h5L12 3Z"/><path d="M9 17h6"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folderlock:'<path d="M3 7h7l2 2h9v10H3z"/><rect x="13" y="13" width="6" height="5" rx="1"/><path d="M14.5 13v-1a1.5 1.5 0 0 1 3 0v1"/>',
  folder:'<path d="M3 7h7l2 2h9v10H3z"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
  spark:'<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.5 1.5c-.8.9-2.2 1.3-2.2 2.7M12 17h.01"/>',
  plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  cart:'<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6"/>'
};
const icon=(name,size=20)=>`<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;

const nav=()=>isLoggedIn()?'<nav class="nav" aria-label="Primary navigation"><div class="jp-desktop-nav-brand"><b>JUAN PROJECT</b><span>Online</span><small>Client Portal</small></div><div class="jp-nav-links">'+
  '<button data-r="home" class="'+(state.route==='home'?'active':'')+'">'+icon('home')+'<span>Home</span></button>'+
  '<button data-r="orders" class="'+(['orders','project','invoice'].includes(state.route)?'active':'')+'">'+icon('orders')+'<span>Orders</span></button>'+
  '<button data-r="payment" class="'+(state.route==='payment'?'active':'')+'">'+icon('payment')+'<span>Payment</span></button>'+
  '<button data-r="shop" class="'+(state.route==='shop'?'active':'')+'">'+icon('shop')+'<span>Shop</span></button>'+
  '<button data-r="account" class="'+(state.route==='account'?'active':'')+'">'+icon('account')+'<span>Account</span></button></div></nav>'
  :'<nav class="nav guest-nav" aria-label="Guest navigation"><div class="jp-desktop-nav-brand"><b>JUAN PROJECT</b><span>Online</span></div><div class="jp-nav-links">'+
  '<button data-r="home" class="'+(state.route==='home'?'active':'')+'">'+icon('home')+'<span>Home</span></button>'+
  '<button data-r="shop" class="'+(state.route==='shop'?'active':'')+'">'+icon('shop')+'<span>Shop</span></button>'+
  '<button data-guest-action="track">'+icon('search')+'<span>Track</span></button>'+
  '<button data-guest-action="login">'+icon('account')+'<span>Login</span></button></div></nav>';

function welcomeScreen(){
  root.innerHTML=`<div class="welcome-shell jp-guest-access-shell"><div class="jp-guest-access-grid">
    <section class="jp-guest-feature-panel jp-welcome-feature" aria-label="JUAN PROJECT Online featured content">
      <div class="jp-guest-feature-brand"><span>JUAN PROJECT</span><strong>Creative services,<br>made simple.</strong><p>Browse services, submit an Order Request, and manage your project in one place.</p></div>
      <div id="jpAdBannerAnchor" class="jp-guest-feature-ad"></div>
    </section>
    <div class="phone-page welcome-card storefront-welcome jp-welcome-simplified jp-guest-phone-panel">
      <div class="welcome-copy"><span class="eyebrow">WELCOME</span><h1>Welcome to<br><strong>JUAN PROJECT Online.</strong></h1><p>Choose what you want to do today.</p></div>
      <div class="welcome-actions"><button id="welcomeShop" class="btn primary full">Shop Now</button><button id="welcomeTrack" class="btn full">Track an Order</button><p class="jp-client-login-question">Already a client? <button id="welcomeLogIn" class="text-button">Log In</button></p></div>
      <div class="version">JUAN PROJECT Online · Order Request Update</div>
    </div>
  </div></div>`;
  document.getElementById('welcomeShop').onclick=()=>{state.route='shop';render();};
  document.getElementById('welcomeLogIn').onclick=()=>authScreen();
  document.getElementById('welcomeTrack').onclick=()=>window.JPMobileCommerce?.openTrack?.();
  window.dispatchEvent(new Event('juan-online-render'));
  
}

function enterGuest(){state.route='home';state.gateOpen=false;render()}

function setFieldError(id,message=''){
  const el=document.getElementById(id);if(!el)return;
  el.textContent=message;
  const input=el.closest('.field')?.querySelector('.input');
  if(input)input.classList.toggle('invalid',Boolean(message));
}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())}

function authScreen(message=''){
  root.innerHTML=`<div class="auth-shell jp-guest-access-shell"><div class="jp-guest-access-grid"><section class="jp-guest-feature-panel jp-auth-feature" aria-label="JUAN PROJECT Online featured content"><div class="jp-guest-feature-brand"><span>JUAN PROJECT</span><strong>Your projects,<br>in one place.</strong><p>View orders, payments, invoices, progress, and project files after signing in.</p></div></section><div class="phone-page auth-card jp-guest-phone-panel"><button id="authBack" class="icon-button auth-back" aria-label="Back">${icon('back')}</button><div class="auth-copy auth-copy-top"><span class="eyebrow">CLIENT ACCESS</span><h1>Welcome back</h1><p>Log in to view your projects, payments, invoices, and project files.</p></div><div class="field"><label for="ae">Email Address</label><input id="ae" class="input" type="email" autocomplete="username" placeholder="you@example.com"><div id="emailValidation" class="field-error"></div></div><div class="field password-field"><label for="ap">Password</label><div class="password-input-wrap"><input id="ap" class="input" type="password" autocomplete="current-password" placeholder="Enter your password"><button id="toggleLoginPass" type="button" class="password-eye" aria-label="Show password">${icon('eye',18)}</button></div><div id="loginValidation" class="field-error"></div></div><div class="auth-options persistent-login-note"><span>Your login stays saved on this device.</span><button id="forgotPassword" class="text-button">Forgot password?</button></div><button id="ab" class="btn primary full">Log In</button><div class="info-box">${icon('lock',18)}<span>Use the client login details provided by JUAN PROJECT. You can update your password securely after signing in.</span></div>${message?`<p class="form-message error-message">${esc(message)}</p>`:''}</div></div></div>`;
  const email=document.getElementById('ae'),pass=document.getElementById('ap'),btn=document.getElementById('ab');
  document.getElementById('authBack').onclick=()=>{state.route='home';state.portal=null;render()};
  email.addEventListener('blur',()=>setFieldError('emailValidation',email.value.trim()&&!validEmail(email.value)?'Enter a valid email address.':''));
  btn.onclick=async()=>{
    setFieldError('emailValidation','');setFieldError('loginValidation','');
    const e=email.value.trim();
    if(!e){setFieldError('emailValidation','Enter your email address.');email.focus();return}
    if(!validEmail(e)){setFieldError('emailValidation','Enter a valid email address.');email.focus();return}
    if(!pass.value){setFieldError('loginValidation','Enter your password.');pass.focus();return}
    try{
      btn.disabled=true;btn.innerHTML=`<span class="btn-spinner"></span> Logging you in…`;
      await signIn(e,pass.value);localStorage.setItem(REMEMBERED_CLIENT_KEY,'1');await loadPortal();
    }catch(err){setFieldError('loginValidation','Email or password is incorrect.');toast('Log in failed. Check your credentials and try again.')}finally{if(document.body.contains(btn)){btn.disabled=false;btn.textContent='Log In'}}
  };
  pass.addEventListener('keydown',e=>{if(e.key==='Enter')btn.click()});
  const toggle=document.getElementById('toggleLoginPass');if(toggle)toggle.onclick=()=>{const show=pass.type==='password';pass.type=show?'text':'password';toggle.setAttribute('aria-label',show?'Hide password':'Show password')};
  document.getElementById('forgotPassword').onclick=async()=>{try{const e=email.value.trim();if(!e||!validEmail(e)){setFieldError('emailValidation','Enter your registered email address first.');return}await sendPasswordReset(e);toast('If this account can receive email, a password reset link has been sent.')}catch(err){toast('Password reset could not be started right now.')}};
}

async function renderPortalLoadError(error){
  const message=error?.message||'We could not load your client information right now.';
  root.innerHTML=`<div class="auth-shell"><div class="phone-page auth-card portal-load-error"><div class="password-icon">${icon('alert',34)}</div><div class="auth-copy centered"><span class="eyebrow">CLIENT PORTAL</span><h1>We couldn't load your portal.</h1><p>Your account may still be signed in. You can try again or continue browsing as a guest.</p></div><div class="info-box">${icon('help',18)}<span>${esc(message)}</span></div><button id="portalRetry" class="btn primary full">Try Again</button><button id="portalGuest" class="btn full">Browse as Guest</button><button id="portalLogout" class="text-button full">Log Out</button></div></div>`;
  document.getElementById('portalRetry').onclick=()=>loadPortal();
  document.getElementById('portalGuest').onclick=()=>{state.portal=null;state.route='home';render()};
  document.getElementById('portalLogout').onclick=async()=>{stopPortalRealtimeSync();try{await signOut()}catch(_){}localStorage.removeItem(REMEMBERED_CLIENT_KEY);state.portal=null;state.route='home';render()};
  
}

async function loadPortal(){
  try{
    state.portal=await getPortal();
    if(!state.portal.passwordSet){stopPortalRealtimeSync();renderSetPassword();return;}
    state.clientMessage=null;state.pendingClientMessage=pickClientMessage();
    state.route='home';render();scheduleClientMessageAfterAds();
    
    await startPortalRealtimeSync();
  }catch(e){stopPortalRealtimeSync();state.portal=null;renderPortalLoadError(e)}
}
function renderSetPassword(){
  root.innerHTML=`<div class="auth-shell"><div class="phone-page auth-card"><button id="passwordBack" class="icon-button auth-back" aria-label="Log out">${icon('back')}</button><div class="password-icon">${icon('lock',34)}</div><div class="auth-copy centered"><span class="eyebrow">SECURITY STEP</span><h1>Change your password</h1><p>You are using a temporary password. Create a new password before continuing to your portal.</p></div><div class="field"><label>Current Password</label><div class="password-input-wrap"><input id="currentPass" class="input" type="password" autocomplete="current-password" placeholder="Current password"><button type="button" class="password-eye" data-toggle-pass="currentPass">${icon('eye',18)}</button></div></div><div class="field"><label>New Password</label><div class="password-input-wrap"><input id="p1" class="input" type="password" autocomplete="new-password" minlength="8" placeholder="New password"><button type="button" class="password-eye" data-toggle-pass="p1">${icon('eye',18)}</button></div></div><div class="field"><label>Confirm New Password</label><div class="password-input-wrap"><input id="p2" class="input" type="password" autocomplete="new-password" minlength="8" placeholder="Confirm new password"><button type="button" class="password-eye" data-toggle-pass="p2">${icon('eye',18)}</button></div><div id="passwordValidation" class="field-error"></div></div><div class="password-rule">${icon('lock',18)}<span>Use at least 8 characters. A mix of letters, numbers, and symbols is recommended.</span></div><button id="savep" class="btn primary full">Update Password & Continue</button></div></div>`;
  document.getElementById('passwordBack').onclick=async()=>{stopPortalRealtimeSync();await signOut();localStorage.removeItem(REMEMBERED_CLIENT_KEY);state.portal=null;state.route='home';render()};
  document.querySelectorAll('[data-toggle-pass]').forEach(b=>b.onclick=()=>{const input=document.getElementById(b.dataset.togglePass);if(input)input.type=input.type==='password'?'text':'password'});
  document.getElementById('savep').onclick=async()=>{const cur=document.getElementById('currentPass'),p1=document.getElementById('p1'),p2=document.getElementById('p2'),btn=document.getElementById('savep');setFieldError('passwordValidation','');if(!cur.value){setFieldError('passwordValidation','Enter your temporary password.');return}if(p1.value.length<8){setFieldError('passwordValidation','Use at least 8 characters.');return}if(p1.value!==p2.value){setFieldError('passwordValidation','Passwords do not match.');return}try{btn.disabled=true;btn.innerHTML=`<span class="btn-spinner"></span> Updating…`;await changePasswordWithCurrent(state.portal.profile.email,cur.value,p1.value);await markPasswordSet();state.portal.passwordSet=true;root.innerHTML=`<div class="flow-screen success"><div class="flow-check">✓</div><span class="eyebrow">ACCOUNT READY</span><h2>Password Updated</h2><p>Your JUAN PROJECT Online account is ready to use.</p><button id="passwordDone" class="btn primary full">Continue to Home</button></div>`;document.getElementById('passwordDone').onclick=()=>{state.route='home';render();startPortalRealtimeSync()}}catch(e){setFieldError('passwordValidation',e.message||'Password could not be updated.')}finally{if(document.body.contains(btn)){btn.disabled=false;btn.textContent='Update Password & Continue'}}};
}


function effectiveProjectStatus(p){
  const delivery=String(p?.delivery_status||'').toLowerCase(),status=String(p?.status||'').toLowerCase();
  if(delivery==='delivered'||status==='completed'||status==='delivered')return 'Delivered';
  return p?.status||'In Progress';
}
function isProjectDelivered(p){return effectiveProjectStatus(p)==='Delivered'}
function pickClientMessage(){
  if(!state.portal?.projects?.length)return null;
  const due=(state.portal.projects||[]).find(p=>Number(p.balance||0)>0&&!pendingSubmissionFor(p));
  if(due){
    const key=`JUAN_BALANCE_REMINDER_${due.id}_${Math.round(Number(due.balance||0))}`;
    if(sessionStorage.getItem(key)!=='1')return {type:'balance',projectId:due.id,key};
  }
  return null;
}
function scheduleClientMessageAfterAds(){
  if(!state.pendingClientMessage||state.clientMessage)return;
  const release=()=>{if(!state.pendingClientMessage||state.clientMessage)return;state.clientMessage=state.pendingClientMessage;state.pendingClientMessage=null;render();};
  clearTimeout(window.__juanBalanceFallback);
  if(window.__JUAN_ADS_READY&&!window.__JUAN_AD_POPUP_ACTIVE){setTimeout(release,240);return;}
  const settled=()=>{window.removeEventListener('juan-ad-popup-settled',settled);setTimeout(release,240);};
  window.addEventListener('juan-ad-popup-settled',settled,{once:true});
  const fallback=()=>{
    if(window.__JUAN_AD_POPUP_ACTIVE){window.__juanBalanceFallback=setTimeout(fallback,500);return;}
    window.removeEventListener('juan-ad-popup-settled',settled);release();
  };
  window.__juanBalanceFallback=setTimeout(fallback,1800);
}
function animatePaymentReminderBalance(){
  const el=document.querySelector('.payment-reminder-amount[data-balance]');if(!el)return;
  const target=Math.max(0,Number(el.dataset.balance||0));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=peso(target);return;}
  const started=performance.now(),duration=780;
  const tick=now=>{const t=Math.min(1,(now-started)/duration),ease=1-Math.pow(1-t,3);el.textContent=peso(target*ease);if(t<1)requestAnimationFrame(tick);else el.textContent=peso(target);};
  requestAnimationFrame(tick);
}
function clientMessageOverlay(){
  const m=state.clientMessage;if(!m||!isLoggedIn())return '';
  const p=(state.portal?.projects||[]).find(x=>String(x.id)===String(m.projectId));if(!p||Number(p.balance||0)<=0)return '';
  return `<div class="overlay client-message-overlay"><div class="payment-reminder-modal" role="dialog" aria-modal="true" aria-label="Payment reminder">
    <button id="messageClose" class="payment-reminder-close" type="button" aria-label="Close payment reminder">${icon('close',20)}</button>
    <div class="payment-reminder-icon">${icon('payment',34)}</div>
    <div class="payment-reminder-pill">PAYMENT REMINDER</div>
    <h2>You still have</h2>
    <div class="payment-reminder-amount" data-balance="${Number(p.balance||0)}">${peso(0)}</div>
    <div class="payment-reminder-label">remaining balance</div>
    <p>Whenever you’re ready, you can review the invoice or send your payment proof for ${esc(p.project_code||'your project')}.</p>
    <div class="payment-reminder-invoice">${icon('receipt',19)}<span>Invoice: <b>${esc(p.project_code||p.invoice_number||'Project')}</b></span></div>
    <div class="payment-reminder-actions">
      <button id="messagePay" class="btn primary full">Make a Payment <span aria-hidden="true">→</span></button>
      <button id="messageInvoice" class="btn full">Review Invoice</button>
    </div>
  </div></div>`;
}

function gate(context='default'){state.guestGateContext=context;state.gateOpen=true;render()}
function gateOverlay(){
  if(!state.gateOpen)return '';
  const contexts={
    orders:{title:'Orders are for clients',body:'Log in to view your projects, deliverables, invoices, and order progress.'},
    payment:{title:'Payment requires Log In',body:'Payments, receipts, and payment history are protected client features.'},
    account:{title:'Client account required',body:'Log in to manage your profile and password.'},
    default:{title:'Log In Required',body:'This area contains private JUAN PROJECT client information.'}
  };
  const c=contexts[state.guestGateContext]||contexts.default;
  return `<div class="overlay" id="gateOverlay"><div class="sheet center guest-gate-sheet"><button id="gateX" class="icon-button sheet-x" aria-label="Close">×</button><div class="sheet-icon">${icon('lock',26)}</div><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p><div class="guest-benefits"><span>✓ Secure client access</span><span>✓ Project and payment history</span><span>✓ Official invoices and project files</span></div><div class="sheet-actions"><button id="gateLogIn" class="btn primary full">Log In</button><button id="gateShop" class="btn full">Continue as Guest</button></div></div></div>`;
}

function browserNotificationPermission(){
  if(!('Notification' in window)||!('serviceWorker' in navigator))return 'unsupported';
  return Notification.permission||'default';
}
async function enableBrowserNotifications(){
  if(!('Notification' in window)||!('serviceWorker' in navigator)){toast('Browser notifications are not supported on this device.');return false;}
  const permission=await Notification.requestPermission();
  if(permission!=='granted'){toast(permission==='denied'?'Notifications are blocked in your browser settings.':'Notifications were not enabled.');render();return false;}
  try{
    const reg=await navigator.serviceWorker.ready;
    localStorage.setItem('JUAN_BROWSER_NOTIFICATIONS','1');
    await reg.showNotification('JUAN PROJECT Online',{body:'Browser notifications are now enabled.',tag:'juan-notifications-enabled',icon:'/assets/apple-touch-icon.png',badge:'/assets/favicon-32.png',data:{url:location.origin+location.pathname}});
    toast('Browser notifications enabled.');
    render();
    return true;
  }catch(e){toast('Notifications are allowed, but the browser could not show the confirmation.');render();return false;}
}
async function showPortalBrowserNotification(row){
  if(browserNotificationPermission()!=='granted'||!row)return;
  const key=String(row.id||row.at||row.created_at||row.title||'');
  if(key&&sessionStorage.getItem('JUAN_LAST_BROWSER_NOTICE')===key)return;
  if(key)sessionStorage.setItem('JUAN_LAST_BROWSER_NOTICE',key);
  try{
    const reg=await navigator.serviceWorker.ready;
    await reg.showNotification(String(row.title||'JUAN PROJECT update'),{
      body:String(row.message||row.description||row.entity||'There is a new update in your client portal.'),
      tag:'juan-portal-'+(key||Date.now()),
      icon:'/assets/apple-touch-icon.png',
      badge:'/assets/favicon-32.png',
      data:{url:location.origin+location.pathname}
    });
  }catch(_){}
}

function notificationOverlay(){
  if(!state.notificationOpen||!isLoggedIn())return'';
  const rows=activityFeed(),permission=browserNotificationPermission();
  const permissionCard=permission==='granted'
    ? '<div class="browser-notification-state allowed"><b>Browser notifications allowed</b><small>Updates can appear outside the JUAN PROJECT tab when the browser permits background delivery.</small></div>'
    : permission==='unsupported'
      ? '<div class="browser-notification-state"><b>Browser notifications unavailable</b><small>This browser or device does not support web notifications.</small></div>'
      : '<button id="allowBrowserNotifications" class="browser-notification-enable"><span>'+icon('bell',18)+'</span><div><b>Allow browser notifications</b><small>Enable project, payment, invoice, and file alerts.</small></div>'+icon('chevron',16)+'</button>';
  return `<div class="overlay" id="notificationOverlay"><div class="sheet notification-sheet"><button id="notificationX" class="icon-button sheet-x" aria-label="Close">×</button><div class="sheet-header-left"><span class="eyebrow">ACTIVITY</span><h2 class="sheet-title">Notifications</h2><p>Project and payment updates from JUAN PROJECT.</p></div>${permissionCard}<div class="notification-list">${rows.map(x=>`<div class="notification-row"><span>${icon(x.icon,16)}</span><div><b>${esc(x.title)}</b><small>${esc(x.sub)} · ${esc(fmtDate(x.date))}</small></div></div>`).join('')||'<div class="empty compact-empty">No notifications yet.</div>'}</div></div></div>`;
}

function shopOverlay(){if(!state.shopItem)return'';const x=state.shopItem,price=x.kind==='Package'?Number(x.new_price||0):Number(x.price||0),old=x.kind==='Package'?Number(x.original_price||0):0;return `<div class="overlay" id="shopOverlay"><div class="sheet shop-detail-sheet"><button id="shopX" class="icon-button sheet-x" aria-label="Close">×</button><div class="shop-kind">${esc(x.product_code||'')} · ${esc(x.kind==='Package'?'Package':categoryName(x.category_id))}</div><h2 class="sheet-title">${esc(x.name)}</h2><div class="detail-price">${old>price?`<span>${peso(old)}</span>`:''}${peso(price)}</div><p class="detail-copy">${esc(x.description||'JUAN PROJECT creative service.')}</p><div class="service-detail-meta"><div><span>Turnaround</span><b>Standard timeline applies</b></div><div><span>Ordering</span><b>Order request available</b></div></div><button id="detailStartProject" class="btn primary full">Add to Cart</button>${!isLoggedIn()?`<button id="detailLogIn" class="btn full">Already a Client? Log In</button>`:''}<button id="detailClose" class="btn full">Close</button></div></div>`}

const PAGE_TITLE_ICONS={'My Orders':'orders',Orders:'orders',Payment:'payment',Shop:'shop',Account:'account'};
function pageHead(title,{back=false,more=false}={}){
  const titleIcon=PAGE_TITLE_ICONS[title]||'';
  return `<div class="screen-head"><button id="screenBack" class="icon-button ${back?'':'ghost-space'}" ${back?'':'disabled'} aria-label="Back">${back?icon('back'):''}</button><h1 class="screen-title">${titleIcon?`<span class="screen-title-icon">${icon(titleIcon,22)}</span>`:''}<span>${esc(title)}</span></h1><button class="icon-button ${more?'':'ghost-space'}" aria-label="More">${more?icon('more'):''}</button></div>`;
}
function projectStats(p){const ds=(p?.deliverables||[]).flatMap(d=>d.children?.length?d.children:[d]),done=ds.filter(d=>d.completed||String(d.status||'').toLowerCase()==='completed').length,total=ds.length||Math.max(1,p?.items?.length||0),pct=total?Math.round(done/total*100):0;return{done,total,pct}}
function nextDeliverable(p){return (p?.deliverables||[]).filter(d=>!d.completed&&String(d.status||'').toLowerCase()!=='completed').sort((a,b)=>new Date(a.due_date||'9999-12-31')-new Date(b.due_date||'9999-12-31'))[0]||null}
function activeProject(){
  const projects=(state.portal?.projects||[]).filter(p=>String(p?.status||'').toLowerCase()!=='cancelled');
  const active=projects.filter(p=>Number(p.balance||0)>0||!isProjectDelivered(p));
  return active.sort((a,b)=>{
    const ab=Number(a.balance||0)>0?0:1,bb=Number(b.balance||0)>0?0:1;
    return ab-bb||new Date(a.deadline_date||'9999-12-31')-new Date(b.deadline_date||'9999-12-31');
  })[0]||null
}
function latestProject(){return (state.portal?.projects||[])[0]||null}
function pendingSubmissionFor(p){return (state.portal?.paymentSubmissions||[]).find(x=>String(x.project_id)===String(p?.id)&&String(x.status||'').toLowerCase()==='pending')}
function nextAction(p){if(!p)return{kind:'none',title:'No action required',body:'You have no active project right now.'};const sub=pendingSubmissionFor(p);if(sub)return{kind:'pending',title:'Payment under review',body:`${peso(sub.submitted_amount)} submitted ${fmtDate(sub.payment_date||sub.submitted_at)}.`,cta:'View Payment',route:'payment'};if(Number(p.balance||0)>0)return{kind:'payment',title:'Payment required',body:`${peso(p.balance)} balance due for ${p.project_code||'your project'}.`,cta:'Pay Now',route:'payment'};const next=nextDeliverable(p);if(next)return{kind:'progress',title:'Production in progress',body:`Next: ${next.item_name||'Deliverable'} · ${fmtDate(next.due_date||p.deadline_date)}.`,cta:'Track Order',route:'project'};return{kind:'none',title:'No action required',body:'Your project is moving forward. We will surface the next step here.'}}
function activityFeed(){
  const rows=[];
  (state.portal?.paymentSubmissions||[]).slice(0,8).forEach(x=>{
    const st=paymentStatusLabel(x.status);
    const title=st==='Accepted'?'Payment accepted':st==='Rejected'?'Payment needs attention':'Payment submitted';
    const sub=st==='Rejected'?(x.rejection_reason||'Check the payment details and try again.'):`${peso(x.submitted_amount)} · ${st}`;
    rows.push({date:new Date(x.reviewed_at||x.submitted_at||x.payment_date||0),title,sub,icon:st==='Rejected'?'alert':'payment'});
  });
  for(const p of state.portal?.projects||[]){
    if(isProjectDelivered(p))rows.push({date:new Date(p.updated_at||p.deadline_date||0),title:'Project delivered',sub:`${p.project_code||''} · Your project is ready`,icon:'folder'});
    for(const d of p.deliverables||[]){if(d.completed)rows.push({date:new Date(d.completed_at||d.due_date||p.deadline_date||0),title:'Deliverable completed',sub:`${p.project_code||''} · ${d.item_name||'Deliverable'}`,icon:'check'})}
  }
  return rows.filter(x=>!Number.isNaN(x.date.getTime())).sort((a,b)=>b.date-a.date).slice(0,8)
}

function home(){
  if(!isLoggedIn()){
    return '<div class="guest-home jp-guest-home-v2 jp-guest-home-centered"><div class="jp-guest-home-split">'+
      '<section class="jp-guest-phone-panel"><div class="jp-guest-hero"><span class="eyebrow">WELCOME</span><h1>JUAN PROJECT<br><strong>made simple.</strong></h1><p>Shop creative services or track an existing Order Request.</p><div class="guest-actions"><button id="homeShop" class="btn primary full">Shop Now</button><button id="homeTrack" class="btn full">Track an Order</button><p class="jp-client-login-question">Already a client? <button id="homeLogIn" class="text-button">Log In</button></p></div></div><div class="jp-guest-about"><b>About JUAN PROJECT</b><span>Creative services and project management developed by BENZEL DELMO.</span></div></section>'+
      '<section class="jp-guest-feature-panel"><div class="jp-guest-feature-brand"><span>FEATURED</span><strong>Discover what JUAN PROJECT can do.</strong><p>Promotions and featured services appear here.</p></div><div id="jpAdBannerAnchor" class="jp-guest-feature-ad"></div></section>'+
      '</div></div>';
  }
  const p=activeProject(),financial=p||latestProject(),feed=activityFeed(),profile=state.portal?.profile||{};
  const avatar=profile.profile_photo_url?'<img src="'+esc(profile.profile_photo_url)+'" alt="Profile photo">':initials();
  const pStats=p?projectStats(p):null,balance=Math.max(0,Number(financial?.balance||0));
  const due=financial?.invoice_due_date||financial?.payment_due_date||financial?.deadline_date||null;
  const balanceCard='<div class="section-head home-priority-head"><h2>Balance Due</h2></div>'+
    '<div class="card home-balance-card '+(balance>0?'has-balance':'settled')+'"><div><span>Current balance</span><b>'+peso(balance)+'</b><small>'+(due?'Due '+esc(fmtDate(due)):'No payment due date')+'</small></div>'+(balance>0?'<button id="homePayNow" class="btn primary small">Pay Now</button>':'<span class="badge">Settled</span>')+'</div>';
  const projectCard=p?'<div class="section-head"><h2>Project Progress</h2></div><button class="card active-project project-button" data-open="'+esc(p.id)+'"><div class="card-topline"><span class="project-code">'+esc(p.project_code||p.id)+'</span><span class="status-dot-label">'+esc(effectiveProjectStatus(p))+'</span></div><div class="project-name">'+esc(p.title||'Untitled Project')+'</div><div class="progress"><span style="width:'+pStats.pct+'%"></span></div><div class="meta"><span>'+pStats.done+'/'+pStats.total+' deliverables</span><b>'+pStats.pct+'%</b></div><div class="card-action-row"><span>View project details</span>'+icon('chevron',16)+'</div></button>':'<div class="section-head"><h2>Project Progress</h2></div><div class="card empty guided-empty"><b>No active project right now</b><span>Your next JUAN PROJECT project will appear here.</span><button id="homeShop" class="btn primary small">Browse Services</button></div>';
  return '<div class="dashboard-head"><div><span>Good day,</span><h1>'+esc((profile.name||'Client').split(/\s+/)[0])+'!</h1><p>Let’s bring your ideas to life.</p></div><div class="dashboard-actions"><button id="notificationBtn" class="icon-button" aria-label="Notifications">'+icon('bell',19)+'</button><button id="topAccount" class="avatar top-avatar" aria-label="Account">'+avatar+'</button></div></div>'+
    balanceCard+projectCard+
    '<div class="section-head"><h2>Recent Activity</h2><button id="homeActivityAll" class="text-button compact">See All</button></div><div class="card activity-card home-activity-card">'+(feed.slice(0,8).map(x=>'<div class="activity-row"><div class="activity-icon">'+icon(x.icon,15)+'</div><div><b>'+esc(x.title)+'</b><small>'+esc(x.sub)+' · '+esc(fmtDate(x.date))+'</small></div></div>').join('')||'<div class="empty compact-empty">No recent activity yet.</div>')+'</div>'+
    '<div id="jpAdBannerAnchor" class="jp-home-ad-inline"></div>';
}
function orders(){
  const requests=state.portal?.orderRequests||[],projects=state.portal?.projects||[],filter=state.orderFilter||'requests';
  if(filter==='requests'){
    return pageHead('My Orders',{back:false,more:false})+'<div class="tabs order-tabs"><button data-order-filter="requests" class="active">Requests</button><button data-order-filter="projects">Projects</button><button data-order-filter="completed">Completed</button></div><div class="project-list">'+
      (requests.map(o=>'<button class="card project-list-card project-button" data-request-open="'+esc(o.id)+'"><div class="project-list-top"><div><div class="project-code">'+esc(o.code||'Order Request')+'</div><div class="project-name">'+esc(o.title||'Order Request')+'</div><small>'+esc(fmtDate(o.created_at))+'</small></div><span class="badge">'+esc(o.status||'Order Received')+'</span>'+icon('chevron',18)+'</div><div class="meta"><span>'+((o.items||[]).length)+' item(s)</span><b>'+peso(o.total||0)+'</b></div></button>').join('')||'<div class="card empty guided-empty"><b>No order requests yet.</b><span>Start a new order whenever you’re ready.</span><button id="ordersStartNew" class="btn primary small">Start New Order</button></div>')+'</div>';
  }
  const completed=projects.filter(p=>Number(p.balance||0)<=0&&isProjectDelivered(p));
  const active=projects.filter(p=>!completed.includes(p)&&String(p.status||'').toLowerCase()!=='cancelled');
  const list=filter==='completed'?completed:active;
  return pageHead('My Orders',{back:false,more:false})+'<div class="tabs order-tabs"><button data-order-filter="requests">Requests</button><button data-order-filter="projects" class="'+(filter==='projects'?'active':'')+'">Projects</button><button data-order-filter="completed" class="'+(filter==='completed'?'active':'')+'">Completed</button></div><div class="project-list">'+
    (list.map(p=>'<button class="card project-list-card project-button" data-open="'+esc(p.id)+'"><div class="project-list-top"><div><div class="project-code">'+esc(p.project_code||p.id)+'</div><div class="project-name">'+esc(p.title||'Untitled Project')+'</div><small>'+esc(fmtDate(p.created_at||p.start_date))+'</small></div><span class="badge">'+esc(effectiveProjectStatus(p))+'</span>'+icon('chevron',18)+'</div><div class="meta"><span>'+esc(effectiveProjectStatus(p))+'</span><b>'+peso(p.total_amount||0)+'</b></div></button>').join('')||'<div class="card empty guided-empty"><b>No matching projects</b><span>Projects in this stage will appear here.</span></div>')+'</div>';
}
function trackingStages(p){
  const s=projectStats(p),status=String(effectiveProjectStatus(p)||'').toLowerCase(),paid=Number(p.amount_paid||0),balance=Number(p.balance||0),allDone=s.total>0&&s.done>=s.total,delivered=allDone&&balance<=0&&isProjectDelivered(p);
  let current=0;
  if(paid>0||['paid','partially paid'].includes(String(p.payment_status||'').toLowerCase()))current=1;
  if(current>=1||status.includes('started'))current=Math.max(current,2);
  if(s.done>0||status.includes('production')||status.includes('progress'))current=Math.max(current,3);
  if(status.includes('review')||status.includes('quality'))current=Math.max(current,4);
  if(status.includes('ready'))current=Math.max(current,5);
  if(allDone||status.includes('complete'))current=Math.max(current,6);
  if(delivered||status.includes('deliver'))current=7;
  if(Number.isInteger(p.tracker_stage))current=Math.max(current,Math.max(0,Math.min(7,p.tracker_stage)));
  return {current,stages:[
    ['Order Confirmed','Your order has been approved and recorded in JUAN PROJECT.'],
    ['Downpayment Confirmed','Your required downpayment has been verified.'],
    ['Production Started','Production begins automatically after downpayment confirmation.'],
    ['In Production','At least one project deliverable is actively being worked on.'],
    ['Quality Assessment','Deliverables are being checked for quality and revisions.'],
    ['Ready for Delivery','Quality checks are complete and final files are being prepared.'],
    ['Completed','All required deliverables are complete.'],
    ['Delivered','Payment requirements are satisfied and final access has been released.']
  ]};
}
function projectTracking(p){const {current,stages}=trackingStages(p);return `<div class="tracking-card card"><div class="section-head inner"><div><span class="eyebrow">ORDER TRACKER</span><h2>Project Progress</h2></div><span class="tracker-step-count">${Math.min(current+1,stages.length)} of ${stages.length}</span></div><div class="route-timeline">${stages.map(([title,desc],i)=>`<div class="route-node ${i<current?'done':i===current?'current':'future'}"><div class="route-marker">${i<current?icon('check',13):i+1}</div><div class="route-copy"><b>${esc(title)}</b><small>${esc(desc)}</small>${i===current?'<span>Current stage</span>':''}</div></div>`).join('')}</div></div>`}

function folderState(p){
  if(p.files_locked||(Number(p.balance)>0&&!p.files_override))return{mode:'locked',title:'Locked — Awaiting Final Payment',body:'Complete your remaining balance to access project files.'};
  const now=Date.now(),unlock=p.drive_unlock_at?new Date(p.drive_unlock_at).getTime():null,expires=p.drive_expires_at?new Date(p.drive_expires_at).getTime():null;
  if(expires&&Number.isFinite(expires)&&now>expires)return{mode:'expired',title:'Access Expired',body:'This project folder is no longer available. Contact JUAN PROJECT if you need access restored.'};
  if(!p.drive_url)return{mode:'locked',title:'Project Files',body:'Your project folder has not been released yet.'};
  if(unlock&&Number.isFinite(unlock)&&now<unlock)return{mode:'locked',title:'Project Files',body:`Files unlock ${fmtDate(p.drive_unlock_at)} · ${remaining(p.drive_unlock_at)}`};
  return{mode:'open',title:'Project Files',body:expires?`Available until ${fmtDate(p.drive_expires_at)}.`:'Your project files are ready.'};
}
function projectFolder(p){const f=folderState(p);return `<div class="card timelock-folder ${f.mode}"><div class="folder-lock-icon">${icon(f.mode==='open'?'folder':'folderlock',25)}</div><div class="drive-copy"><span class="eyebrow">SECURE DELIVERY</span><b>${esc(f.title)}</b><small>${esc(f.body)}</small></div>${f.mode==='open'?`<button class="btn small" data-drive="${esc(p.drive_url)}">Open in Drive</button>`:`<span class="lock-state">${f.mode==='expired'?'Expired':'Locked'}</span>`}</div>`}

function project(){
  const p=(state.portal?.projects||[]).find(x=>x.id===state.selected);if(!p){state.route='orders';return orders()}const s=projectStats(p);
  return `${pageHead('Order Tracker',{back:true,more:true})}<div class="project-summary-card card"><div class="card-topline"><span class="project-code">${esc(p.project_code||p.id)}</span><span class="badge">${esc(effectiveProjectStatus(p))}</span></div><h2>${esc(p.title)}</h2><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done} of ${s.total} deliverables</span><b>${s.pct}%</b></div>${p.deadline_date?`<div class="estimated-row"><span>Estimated completion</span><b>${esc(fmtDate(p.deadline_date))}</b></div>`:''}</div>${projectTracking(p)}<div class="section-head"><h2>Deliverables</h2><span>${s.done} of ${s.total} completed</span></div><div class="deliverables-card card">${(p.deliverables||[]).flatMap(d=>d.children?.length?[{...d,item_name:d.item_name+' (package)'},...d.children.map(c=>({...c,item_name:'↳ '+c.item_name}))]:[d]).map(d=>{const done=d.completed||String(d.status||'').toLowerCase()==='completed',progressing=!done&&String(d.status||'').toLowerCase().includes('progress');return `<div class="deliverable"><span class="dot ${done?'done':progressing?'progressing':''}">${done?'✓':''}</span><div><div class="d-name">${esc(d.item_name||d.name||'Deliverable')}</div><div class="d-sub"><span class="status-text ${String(d.status||'Pending').toLowerCase().replace(/\s+/g,'-')}">${esc(d.status||(done?'Completed':'Pending'))}</span><span>${esc(fmtDate(d.due_date||p.deadline_date))}</span></div></div></div>`}).join('')||'<div class="empty compact-empty">No deliverables have been added yet.</div>'}</div><div class="project-actions-row"><button class="btn" id="projectInvoiceBtn">View Invoice</button><button class="btn primary" id="payProject">Make a Payment</button></div>${projectFolder(p)}`;
}

function paymentStatusLabel(value){const v=String(value||'pending').toLowerCase();return v==='approved'||v==='accepted'?'Accepted':v==='rejected'?'Rejected':'Pending'}
function paymentSummary(p){if(!p)return'';return `<div class="payment-summary card"><div><span>Project Total</span><b>${peso(p.total_amount||0)}</b></div><div><span>Amount Paid</span><b>${peso(p.amount_paid||0)}</b></div><div class="balance"><span>Balance Due</span><b>${peso(p.balance||0)}</b></div></div>`}
function paymentLegalFooter(){
  return `<footer class="jp-payment-legal-footer"><nav><a href="/terms.html">Terms &amp; Conditions</a><span>·</span><a href="/privacy.html">Privacy Policy</a></nav><b>Developed by Benzel Delmo</b><small>JUAN PROJECT SYSTEM <span>|</span> JUAN PROJECT Online 2026</small></footer>`;
}

function verifiedField(label,id,value,type='text',readonly=true){return `<div class="field"><label>${esc(label)}</label><input id="${id}" class="input ${readonly?'locked-field':''}" type="${type}" ${readonly?'readonly':''} value="${esc(value??'')}"></div>`}
function payment(){
  const settings=state.portal?.paymentSettings||{},all=state.portal?.projects||[],ps=all.filter(p=>Number(p.balance||0)>0),qr=settings.qr_image_url||QR_FALLBACK;
  const selected=all.find(p=>p.id===state.paymentProjectId)||ps[0]||latestProject();if(selected&&!state.paymentProjectId)state.paymentProjectId=selected.id;
  const institution=getPaymentInstitution(state.senderInstitution);
  return `${pageHead('Payment',{back:false,more:false})}${selected?paymentSummary(selected):''}<div class="tabs payment-tabs"><button class="active">Make a Payment</button><button id="paymentHistoryTab">History</button></div><div class="card payment-card"><div class="payment-card-head"><div><span class="eyebrow">RECEIVING ACCOUNT</span><b>UnionBank · JUAN PROJECT</b><p>Use the QR or account details below, then submit your payment proof.</p></div>${icon('payment',22)}</div><div class="qr-wrap"><img class="qr" src="${esc(qr)}" alt="UnionBank bank QR code"></div><div class="bank-meta"><div><span>Account Name</span><b>${esc(settings.account_name||'JUAN PROJECT')}</b></div><div><span>Account Number</span><b>${esc(settings.account_number||'•••• •••• 1710')}</b></div></div>${settings.instructions?`<p class="payment-instructions">${esc(settings.instructions)}</p>`:''}</div><div class="card payment-card secure-payment-card"><div class="secure-head"><div><span class="eyebrow">PAYMENT PROOF</span><b>Submit Payment Details</b><p>Every required field is checked before the payment can be sent for review.</p></div>${icon('receipt',22)}</div><div class="field institution-field"><label>Sending Bank / E-Wallet *</label><div class="institution-combobox" id="institutionCombobox"><div class="institution-search-control"><input id="payInstitutionSearch" class="input" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="paymentInstitutionDropdown" placeholder="Type to search bank or e-wallet" value="${esc(institution?.name||'')}"><button type="button" id="institutionToggle" class="institution-toggle" aria-label="Show banks and e-wallets">⌄</button></div><div id="paymentInstitutionDropdown" class="institution-dropdown hidden" role="listbox">${PAYMENT_INSTITUTIONS.map(x=>`<button type="button" class="institution-option" role="option" data-institution-code="${esc(x.code)}" data-institution-name="${esc(x.name)}"><span class="institution-logo-tile" style="--institution-tile:${esc(x.tile||'#f3f6f5')}"><img src="${esc(x.logo)}" alt=""></span><span><b>${esc(x.name)}</b><small>${esc(x.type)}</small></span></button>`).join('')}</div></div><div id="institutionValidation" class="field-error"></div></div><div id="institutionPreview" class="institution-preview ${institution?'':'hidden'}">${institution?`<span class="institution-logo-tile preview" style="--institution-tile:${esc(institution.tile||'#f3f6f5')}"><img src="${esc(institution.logo)}" alt="${esc(institution.name)} logo"></span><div><b>${esc(institution.name)}</b><small>${esc(institution.type)} · ${esc(institution.hint)}</small></div>`:''}</div><label class="upload" for="receipt">${icon('upload',24)}<span id="receiptLabel">${state.receiptPath?'Receipt uploaded':'Choose receipt *'}</span><small>JPG, PNG, or PDF · max 5 MB</small><input id="receipt" type="file" accept="image/jpeg,image/png,application/pdf" hidden></label><div class="receipt-upload-actions"><button type="button" id="previewReceiptBtn" class="btn small ${state.receiptPreviewUrl?'':'hidden'}">Preview Receipt</button><span id="receiptFileName" class="receipt-file-name">${esc(state.receiptPreviewName||'')}</span></div><div id="receiptValidation" class="field-error standalone-error"></div><div class="manual-payment-grid"><div class="field"><label>Amount Paid *</label><input id="payAmount" class="input" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"><div id="amountValidation" class="field-error"></div></div><div class="field"><label>Reference Number *</label><input id="payRef" class="input" autocomplete="off" placeholder="${esc(institution?.example||'Select sender first')}"><div id="referenceValidation" class="field-error"></div><div id="referenceHint" class="field-help">${institution?esc(institution.hint):'Reference format changes with the selected sender.'}</div></div><div class="field"><label>Payment Date *</label><input id="payDate" class="input" type="date"><div id="dateValidation" class="field-error"></div></div><div class="field"><label>Transfer Fee</label><input id="payTransferFee" class="input" type="number" min="0" step="0.01" inputmode="decimal" value="0"></div><div class="fee-readout net"><span>Amount credited (fee separate)</span><b id="payNetAmount">₱0.00</b></div></div><div class="field"><label>Apply to Project *</label><select id="payProjectSel" class="input">${(all||[]).map(p=>`<option value="${esc(p.id)}" ${selected?.id===p.id?'selected':''}>${esc(p.project_code||p.id)} · ${esc(p.title)}</option>`).join('')}</select></div><div id="paymentSystemCheck" class="payment-system-check"><b>System verification</b><span>Complete all required details before submitting.</span></div><button id="submitPayment" class="btn primary full" disabled>Submit Payment for Review</button><p class="form-help">Your balance changes only after JUAN PROJECT approves the payment.</p></div><div class="section-head payment-history"><h2>Payment History</h2></div><div class="card history-list">${(state.portal?.paymentSubmissions||[]).map(h=>`<div class="history-row"><div><b>${peso(h.submitted_amount)}</b><small>${esc(fmtDate(h.payment_date||h.submitted_at))} · ${esc(h.reference_number||'No reference')}</small>${h.status==='rejected'&&h.rejection_reason?`<small class="history-reason">Reason: ${esc(h.rejection_reason)}</small>`:''}</div><span class="badge ${String(h.status||'').toLowerCase()==='pending'?'pending':''}">${esc(paymentStatusLabel(h.status))}</span></div>`).join('')||'<div class="empty compact-empty">No payment submissions yet.</div>'}</div>${paymentLegalFooter()}`;
}

async function exportNodeAsPng(element,filename){
  if(!element)throw Error('Invoice preview is not available.');
  const rect=element.getBoundingClientRect(),width=Math.max(1,Math.ceil(Math.max(rect.width,element.scrollWidth))),height=Math.max(1,Math.ceil(Math.max(rect.height,element.scrollHeight)));
  let css='';for(const sheet of Array.from(document.styleSheets)){try{css+=Array.from(sheet.cssRules||[]).map(r=>r.cssText).join('\n')+'\n'}catch(_){}}
  const clone=element.cloneNode(true);clone.style.margin='0';clone.style.boxShadow='none';clone.style.background='#fff';
  const serialized=new XMLSerializer().serializeToString(clone);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${serialized}</div></foreignObject></svg>`;
  const svgUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Could not render invoice image.'));img.src=svgUrl});const maxSide=8192,scale=Math.max(1,Math.min(2,maxSide/width,maxSide/height)),canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',1));if(!png)throw Error('Could not create PNG.');const finalName=filename||'JUAN-PROJECT-Invoice.png',file=new File([png],finalName,{type:'image/png'});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:finalName});return}catch(e){if(e?.name==='AbortError')return}}const url=URL.createObjectURL(png),a=document.createElement('a');a.href=url;a.download=finalName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}finally{URL.revokeObjectURL(svgUrl)}
}
function maintenanceFeeForSubtotal(subtotal){
  const value=Math.max(0,Number(subtotal||0));
  if(!(value>0))return 0;
  return Math.abs(Math.round(value))%100===99?26:25;
}
function clientInvoiceFees(p,subtotal,discount,storedTotal){
  const rows=[],add=(label,amount)=>{amount=Math.max(0,Number(amount||0));if(amount>0)rows.push({label,amount})};
  const baseRush=Math.max(0,Number(p.rush_fee||0)),workload=Math.max(0,Number(p.workload_surcharge||0)),storedMaintenance=Math.max(0,Number(p.system_maintenance_fee||0)),paid=Math.max(0,Number(p.amount_paid||0)),fullySettled=storedTotal>0&&paid>=storedTotal-0.005,maintenance=fullySettled?storedMaintenance:maintenanceFeeForSubtotal(subtotal);
  let rushDisplay=baseRush+workload;
  const others=[];if(Array.isArray(p.additional_fees))p.additional_fees.forEach(f=>{const amount=Math.max(0,Number(f?.amount||0));if(amount>0)others.push({label:String(f?.label||f?.name||'Additional Fee'),amount})});
  const explicitOther=others.reduce((sum,f)=>sum+f.amount,0),expected=Math.max(0,subtotal+rushDisplay+maintenance+explicitOther-discount),legacyDelta=storedTotal>expected+0.005?storedTotal-expected:0;
  if(legacyDelta>0){if(rushDisplay>0)rushDisplay+=legacyDelta;else others.push({label:'Additional Fee',amount:legacyDelta})}
  add('Rush Fee',rushDisplay);add('System Maintenance Fee',maintenance);others.forEach(f=>add(f.label,f.amount));return rows
}

function invoice(){
  const p=(state.portal?.projects||[]).find(x=>x.id===state.selected)||latestProject();if(!p)return `${pageHead('Invoice',{back:true})}<div class="card empty">No invoice available.</div>`;
  const items=Array.isArray(p.items)?p.items:[],discount=Math.max(0,Number(p.discount_amount||0)),itemSubtotal=items.reduce((t,i)=>t+Math.max(0,Number(i.price||0))*Math.max(1,Number(i.qty||1)),0),storedTotal=Math.max(0,Number(p.total_amount||0));
  const storedMaint=Math.max(0,Number(p.system_maintenance_fee||0)),explicitKnown=Math.max(0,Number(p.rush_fee||0))+Math.max(0,Number(p.workload_surcharge||0))+storedMaint,subtotal=Math.max(0,Number(p.subtotal_amount||itemSubtotal||(storedTotal-explicitKnown+discount)));
  const fees=clientInvoiceFees(p,subtotal,discount,storedTotal),additionalFeesTotal=fees.reduce((sum,f)=>sum+f.amount,0),total=Math.max(0,subtotal+additionalFeesTotal-discount),due=p.invoice_due_date||p.deadline_date||'';
  const issued=new Date().toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}),feeBlock=fees.length?`<div class="invoice-fees-client"><div class="invoice-fees-title">Additional Fees</div>${fees.map(f=>`<div><span>${esc(f.label)}</span><b>+${peso(f.amount)}</b></div>`).join('')}<div class="invoice-fees-total"><span>Additional Fees Total</span><b>${peso(additionalFeesTotal)}</b></div></div>`:'';
  return `${pageHead('Invoice',{back:true,more:false})}<div id="clientInvoicePrintable" class="invoice workspace-document"><div class="invoice-h workspace-invoice-head"><div>${invoiceBrand()}</div><div class="invoice-id"><span>INVOICE</span><b>${esc(p.invoice_number||('#'+(p.project_code||p.id)+'-2026'))}</b><i class="badge">${esc(p.payment_status||'UNPAID')}</i></div></div><div class="invoice-grid"><div><span>BILL TO</span><b>${esc(state.portal.profile.name||state.portal.profile.email)}</b><small>${esc(state.portal.profile.email||'')}</small></div><div><span>PROJECT</span><b>${esc(p.title)}</b><small>Issued ${esc(issued)}${due?' · Due '+esc(fmtDate(due)):''}</small></div></div><table><thead><tr><th>ORDER ITEM</th><th>QTY</th><th>AMOUNT</th></tr></thead><tbody>${items.map(i=>`<tr><td>${esc(i.name||'Order Item')}</td><td>${Math.max(1,Number(i.qty||1))}</td><td>${peso(Math.max(0,Number(i.price||0))*Math.max(1,Number(i.qty||1)))}</td></tr>`).join('')||`<tr><td>${esc(p.title)}</td><td>1</td><td>${peso(subtotal)}</td></tr>`}</tbody></table><div class="invoice-summary-client"><div><span>Subtotal</span><b>${peso(subtotal)}</b></div>${feeBlock}${discount>0?`<div><span>Discount</span><b>-${peso(discount)}</b></div>`:''}<div class="invoice-total-client"><span>Total</span><b>${peso(total)}</b></div><div><span>Amount Paid</span><b>${peso(p.amount_paid)}</b></div><div class="invoice-balance ${String(p.payment_status||"UNPAID").toLowerCase().replace(/\s+/g,"-")}"><span>Balance Due</span><b>${peso(Math.max(0,total-Number(p.amount_paid||0)))}</b></div></div><div class="invoice-footer"><strong>JUAN PROJECT</strong><br>Thank you for choosing JUAN PROJECT.</div></div><div class="invoice-export-actions"><button id="saveClientInvoiceImage" class="btn primary full invoice-save-btn">Save as Image</button><button id="saveClientInvoice" class="btn full invoice-save-btn">Save / Print PDF</button></div>`;
}

function membershipProgress(){
  const projects=state.portal?.projects||[];
  const completed=projects.filter(p=>Number(p.balance||0)<=0&&isProjectDelivered(p)).length;
  const tiers=[{name:'BRONZE',min:1,next:2},{name:'SILVER',min:2,next:3},{name:'GOLD',min:3,next:4},{name:'PLATINUM',min:4,next:null}];
  let tier=tiers[0];for(const t of tiers)if(completed>=t.min)tier=t;
  const base=Math.max(0,tier.min),span=tier.next===null?1:Math.max(1,tier.next-base);
  const progress=tier.next===null?100:Math.max(0,Math.min(100,Math.round(((completed-base)/span)*100)));
  return {completed,tier:tier.name,next:tier.next,progress,remaining:tier.next===null?0:Math.max(0,tier.next-completed)};
}

function account(){
  if(!isLoggedIn())return `${pageHead('Help & About',{back:false,more:false})}<div class="guest-help-hero"><h2>Browse freely. Log in when you need your project.</h2><p>Shop and support stay available without an account.</p></div><div class="settings-group"><div class="settings-label">HELP</div><div class="card settings-list"><a class="settings-row settings-link" href="/terms.html"><div><b>Terms &amp; Conditions</b><small>Payments, timelines, revisions, and delivery</small></div>${icon('chevron',17)}</a><a class="settings-row settings-link" href="/privacy.html"><div><b>Privacy Policy</b><small>Privacy and device-storage information</small></div>${icon('chevron',17)}</a><a class="settings-row settings-link" href="mailto:ws.benzeldelmo@gmail.com?subject=JUAN%20PROJECT%20Online%20Support"><div><b>Contact JUAN PROJECT</b><small>Get help before or during your project</small></div>${icon('chevron',17)}</a></div></div><div class="card guest-login-card"><div class="sheet-icon">${icon('lock',22)}</div><div><b>Unlock your client portal</b><small>Orders, payments, invoices, and files are available after Log In.</small></div><button id="guestAccountLogin" class="btn primary full">Log In</button></div><div class="jp-online-version">JUAN PROJECT Online · Order Request Update<br><span>Developed by BENZEL DELMO · JUAN PROJECT Management System</span></div>`;
  const p=state.portal.profile,member=membershipProgress();
  const joined=p.created_at?fmtDate(p.created_at):'—';
  const nextTier=member.tier==='BRONZE'?'Silver':member.tier==='SILVER'?'Gold':'Platinum';
  const tierMessage=member.next===null?'Highest membership tier reached':`${member.remaining} more completed project${member.remaining===1?'':'s'} to ${nextTier}`;
  const notificationPermission=browserNotificationPermission();
  const notificationLabel=notificationPermission==='granted'?'Allowed':notificationPermission==='denied'?'Blocked':notificationPermission==='unsupported'?'Unavailable':'Enable';
  const referralCode=p.client_code?'JUAN-'+String(p.client_code).toUpperCase():'—';
  const points=Math.max(0,Number(p.loyalty_points??p.points??0));
  return `${pageHead('Account',{back:false,more:false})}
    <div class="jp-account-bento">
      <section class="membership-card membership-${member.tier.toLowerCase()} jp-account-client-card jp-account-client-card-simple">
        <div class="membership-brand">JUAN PROJECT</div>
        <div class="jp-account-card-identity jp-account-card-identity-simple">
          <div><span class="jp-card-field-label">Name</span><h2>${esc(p.name||'Client')}</h2></div>
          <button type="button" id="jpViewQr" class="jp-view-qr">View QR</button>
        </div>
        <div class="jp-account-card-meta jp-account-card-meta-simple">
          <div><span>Client ID</span><b>${esc(p.client_code||'—')}</b></div>
          <div><span>Member Since</span><b>${esc(joined)}</b></div>
          <div><span>Status</span><b>Active</b></div>
        </div>
      </section>

      <section class="card jp-account-tile jp-account-rewards"><span class="jp-account-tile-kicker">MEMBERSHIP</span><div class="jp-account-tile-head"><div><h3>${esc(member.tier)}</h3><p>${points} loyalty point${points===1?'':'s'}</p></div><b>${member.progress}%</b></div><div class="membership-track light"><i style="width:${member.progress}%"></i></div><small>${esc(tierMessage)}</small><button type="button" id="jpOpenRewards" class="text-button">My Client Rewards →</button></section>

      <section class="card account-status-card jp-account-tile"><div><span class="jp-account-tile-kicker">ACCOUNT STATUS</span><h3>Active</h3><p>${esc(p.client_code||'Client')} · Member since ${esc(joined)}</p></div><span class="account-status-pill">Synced</span></section>

      <section class="card jp-account-tile jp-account-referral"><span class="jp-account-tile-kicker">REFERRAL</span><h3>${esc(referralCode)}</h3><p>Share your referral code with a friend.</p><button type="button" id="jpAccountReferralDesktop" class="btn small">Share Code</button></section>

      <section class="settings-group jp-account-password-tile"><div class="settings-label">SECURITY</div><div class="card settings-list"><div class="settings-row password-settings"><div class="settings-password-copy"><b>Change Password</b><small>Update your current portal password.</small></div><div class="settings-password-form"><div class="password-input-wrap"><input id="newPass" class="input" type="password" minlength="8" placeholder="New password"><button type="button" class="password-eye" data-toggle-pass="newPass">${icon('eye',18)}</button></div><div class="password-input-wrap"><input id="newPass2" class="input" type="password" minlength="8" placeholder="Confirm password"><button type="button" class="password-eye" data-toggle-pass="newPass2">${icon('eye',18)}</button></div><button id="changePass" class="btn full">Update Password</button></div></div></div></section>

      <section class="settings-group jp-account-notification-tile"><div class="settings-label">NOTIFICATIONS</div><div class="card settings-list"><button type="button" id="enableBrowserNotifications" class="settings-row settings-row-button"><div><b>Browser Notifications</b><small>Project, payment, invoice, and file updates · ${esc(notificationLabel)}</small></div>${icon('chevron',17)}</button></div></section>

      <section class="settings-group jp-account-legal-tile"><div class="settings-label">ACCOUNT & LEGAL</div><div class="card settings-list"><a class="settings-row settings-link" href="mailto:ws.benzeldelmo@gmail.com?subject=JUAN%20PROJECT%20Online%20Support"><div><b>Help & Support</b><small>Contact JUAN PROJECT</small></div>${icon('chevron',17)}</a><a class="settings-row settings-link" href="/terms.html"><div><b>Terms & Conditions</b><small>Service terms</small></div>${icon('chevron',17)}</a><a class="settings-row settings-link" href="/privacy.html"><div><b>Privacy Policy</b><small>Privacy and device storage</small></div>${icon('chevron',17)}</a><div class="settings-row danger" id="logout"><b>Log Out</b>${icon('chevron',17)}</div></div></section>
    </div>`;
}

function categoryName(id){return state.catalog.categories.find(c=>c.id===id)?.name||'Service'}
function shopRow(x){
  const price=x.kind==='Package'?Number(x.new_price||0):Number(x.price||0),old=x.kind==='Package'?Number(x.original_price||0):0;
  return '<article class="jp-shop-card"><button class="jp-shop-main" data-view-shop="'+esc(x.kind+':'+x.id)+'"><div class="jp-shop-copy"><span>'+esc(x.product_code||'')+' · '+esc(x.kind==='Package'?'Package':categoryName(x.category_id))+'</span><h3>'+esc(x.name)+'</h3><p>'+esc((x.description||'Creative service').slice(0,82))+'</p><div class="jp-shop-price"><b>'+peso(price)+'</b>'+(old>price?'<s>'+peso(old)+'</s>':'')+'</div></div></button><button class="btn primary jp-add-cart" data-add-cart="'+esc(x.kind+':'+x.id)+'">Add to Cart</button></article>';
}
function shop(){
  const packages=[...(state.catalog.packages||[])].sort((a,b)=>String(a.product_code||a.id).localeCompare(String(b.product_code||b.id),undefined,{numeric:true})).map(x=>({...x,kind:'Package'}));
  const services=[...(state.catalog.services||[])].sort((a,b)=>String(a.product_code||a.id).localeCompare(String(b.product_code||b.id),undefined,{numeric:true})).map(x=>({...x,kind:'Service'}));
  const all=[...packages,...services],active=state.shopCategory||'all',q=String(state.shopQuery||'').trim().toLowerCase();
  let items=all.filter(x=>active==='all'||(active==='packages'&&x.kind==='Package')||(x.kind==='Service'&&String(x.category_id)===active));
  items=items.filter(x=>!q||[x.name,x.description,x.kind,categoryName(x.category_id),x.product_code].some(v=>String(v||'').toLowerCase().includes(q)));
  const count=window.JPMobileCommerce?.cartCount?.()||0,total=window.JPMobileCommerce?.cartTotal?.()||0;
  const chips='<button data-shop-category="all" class="'+(active==='all'?'active':'')+'">All</button><button data-shop-category="packages" class="'+(active==='packages'?'active':'')+'">Packages</button>'+(state.catalog.categories||[]).map(c=>'<button data-shop-category="'+esc(c.id)+'" class="'+(active===String(c.id)?'active':'')+'">'+esc(c.name)+'</button>').join('');
  return '<div class="jp-shop-sticky">'+pageHead('Shop',{back:false,more:false})+'<div class="jp-shop-head"><div class="shop-search"><span>'+icon('search',17)+'</span><input id="shopSearch" value="'+esc(state.shopQuery)+'" placeholder="Search services or packages..."></div><button id="shopOrderCart" class="jp-cart-icon" aria-label="Cart">'+icon('cart',20)+'<span>'+count+'</span></button></div><div class="jp-category-chips">'+chips+'</div></div><div class="jp-shop-scroll"><div id="jpAdBannerAnchor"></div><div class="jp-shop-grid">'+(items.map(shopRow).join('')||'<div class="card empty guided-empty"><b>No matching services</b></div>')+'</div></div><div class="jp-shop-footer">'+(count?'<button id="shopMiniCart" class="jp-mini-cart"><span><b>'+count+' item'+(count===1?'':'s')+'</b><small>'+peso(total)+'</small></span><strong>View Cart →</strong></button>':'<div class="jp-shop-item-indicator">Your cart is empty</div>')+'</div>';
}
function findShopItem(key){const [kind,id]=String(key).split(':');if(kind==='Package')return {...state.catalog.packages.find(x=>String(x.id)===String(id)),kind};return {...state.catalog.services.find(x=>String(x.id)===String(id)),kind:'Service'}}

function routePage(){if(state.route==='home')return home();if(state.route==='shop')return shop();if(state.route==='orders')return orders();if(state.route==='project')return project();if(state.route==='payment')return payment();if(state.route==='invoice')return invoice();if(state.route==='account')return account();return home()}
function render(){root.innerHTML=`<div class="app ${isLoggedIn()?'client-mode':'guest-mode'} route-${esc(state.route||'home')}"><main class="page route-${esc(state.route||'home')}">${routePage()}</main>${nav()}${gateOverlay()}${shopOverlay()}${notificationOverlay()}${clientMessageOverlay()}</div>`;bind();window.dispatchEvent(new Event('juan-online-render'));}

function bind(){
  document.querySelectorAll('.nav [data-r]').forEach(b=>b.onclick=()=>{const r=b.dataset.r;if(!isLoggedIn()&&['orders','payment'].includes(r))return gate(r);state.route=r;render()});
  document.querySelectorAll('.nav [data-guest-action]').forEach(b=>b.onclick=()=>{if(b.dataset.guestAction==='track')return window.JPMobileCommerce?.openTrack?.();if(b.dataset.guestAction==='login')return authScreen();});
  document.querySelectorAll('[data-open]').forEach(x=>x.onclick=()=>{if(!isLoggedIn())return gate('orders');state.selected=x.dataset.open;state.route='project';render()});
  document.querySelectorAll('[data-drive]').forEach(x=>x.onclick=()=>window.open(x.dataset.drive,'_blank','noopener'));
  const topAccount=document.getElementById('topAccount');if(topAccount)topAccount.onclick=()=>{state.route='account';render()};
  const homeShop=document.getElementById('homeShop');if(homeShop)homeShop.onclick=()=>{state.route='shop';render()};
  const homeTrack=document.getElementById('homeTrack');if(homeTrack)homeTrack.onclick=()=>window.JPMobileCommerce?.openTrack?.();
  const homePayNow=document.getElementById('homePayNow');if(homePayNow)homePayNow.onclick=()=>{state.paymentProjectId=(activeProject()||latestProject())?.id||null;state.route='payment';render()};
  const activityAll=document.getElementById('homeActivityAll');if(activityAll)activityAll.onclick=()=>{document.querySelector('.home-activity-card')?.classList.add('expanded');activityAll.textContent='Showing all';activityAll.disabled=true;};
  const clientStartOrder=document.getElementById('clientStartOrder');if(clientStartOrder)clientStartOrder.onclick=()=>{state.route='shop';render()};
  const clientTrackRequest=document.getElementById('clientTrackRequest');if(clientTrackRequest)clientTrackRequest.onclick=()=>{state.orderFilter='requests';state.route='orders';render()};
  const clientCardAction=document.getElementById('clientCardAction');if(clientCardAction)clientCardAction.onclick=async()=>{
    let loadingTimer=setTimeout(()=>{clientCardAction.classList.add('is-loading');clientCardAction.setAttribute('aria-busy','true');},220);
    try{await window.JuanSuite?.card?.();}
    catch(e){toast(e?.message||'Could not open your client card.');}
    finally{clearTimeout(loadingTimer);clientCardAction.classList.remove('is-loading');clientCardAction.removeAttribute('aria-busy');}
  };
  const ordersStartNew=document.getElementById('ordersStartNew');if(ordersStartNew)ordersStartNew.onclick=()=>{state.route='shop';render()};
  document.querySelectorAll('[data-request-open]').forEach(b=>b.onclick=()=>{const req=(state.portal?.orderRequests||[]).find(x=>String(x.id)===String(b.dataset.requestOpen));if(req)window.JPMobileCommerce?.trackClientRequest?.(req);});
  const homeLogIn=document.getElementById('homeLogIn');if(homeLogIn)homeLogIn.onclick=()=>authScreen();
  const guestAccountLogin=document.getElementById('guestAccountLogin');if(guestAccountLogin)guestAccountLogin.onclick=()=>authScreen();
  const membershipQr=document.getElementById('membershipQr');if(membershipQr)membershipQr.onclick=()=>window.JuanSuite?.card?.();
  const jpViewQr=document.getElementById('jpViewQr');if(jpViewQr)jpViewQr.onclick=()=>window.JPOnlineAccountActions?.openQr?.();
  const jpOpenRewards=document.getElementById('jpOpenRewards');if(jpOpenRewards)jpOpenRewards.onclick=()=>window.JPOnlineAccountActions?.openRewards?.();
  const jpAccountReferralDesktop=document.getElementById('jpAccountReferralDesktop');if(jpAccountReferralDesktop)jpAccountReferralDesktop.onclick=()=>window.JPOnlineAccountActions?.shareReferral?.();
  const notificationBtn=document.getElementById('notificationBtn');if(notificationBtn)notificationBtn.onclick=()=>{state.notificationOpen=true;render()};
  const allowBrowserNotifications=document.getElementById('allowBrowserNotifications');if(allowBrowserNotifications)allowBrowserNotifications.onclick=enableBrowserNotifications;
  const enableBrowserNotificationsBtn=document.getElementById('enableBrowserNotifications');if(enableBrowserNotificationsBtn)enableBrowserNotificationsBtn.onclick=enableBrowserNotifications;
  const nextActionBtn=document.getElementById('nextActionBtn');if(nextActionBtn)nextActionBtn.onclick=()=>{const p=activeProject(),a=nextAction(p);if(a.route==='project'&&p)state.selected=p.id;if(a.route==='payment'&&p)state.paymentProjectId=p.id;if(a.route)state.route=a.route;render()};
  const back=document.getElementById('screenBack');if(back&&!back.disabled)back.onclick=()=>{if(state.route==='invoice'){state.route='project'}else if(state.route==='project'){state.route='orders'}else{state.route='home'}render()};
  document.querySelectorAll('[data-order-filter]').forEach(b=>b.onclick=()=>{state.orderFilter=b.dataset.orderFilter;render()});
  const payProject=document.getElementById('payProject');if(payProject)payProject.onclick=()=>{state.paymentProjectId=state.selected;state.route='payment';render()};
  const invoiceBtn=document.getElementById('projectInvoiceBtn');if(invoiceBtn)invoiceBtn.onclick=()=>{state.route='invoice';render()};
  document.querySelectorAll('[data-view-shop]').forEach(b=>b.onclick=()=>{state.shopItem=findShopItem(b.dataset.viewShop);render()});
  document.querySelectorAll('[data-add-cart]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const [kind,id]=b.dataset.addCart.split(':');const y=window.scrollY;await window.JPMobileCommerce?.addCatalogItem?.(kind,id);const count=window.JPMobileCommerce?.cartCount?.()||0,total=window.JPMobileCommerce?.cartTotal?.()||0;const badge=document.querySelector('#shopOrderCart span');if(badge)badge.textContent=count;const footer=document.querySelector('.jp-shop-footer');if(footer&&count){footer.innerHTML='<button id="shopMiniCart" class="jp-mini-cart"><span><b>'+count+' item'+(count===1?'':'s')+'</b><small>'+peso(total)+'</small></span><strong>View Cart →</strong></button>';document.getElementById('shopMiniCart').onclick=()=>window.JPMobileCommerce?.openCart?.();}requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'instant'}));});
  const shopOrderCart=document.getElementById('shopOrderCart');if(shopOrderCart)shopOrderCart.onclick=()=>window.JPMobileCommerce?.openCart?.();
  const shopMiniCart=document.getElementById('shopMiniCart');if(shopMiniCart)shopMiniCart.onclick=()=>window.JPMobileCommerce?.openCart?.();
  const shopSort=document.getElementById('shopSort');if(shopSort)shopSort.onchange=()=>{state.shopSort=shopSort.value;render()};
  const shopSearch=document.getElementById('shopSearch');if(shopSearch){shopSearch.oninput=()=>{state.shopQuery=shopSearch.value;const pos=shopSearch.selectionStart;render();const next=document.getElementById('shopSearch');if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch{}}}};
  document.querySelectorAll('[data-shop-category]').forEach(b=>b.onclick=()=>{state.shopCategory=b.dataset.shopCategory||'all';render();});
  const paymentHistoryTab=document.getElementById('paymentHistoryTab');if(paymentHistoryTab)paymentHistoryTab.onclick=()=>document.querySelector('.payment-history')?.scrollIntoView({behavior:'smooth'});
  const projectSel=document.getElementById('payProjectSel');if(projectSel)projectSel.onchange=()=>{state.paymentProjectId=projectSel.value;render()};

  const receipt=document.getElementById('receipt'),receiptLabel=document.getElementById('receiptLabel'),submitBtn=document.getElementById('submitPayment');
  const institutionInput=document.getElementById('payInstitutionSearch'),refInput=document.getElementById('payRef');
  const setInlineError=(id,msg='')=>{const el=document.getElementById(id);if(el)el.textContent=msg;};
  const resolveInstitution=()=>getPaymentInstitution(state.senderInstitution)||PAYMENT_INSTITUTIONS.find(x=>x.name.toLowerCase()===String(institutionInput?.value||'').trim().toLowerCase())||null;
  const validatePaymentForm=()=>{
    if(!submitBtn)return false;
    const inst=getPaymentInstitution(state.senderInstitution),amountEl=document.getElementById('payAmount'),dateEl=document.getElementById('payDate'),projectEl=document.getElementById('payProjectSel');
    const amount=Number(amountEl?.value||0),date=dateEl?.value||'',reference=sanitizePaymentReference(refInput?.value||''),refCheck=validatePaymentReference(inst?.code||'',reference),receiptOk=Boolean(state.receiptPath),projectOk=Boolean(projectEl?.value);
    if(refInput&&refInput.value!==reference)refInput.value=reference;
    setInlineError('amountValidation',amountEl?.value&&!(amount>0)?'Amount paid must be greater than 0.':'');
    setInlineError('dateValidation',dateEl?.value===''&&document.activeElement===dateEl?'Payment date is required.':'');
    setInlineError('referenceValidation',reference&&!refCheck.ok?refCheck.message:'');
    const ok=Boolean(inst&&amount>0&&date&&refCheck.ok&&receiptOk&&projectOk);
    submitBtn.disabled=!ok;
    const check=document.getElementById('paymentSystemCheck');if(check){check.classList.toggle('verified',ok);check.innerHTML=ok?`<b>System verification passed</b><span>Sender, reference format, required fields, and receipt are ready for server verification.</span>`:`<b>System verification</b><span>Complete all required fields. Payment cannot be sent until every check passes.</span>`;}
    return ok;
  };
  const refreshInstitution=()=>{
    const inst=resolveInstitution();state.senderInstitution=inst?.code||'';const transferFeeField=document.getElementById('payTransferFee');if(transferFeeField)transferFeeField.value=['gcash','maya'].includes(inst?.code)?'10':'0';
    const preview=document.getElementById('institutionPreview'),hint=document.getElementById('referenceHint');
    if(preview){preview.classList.toggle('hidden',!inst);preview.innerHTML=inst?`<img src="${esc(inst.logo)}" alt="${esc(inst.name)} logo"><div><b>${esc(inst.name)}</b><small>${esc(inst.type)} · ${esc(inst.hint)}</small></div>`:'';}
    if(refInput)refInput.placeholder=inst?.example||'Select sender first';if(hint)hint.textContent=inst?.hint||'Reference format changes with the selected sender.';
    setInlineError('institutionValidation',institutionInput?.value&&!inst?'Select a bank or e-wallet from the list.':'');
    if(refInput?.value){const chk=validatePaymentReference(inst?.code||'',refInput.value);setInlineError('referenceValidation',chk.ok?'':chk.message)}
    validatePaymentForm();
  };
  const institutionDropdown=document.getElementById('paymentInstitutionDropdown'),institutionToggle=document.getElementById('institutionToggle');
  const setInstitutionDropdown=open=>{if(!institutionDropdown||!institutionInput)return;institutionDropdown.classList.toggle('hidden',!open);institutionInput.setAttribute('aria-expanded',open?'true':'false')};
  const filterInstitutions=()=>{if(!institutionDropdown)return;const q=String(institutionInput?.value||'').trim().toLowerCase();institutionDropdown.querySelectorAll('.institution-option').forEach(option=>{const hay=String(option.dataset.institutionName||'').toLowerCase();option.classList.toggle('hidden',Boolean(q&&!hay.includes(q)))});setInstitutionDropdown(true)};
  if(institutionInput){institutionInput.addEventListener('focus',()=>{filterInstitutions()});institutionInput.addEventListener('input',()=>{state.senderInstitution='';filterInstitutions();refreshInstitution()});institutionInput.addEventListener('keydown',e=>{if(e.key==='Escape')setInstitutionDropdown(false)});}
  if(institutionToggle)institutionToggle.onclick=()=>setInstitutionDropdown(institutionDropdown?.classList.contains('hidden'));
  institutionDropdown?.querySelectorAll('.institution-option').forEach(option=>option.onclick=()=>{state.senderInstitution=option.dataset.institutionCode||'';institutionInput.value=option.dataset.institutionName||'';setInstitutionDropdown(false);refreshInstitution()});
  document.addEventListener('click',e=>{const box=document.getElementById('institutionCombobox');if(box&&institutionDropdown&&!box.contains(e.target))setInstitutionDropdown(false)},{once:true,capture:true});
  if(refInput)refInput.addEventListener('input',()=>{const clean=sanitizePaymentReference(refInput.value);if(refInput.value!==clean)refInput.value=clean;const chk=validatePaymentReference(state.senderInstitution,clean);setInlineError('referenceValidation',clean&&!chk.ok?chk.message:'');validatePaymentForm()});
  const previewReceiptBtn=document.getElementById('previewReceiptBtn'),receiptFileName=document.getElementById('receiptFileName');
  const openReceiptPreview=()=>{if(!state.receiptPreviewUrl)return;const old=document.getElementById('receiptPreviewOverlay');if(old)old.remove();const overlay=document.createElement('div');overlay.id='receiptPreviewOverlay';overlay.className='overlay receipt-preview-overlay';overlay.innerHTML=`<div class="sheet receipt-preview-sheet"><button type="button" class="icon-button sheet-x" id="receiptPreviewClose" aria-label="Close">×</button><div class="receipt-preview-head"><span class="eyebrow">PAYMENT RECEIPT</span><h2>Receipt Preview</h2><p>${esc(state.receiptPreviewName||'Uploaded receipt')}</p></div><div class="receipt-preview-content">${state.receiptPreviewType==='application/pdf'?`<iframe src="${state.receiptPreviewUrl}" title="Receipt PDF preview"></iframe>`:`<img src="${state.receiptPreviewUrl}" alt="Uploaded payment receipt preview">`}</div><button type="button" class="btn full" id="receiptPreviewDone">Close Preview</button></div>`;document.body.appendChild(overlay);const close=()=>overlay.remove();overlay.addEventListener('click',e=>{if(e.target===overlay)close()});overlay.querySelector('#receiptPreviewClose').onclick=close;overlay.querySelector('#receiptPreviewDone').onclick=close;};
  if(previewReceiptBtn)previewReceiptBtn.onclick=openReceiptPreview;
  if(receipt)receipt.onchange=async()=>{const f=receipt.files?.[0];if(!f)return;try{if(!['image/jpeg','image/png','application/pdf'].includes(f.type))throw Error('Receipt must be a JPG, PNG, or PDF file.');if(f.size>5*1024*1024)throw Error('Receipt must be 5 MB or smaller.');if(state.receiptPreviewUrl)URL.revokeObjectURL(state.receiptPreviewUrl);state.receiptPreviewUrl=URL.createObjectURL(f);state.receiptPreviewType=f.type;state.receiptPreviewName=f.name;if(previewReceiptBtn)previewReceiptBtn.classList.remove('hidden');if(receiptFileName)receiptFileName.textContent=f.name;state.receiptPath=await uploadReceipt(f);if(receiptLabel)receiptLabel.textContent='Receipt uploaded';setInlineError('receiptValidation','');toast('Receipt uploaded securely.');validatePaymentForm()}catch(e){state.receiptPath=null;if(state.receiptPreviewUrl){URL.revokeObjectURL(state.receiptPreviewUrl);state.receiptPreviewUrl=''};state.receiptPreviewType='';state.receiptPreviewName='';previewReceiptBtn?.classList.add('hidden');if(receiptFileName)receiptFileName.textContent='';setInlineError('receiptValidation',e.message);toast(e.message);validatePaymentForm()}};
  const updateNet=()=>{const a=Number(document.getElementById('payAmount')?.value||0),f=Math.max(0,Number(document.getElementById('payTransferFee')?.value||0)),n=Math.max(0,a),el=document.getElementById('payNetAmount');if(el)el.textContent=peso(n);validatePaymentForm()};
  ['payAmount','payTransferFee','payDate'].forEach(id=>document.getElementById(id)?.addEventListener('input',updateNet));
  if(submitBtn)submitBtn.onclick=async()=>{try{
    if(!validatePaymentForm()){if(!state.receiptPath)setInlineError('receiptValidation','Upload your payment receipt before submitting.');if(!state.senderInstitution)setInlineError('institutionValidation','Select the sending bank or e-wallet.');if(!refInput?.value)setInlineError('referenceValidation','Reference number is required.');throw Error('Complete the highlighted payment details first.')}
    const projectSel=document.getElementById('payProjectSel'),method=getPaymentInstitution(state.senderInstitution),date=document.getElementById('payDate'),fee=document.getElementById('payTransferFee'),amount=Number(document.getElementById('payAmount')?.value||0),transferFee=Math.max(0,Number(fee?.value||0)),reference=sanitizePaymentReference(refInput?.value||''),refCheck=validatePaymentReference(method?.code||'',reference);if(!refCheck.ok)throw Error(refCheck.message);
    submitBtn.disabled=true;
    root.innerHTML=`<div class="flow-screen payment-processing-screen"><div class="flow-spinner"></div><span class="eyebrow">PAYMENT SUBMISSION</span><h2>Processing your payment…</h2><div class="processing-steps payment-process-timeline"><span class="done">Payment details complete</span><span class="done">Reference format verified</span><span class="done">Receipt uploaded</span><span class="active-step">Sending for secure review</span><span>Pending admin review</span></div><p>Please keep this page open for a moment.</p></div>`;
    await submitPaymentApi({projectId:projectSel.value,amount,paymentMethod:method.name,senderInstitution:method.code,referenceNumber:reference,paymentDate:date.value,transferFee,receiptPath:state.receiptPath,entrySource:'manual'});
    state.portal=await getPortal();state.receiptPath=null;state.senderInstitution='';if(state.receiptPreviewUrl)URL.revokeObjectURL(state.receiptPreviewUrl);state.receiptPreviewUrl='';state.receiptPreviewType='';state.receiptPreviewName='';
    root.innerHTML=`<div class="flow-screen success"><div class="flow-check">✓</div><span class="eyebrow">SUBMISSION RECEIVED</span><h2>Payment Submitted</h2><p>Your payment proof passed submission checks and is now waiting for JUAN PROJECT review.</p><div class="processing-steps payment-result-timeline"><span class="done">Details verified</span><span class="done">Receipt received</span><span class="done">Submitted successfully</span><span class="active-step">Pending review</span><span>Acceptance updates your balance</span></div><div class="success-summary"><div><span>Amount</span><b>${peso(amount)}</b></div><div><span>Status</span><b>Pending Review</b></div></div><button id="paymentBackOrder" class="btn primary full">Back to Order</button><button id="paymentHistoryDone" class="btn full">View Payment History</button></div>`;
    document.getElementById('paymentBackOrder').onclick=()=>{state.selected=projectSel.value;state.route='project';render()};document.getElementById('paymentHistoryDone').onclick=()=>{state.route='payment';render();setTimeout(()=>document.querySelector('.payment-history')?.scrollIntoView({behavior:'smooth'}),20)}
  }catch(e){toast(e.message||'Payment could not be submitted.');if(!document.getElementById('submitPayment')){state.route='payment';render()}}};
  document.querySelectorAll('[data-toggle-pass]').forEach(b=>b.onclick=()=>{const input=document.getElementById(b.dataset.togglePass);if(input)input.type=input.type==='password'?'text':'password'});
  const saveInvoice=document.getElementById('saveClientInvoice');if(saveInvoice)saveInvoice.onclick=()=>window.print();
  const saveInvoiceImage=document.getElementById('saveClientInvoiceImage');if(saveInvoiceImage)saveInvoiceImage.onclick=async()=>{try{saveInvoiceImage.disabled=true;saveInvoiceImage.textContent='Creating image…';const p=(state.portal?.projects||[]).find(x=>x.id===state.selected)||latestProject();await exportNodeAsPng(document.getElementById('clientInvoicePrintable'),`${p?.project_code||'JUAN-PROJECT'}-invoice.png`);toast('Invoice image saved.')}catch(e){toast(e.message||'Could not save invoice image.')}finally{if(document.body.contains(saveInvoiceImage)){saveInvoiceImage.disabled=false;saveInvoiceImage.textContent='Save as Image'}}};
  const profilePhotoInput=document.getElementById('profilePhotoInput');
  if(profilePhotoInput)profilePhotoInput.onchange=async()=>{const file=profilePhotoInput.files?.[0];if(!file)return;const status=document.getElementById('profilePhotoStatus');try{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use a JPG, PNG, or WebP image.');
    if(file.size>5*1024*1024)throw Error('Profile photo must be 5 MB or smaller.');
    if(status)status.textContent='Uploading…';
    const sb=await getSupabase(),sess=await session();if(!sess)throw Error('Please log in again.');
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path=`${sess.user.id}/profile.${ext}`;
    const up=await sb.storage.from('juan-profile-images').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(up.error)throw up.error;
    await setProfilePhoto(path);state.portal=await getPortal();if(status)status.textContent='Photo updated.';toast('Profile photo updated.');render();
  }catch(e){if(status)status.textContent=e.message||'Could not update photo.';toast(e.message||'Could not update photo.')}};
  const changeBtn=document.getElementById('changePass');if(changeBtn)changeBtn.onclick=async()=>{try{const p1=document.getElementById('newPass'),p2=document.getElementById('newPass2');if((p1?.value||'').length<8)throw Error('Use at least 8 characters.');if(p1.value!==p2.value)throw Error('Passwords do not match.');changeBtn.disabled=true;changeBtn.textContent='Updating…';await setPassword(p1.value);await markPasswordSet();toast('Password updated.');p1.value=p2.value=''}catch(e){toast(e.message)}finally{if(document.body.contains(changeBtn)){changeBtn.disabled=false;changeBtn.textContent='Update Password'}}};
  const logoutBtn=document.getElementById('logout');if(logoutBtn)logoutBtn.onclick=async()=>{stopPortalRealtimeSync();await signOut();localStorage.removeItem(REMEMBERED_CLIENT_KEY);state.portal=null;state.route='home';welcomeScreen()};
  const gateX=document.getElementById('gateX');if(gateX)gateX.onclick=()=>{state.gateOpen=false;render()};
  const gateLogIn=document.getElementById('gateLogIn');if(gateLogIn)gateLogIn.onclick=()=>authScreen();
  const gateShop=document.getElementById('gateShop');if(gateShop)gateShop.onclick=()=>{state.gateOpen=false;state.route='shop';render()};
  const notificationX=document.getElementById('notificationX');if(notificationX)notificationX.onclick=()=>{state.notificationOpen=false;render()};
  const messageClose=document.getElementById('messageClose');if(messageClose)messageClose.onclick=()=>{const m=state.clientMessage;if(m){if(m.type==='thanks')localStorage.setItem(m.key,'1');else sessionStorage.setItem(m.key,'1')}state.clientMessage=null;render()};
  const messagePay=document.getElementById('messagePay');if(messagePay)messagePay.onclick=()=>{const m=state.clientMessage;if(m)sessionStorage.setItem(m.key,'1');state.paymentProjectId=m?.projectId||null;state.clientMessage=null;state.route='payment';render()};
  const messageInvoice=document.getElementById('messageInvoice');if(messageInvoice)messageInvoice.onclick=()=>{const m=state.clientMessage;if(m)sessionStorage.setItem(m.key,'1');state.selected=m?.projectId||null;state.clientMessage=null;state.route='invoice';render()};
  const messageFiles=document.getElementById('messageFiles');if(messageFiles)messageFiles.onclick=()=>{const m=state.clientMessage,p=(state.portal?.projects||[]).find(x=>String(x.id)===String(m?.projectId));if(m)localStorage.setItem(m.key,'1');state.clientMessage=null;if(p?.drive_url)window.open(p.drive_url,'_blank','noopener');render()};
  const shopX=document.getElementById('shopX');if(shopX)shopX.onclick=()=>{state.shopItem=null;render()};
  const detailClose=document.getElementById('detailClose');if(detailClose)detailClose.onclick=()=>{state.shopItem=null;render()};
  const detailLogIn=document.getElementById('detailLogIn');if(detailLogIn)detailLogIn.onclick=()=>authScreen();
  const detailStartProject=document.getElementById('detailStartProject');if(detailStartProject)detailStartProject.onclick=async()=>{const item=state.shopItem;if(!item)return;await window.JPMobileCommerce?.addCatalogItem?.(item.kind,item.id);state.shopItem=null;render();};
  animatePaymentReminderBalance();
}

(async()=>{
  // V1.3.3.2: paint the first useful screen before any network request.
  if(window.JuanTest?.session()){localStorage.setItem(REMEMBERED_CLIENT_KEY,'1');}
  // Always paint a usable storefront immediately. Remembered sessions restore
  // in the background and replace it with the client portal when ready.
  const remembered=localStorage.getItem(REMEMBERED_CLIENT_KEY)==='1';
  welcomeScreen();

  // Public catalog never blocks guest UI.
  getCatalog().then(c=>{state.catalog=c;state.catalogLoaded=true;if(!isLoggedIn()&&state.route==='shop')render();}).catch(e=>console.warn('Catalog unavailable:',e?.message||e));

  if(remembered){
    try{await getSupabase();const s=await session();if(s)await loadPortal();else{localStorage.removeItem(REMEMBERED_CLIENT_KEY);state.portal=null;welcomeScreen()}}
    catch(e){console.warn('Saved client session could not be restored:',e?.message||e);state.portal=null;renderPortalLoadError(e);}
  }
})();

window.juanOnlineRefresh=async()=>{if(window.JuanTest?.session()){await loadPortal();}else{state.catalog=await getCatalog();state.catalogLoaded=true;render();}};
