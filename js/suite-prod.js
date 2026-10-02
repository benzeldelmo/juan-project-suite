const __JUAN_APP=window.JUAN_SUITE_APP||((document.querySelector('.app-container')||document.querySelector('#view-my-works'))?'workspace':'online');
let __JUAN_SB=null,__JUAN_SESSION=null,__JUAN_AUTH_BOUND=false;
async function __juanResolveClient(){
  let shared=window.supabaseClient;
  if(shared?.auth?.getSession){__JUAN_SB=shared;return shared}
  if(__JUAN_SB)return __JUAN_SB;
  if(__JUAN_APP==='workspace'){
    for(let attempt=0;attempt<40;attempt++){
      await new Promise(resolve=>setTimeout(resolve,50));
      shared=window.supabaseClient;
      if(shared?.auth?.getSession){__JUAN_SB=shared;return shared}
    }
    return null;
  }
  try{
    if(!window.supabase?.createClient)return null;
    const r=await fetch('/api/supabase-config',{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Supabase configuration unavailable');
    const url=j.url||j.SUPABASE_URL,key=j.publishableKey||j.SUPABASE_ANON_KEY;
    if(!url||!key)return null;
    __JUAN_SB=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return __JUAN_SB;
  }catch(e){console.warn('JUAN Suite database bootstrap deferred:',e?.message||e);return null}
}
async function __juanGetSession(){
  const sb=await __juanResolveClient();
  if(!sb)return null;
  try{
    const result=await sb.auth.getSession();
    __JUAN_SESSION=result?.data?.session||null;
    if(!__JUAN_AUTH_BOUND&&sb.auth?.onAuthStateChange){
      __JUAN_AUTH_BOUND=true;
      sb.auth.onAuthStateChange((_event,session)=>{__JUAN_SESSION=session||null});
    }
    return __JUAN_SESSION;
  }catch(e){console.warn('JUAN Suite session unavailable:',e?.message||e);return null}
}
async function __juanRequest(path,body){
 const session=await __juanGetSession();
 const headers={'Content-Type':'application/json'};if(session?.access_token)headers.Authorization='Bearer '+session.access_token;
 const r=await fetch(path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const type=r.headers.get('content-type')||'';const j=type.includes('application/json')?await r.json():{error:await r.text()};
 if(!r.ok)throw Error(j.error||'Request failed');return j;
}
window.JuanSuiteRuntime={app:__JUAN_APP,session:()=>__JUAN_SESSION,getSession:__juanGetSession,request:__juanRequest,preview:false,onlineUrl:'https://juan-project-online.vercel.app',workspaceUrl:'https://juan-project-workspace-v2.vercel.app',refresh:async()=>{if(__JUAN_APP==='workspace')return window.app?.refreshSharedTest?.();return window.juanOnlineRefresh?.()}};

/* JUAN PROJECT production extensions — Supabase/Vercel backed. */
(()=>{'use strict';
const T=window.JuanSuiteRuntime;if(!T)return;const admin=T.app==='workspace';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(v||0));
const url=(app,path='')=>{const base=app===T.app?location.origin:(app==='workspace'?T.workspaceUrl:T.onlineUrl);return base.replace(/\/$/,'')+'/'+String(path||'').replace(/^\//,'')};
const api=b=>T.request('/api/suite',b);const by=id=>document.getElementById(id);const stages=['Order Confirmed','Payment Confirmed','Production Started','In Production','Quality Check','Ready for Delivery','Completed'];
const CART_KEY='JUAN_ORDER_REQUEST_CART_V1';
function loadCart(){try{const x=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function persistCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch{}}
let dialog,stopCamera=()=>{},cart=loadCart(),catalog,lastReceipt;
function toast(msg){const e=document.createElement('div');e.className='suite-toast';e.textContent=msg;document.body.append(e);setTimeout(()=>e.remove(),4500)}
function close(){stopCamera();dialog?.remove();dialog=null}
function open(title,html,sub='JUAN PROJECT'){close();dialog=document.createElement('div');dialog.className='suite-overlay';dialog.innerHTML=`<section class="suite-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="suite-head"><div><small>${esc(sub)}</small><h2>${esc(title)}</h2></div><button data-close aria-label="Close">✕</button></header><div id="suiteError" role="alert"></div>${html}</section>`;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('click',e=>{if(e.target===dialog)close()});dialog.querySelector('button,input')?.focus();return dialog}
function error(e){const node=by('suiteError');if(node){node.className='suite-error';node.textContent=e.message||e}else toast(e.message||e)}
function bind(id,fn){const el=by(id);if(el)el.onclick=async()=>{el.disabled=true;try{await fn()}catch(e){error(e)}finally{el.disabled=false}}}
function empty(msg){return `<div class="suite-empty">${esc(msg)}</div>`}
function qr(text){return '/api/qr?text='+encodeURIComponent(text)}
function download(blob,name){const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function img(src){const i=new Image();i.src=src;await i.decode();return i}
async function shop(){catalog=await T.request('/api/catalog');const items=[...(catalog.services||[]).map(x=>({...x,kind:'service',cost:x.price})),...(catalog.packages||[]).map(x=>({...x,kind:'package',cost:x.new_price??x.selling_price}))];open('Shop & Order Request',`<div class="suite-row"><p class="suite-muted">Choose your services. No account needed.</p><button id="suiteCart" class="primary">Review order (${cart.reduce((s,x)=>s+x.qty,0)})</button></div><label>Search<input id="suiteSearch" placeholder="Service or package name"></label><div id="suiteProducts" class="suite-grid"></div>`);function draw(q=''){by('suiteProducts').innerHTML=items.filter(i=>i.name.toLowerCase().includes(q.toLowerCase())).map(i=>`<article class="suite-card"><small>${esc(i.product_code)} · ${esc(i.kind)}</small><h3>${esc(i.name)}</h3><p class="suite-muted">${esc(i.description||'')}</p><div class="suite-row"><b>${peso(i.cost)}</b><button data-add="${esc(i.id)}">Add to order</button></div></article>`).join('')||empty('No services available. Open Workspace once to load its catalog.');dialog.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const i=items.find(i=>i.id===b.dataset.add);const existing=cart.find(x=>x.id===i.id);if(existing)existing.qty++;else cart.push({id:i.id,type:i.kind,name:i.name,price:Number(i.cost||0),qty:1});persistCart();by('suiteCart').textContent=`Review order (${cart.reduce((s,x)=>s+x.qty,0)})`;toast('Added to your order')})}draw();by('suiteSearch').oninput=e=>draw(e.target.value);bind('suiteCart',checkout)}
async function addShopItemToOrder(kind,id){
  catalog=await T.request('/api/catalog');
  const isPackage=String(kind||'').toLowerCase()==='package';
  const source=isPackage?(catalog.packages||[]):(catalog.services||[]);
  const item=source.find(x=>String(x.id)===String(id));
  if(!item)throw Error('This catalog item is no longer available.');
  const price=Number(isPackage?(item.new_price??item.selling_price??item.original_price??0):(item.price||0));
  const existing=cart.find(x=>String(x.id)===String(item.id)&&String(x.type)===String(isPackage?'package':'service'));
  if(existing)existing.qty+=1;
  else cart.push({id:item.id,type:isPackage?'package':'service',name:item.name,price,qty:1});
  persistCart();
  toast('Added to your order request.');
  checkout();
}
function openOrderCart(){if(cart.length)return checkout();return shop()}
function checkout(){if(!cart.length)return toast('Add a service first.');const total=cart.reduce((s,i)=>s+i.price*i.qty,0);open('Review your order',`<div class="suite-scroll"><table><thead><tr><th>Item</th><th>Quantity</th><th>Amount</th><th></th></tr></thead><tbody>${cart.map((i,n)=>`<tr><td>${esc(i.name)}</td><td><input type="number" min="1" max="100" data-qty="${n}" value="${i.qty}" style="width:75px"></td><td>${peso(i.price*i.qty)}</td><td><button data-remove="${n}">Remove</button></td></tr>`).join('')}</tbody></table></div><h3>Subtotal ${peso(total)}</h3><p class="suite-muted">Requested dates earlier than the standard 14 days add ₱500 for each 4 days earlier. Final totals appear on your receipt.</p><form id="suiteCheckout"><div aria-hidden="true" style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="suite-grid"><label>Client name<input name="name" required maxlength="160"></label><label>Email<input name="email" type="email" required></label><label>Contact number<input name="phone" type="tel"></label><label>Project title<input name="title" required maxlength="160"></label><label>Requested date (optional)<input name="deadline" type="date" min="${new Date().toISOString().slice(0,10)}"></label></div><label>Notes<textarea name="notes" maxlength="3000"></textarea></label><button class="primary" type="submit">Submit Order Request</button></form>`);dialog.querySelectorAll('[data-qty]').forEach(e=>e.onchange=()=>{cart[+e.dataset.qty].qty=Math.max(1,Math.min(100,Math.trunc(+e.value)||1));persistCart();checkout()});dialog.querySelectorAll('[data-remove]').forEach(e=>e.onclick=()=>{cart.splice(+e.dataset.remove,1);persistCart();cart.length?checkout():shop()});const key=crypto.randomUUID();by('suiteCheckout').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const values=Object.fromEntries(new FormData(e.target));const r=await api({...values,action:'submit-order',key,items:cart});cart=[];persistCart();localStorage.setItem('JUAN_LAST_GUEST_TOKEN',r.token);receipt(r.order,r.token)}catch(e){error(e)}finally{b.disabled=false}}}
function receipt(o,token){
  lastReceipt={o,token};
  const link=token?url('online','#track='+token):'';
  const discount=Number(o.discount_amount||0);
  open('Order Request received',`<div class="suite-receipt"><h3>JUAN PROJECT</h3><p style="text-align:center">ORDER REQUEST RECEIPT<br>${esc(o.code)}</p><hr><div>${esc(o.name)}</div><b>${esc(o.title)}</b><div>${esc(new Date(o.created_at).toLocaleString())}</div><hr>${o.items.map(i=>`<div>${esc(i.name)}</div><div class="suite-row"><span>${i.qty} × ${peso(i.price)}</span><b>${peso(i.qty*i.price)}</b></div>`).join('')}<hr><div class="suite-row"><span>Subtotal</span><b>${peso(o.subtotal)}</b></div><div class="suite-row"><span>Rush fee</span><b>${peso(o.rush_fee)}</b></div>${discount>0?`<div class="suite-row"><span>Discount</span><b>- ${peso(discount)}</b></div>`:''}<div class="suite-row"><b>ESTIMATED TOTAL</b><b>${peso(o.total)}</b></div><hr><div style="text-align:center"><b>${esc(o.status)}</b>${link?`<img class="suite-qr" src="${qr(link)}" alt="Order request tracking QR">Scan to track your request.`:''}<br>Pricing and deadline remain subject to JUAN PROJECT review.<br><b>This is not an invoice or proof of payment.</b></div></div><div class="suite-tabs"><button id="receiptPNG">Save Image</button><button id="receiptShare">Share Image</button>${link?'<button id="receiptCopy">Copy Tracking Link</button><button id="receiptTrack" class="primary">Track Request</button>':''}</div>`);
  bind('receiptPNG',()=>saveReceipt(o,link));
  bind('receiptShare',()=>shareReceipt(o,link));
  bind('receiptCopy',async()=>{await navigator.clipboard.writeText(link);toast('Tracking link copied')});
  bind('receiptTrack',()=>track(token));
}
async function makeReceiptBlob(o,link=''){
  const c=document.createElement('canvas');c.width=700;c.height=910+o.items.length*76;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#111';x.textAlign='center';
  x.font='700 32px "SF Pro Text"';x.fillText('JUAN PROJECT',350,65);
  x.font='700 20px "SF Pro Text"';x.fillText('ORDER REQUEST RECEIPT',350,102);
  x.font='400 18px "SF Pro Text"';x.fillText(String(o.code||''),350,132);
  x.textAlign='left';let y=185;
  for(const text of [o.name,o.title,new Date(o.created_at).toLocaleString()]){x.fillText(String(text||'').slice(0,47),45,y);y+=33}
  y+=12;
  for(const i of o.items){x.fillText(String(i.name||'Order Item').slice(0,47),45,y);y+=30;x.fillText(`${i.qty} x ${peso(i.price)}`,45,y);x.textAlign='right';x.fillText(peso(i.qty*i.price),655,y);x.textAlign='left';y+=46}
  const rows=[['Subtotal',o.subtotal],['Rush fee',o.rush_fee]];
  if(Number(o.discount_amount||0)>0)rows.push(['Discount',-Number(o.discount_amount||0)]);
  rows.push(['ESTIMATED TOTAL',o.total]);
  for(const [l,v] of rows){x.fillText(l,45,y);x.textAlign='right';x.fillText((v<0?'- ':'')+peso(Math.abs(v)),655,y);x.textAlign='left';y+=38}
  x.textAlign='center';x.font='700 18px "SF Pro Text"';x.fillText(String(o.status||'Order Received'),350,y+16);
  if(link){x.drawImage(await img(qr(link)),230,y+42,240,240);x.font='400 16px "SF Pro Text"';x.fillText('Scan to track your order request',350,y+305);y+=335}else y+=70;
  x.font='400 15px "SF Pro Text"';x.fillText('Subject to review · Not an invoice or proof of payment',350,y+18);
  return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not create receipt image.')),'image/png',1));
}
async function saveReceipt(o,link){download(await makeReceiptBlob(o,link),String(o.code||'JUAN-ORDER')+'-request.png')}
async function shareReceipt(o,link){
  const blob=await makeReceiptBlob(o,link),name=String(o.code||'JUAN-ORDER')+'-request.png',file=new File([blob],name,{type:'image/png'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'JUAN PROJECT '+(o.code||'Order Request')});return}catch(e){if(e?.name==='AbortError')return}}
  download(blob,name);toast('Sharing is not available here, so the receipt image was saved instead.');
}
function trackingCard(o,token=''){
  const discount=Number(o.discount_amount||0);
  return `<div class="suite-card"><div class="suite-row"><h3>${esc(o.code)}</h3><span class="suite-badge">${esc(o.status)}</span></div><p><b>${esc(o.title)}</b><br>${esc(o.name)}</p><div class="suite-row"><span>Subtotal</span><b>${peso(o.subtotal)}</b></div><div class="suite-row"><span>Rush fee</span><b>${peso(o.rush_fee)}</b></div>${discount>0?`<div class="suite-row"><span>Discount</span><b>- ${peso(discount)}</b></div>`:''}<div class="suite-row"><span>Current total</span><b>${peso(o.total)}</b></div>${o.project_code?`<p>Project ${esc(o.project_code)} has been created. Use your JUAN PROJECT client portal for production tracking.</p>`:''}${o.review_note?`<div class="suite-card"><small>JUAN PROJECT REVIEW NOTE</small><p>${esc(o.review_note)}</p></div>`:''}</div>${o.status==='Needs Changes'&&token?'<label>Your updated instructions<textarea id="revisionNotes"></textarea></label><button id="resubmit">Resubmit Changes</button>':''}${o.status==='Revised Offer Sent'&&token?'<div class="suite-card"><b>Revised offer ready</b><p>Review the current pricing above. Accepting confirms that JUAN PROJECT may proceed to final approval.</p><button id="trackingAccept" class="primary">Accept Revised Offer</button></div>':''}<div class="suite-tabs">${token?'<button id="trackingRefresh">Refresh Status</button><button id="trackingReceipt">View Receipt</button>':'<button id="trackingLookupAgain">Track Another Request</button>'}</div>`;
}
async function track(token){
  if(!token){
    open('Track Order Request',`<p>Enter the email address used at checkout and your Order Request ID. You can also paste the secure tracking link from your QR receipt.</p><div class="suite-grid"><label>Order Request ID<input id="trackingCode" placeholder="OR-001"></label><label>Email address<input id="trackingEmail" type="email" placeholder="you@example.com"></label></div><label>Secure tracking link (optional)<input id="trackingToken" value="${esc(localStorage.getItem('JUAN_LAST_GUEST_TOKEN')||'')}" placeholder="Paste tracking link or token"></label><div class="suite-tabs"><button id="trackingLookup" class="primary">Track Request</button><button id="trackingTokenGo">Use Secure Link</button></div>`);
    bind('trackingLookup',()=>trackByIdentity(by('trackingCode').value,by('trackingEmail').value));
    bind('trackingTokenGo',()=>{const value=by('trackingToken').value.split('#track=').pop().trim();if(!value)throw Error('Paste your secure tracking link or token.');return track(value)});
    return;
  }
  const {order:o}=await api({action:'track',token});
  open('Order Request Tracking',trackingCard(o,token));
  bind('trackingRefresh',()=>track(token));bind('trackingReceipt',()=>receipt(o,token));
  bind('resubmit',async()=>{await api({action:'resubmit',token,notes:by('revisionNotes').value});await track(token)});
  bind('trackingAccept',async()=>{await api({action:'accept-revision',token});toast('Revised offer accepted.');await track(token)});
}
async function trackByIdentity(code,email){
  const {order:o}=await api({action:'track-public',code,email});
  open('Order Request Tracking',trackingCard(o,''));
  bind('trackingLookupAgain',()=>track());
}
async function incoming(){
  const d=await api({action:'dashboard'});
  const requests=d.incoming_orders||[],pending=requests.filter(o=>!['Approved','Rejected'].includes(String(o.status||''))).length;
  open('Orders',`<div class="suite-row"><div><small>ORDER REQUESTS</small><h3>${pending} request${pending===1?'':'s'} need attention</h3></div><div class="suite-tabs"><button id="incomingRefresh">Refresh</button><button id="adminDrafts">Drafts</button><button id="adminScan">Scan QR</button><button id="adminNew" class="primary">+ New Order</button></div></div><div class="suite-scroll"><table><thead><tr><th>Request</th><th>Client</th><th>Current Total</th><th>Status</th><th></th></tr></thead><tbody>${requests.map(o=>`<tr><td><b>${esc(o.code)}</b><br>${esc(o.title)}</td><td>${esc(o.name)}<br><small>${esc(o.email)}</small></td><td>${peso(o.total)}</td><td><span class="suite-badge">${esc(o.status)}</span></td><td><button data-review="${esc(o.id)}">Review</button></td></tr>`).join('')}</tbody></table>${requests.length?'':empty('Order requests submitted through JUAN PROJECT Online will appear here.')}</div>`);
  dialog.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewOrder(requests.find(o=>o.id===b.dataset.review)));
  bind('incomingRefresh',incoming);bind('adminScan',scanner);bind('adminNew',()=>{close();window.app.navigateTo('new-order')});
  bind('adminDrafts',async()=>{const x=await T.request('/api/drafts');open('Admin Drafts',x.drafts.map(v=>`<div class="suite-card"><h3>${esc(v.title)}</h3><p>${esc(v.project_name||'')}</p></div>`).join('')||empty('No admin-created drafts.'))});
}
function reviewOrder(o){
  if(!o)return;
  if(o.project_id){projectTools(o.project_id);return}
  let items=(o.items||[]).map(i=>({...i,includedItems:Array.isArray(i.includedItems)?i.includedItems:[]}));
  open('Review '+o.code,`<div class="suite-grid"><div class="suite-card"><small>CLIENT</small><h3>${esc(o.name)}</h3><p>${esc(o.email)}<br>${esc(o.phone||'No contact number')}</p><b>${esc(o.title)}</b><p>${esc(o.notes||'No additional notes.')}</p><p class="suite-muted">${o.deadline?'Requested date: '+esc(o.deadline):'No requested deadline'}</p></div><div class="suite-card"><div class="suite-row"><div><small>REQUEST STATUS</small><h3>${esc(o.status)}</h3></div><span class="suite-badge">${esc(o.code)}</span></div><p class="suite-muted">Edit the request before creating a Project ID. Nothing becomes a project until you approve it.</p></div></div><h3>Order Items</h3><div class="suite-scroll"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th><th></th></tr></thead><tbody id="orderReviewItems"></tbody></table></div><button id="orderAddItem">+ Add Custom Item</button><div class="suite-grid"><label>Discount<input id="orderDiscount" type="number" min="0" step="0.01" value="${Number(o.discount_amount||0)}"></label><label>Rush Fee<input id="orderRush" type="number" min="0" step="0.01" value="${Number(o.rush_fee||0)}"></label></div><div class="suite-card"><div class="suite-row"><span>Subtotal</span><b id="orderSubtotal"></b></div><div class="suite-row"><span>Discount</span><b id="orderDiscountView"></b></div><div class="suite-row"><span>Rush Fee</span><b id="orderRushView"></b></div><div class="suite-row"><strong>Final Quote</strong><strong id="orderTotal"></strong></div><button id="orderAutoRush">Recalculate Rush Fee</button></div><label>Review note<textarea id="orderReviewNote">${esc(o.review_note||'')}</textarea></label><div class="suite-tabs"><button id="orderSave">Save Review</button><button id="orderOffer">Send Revised Offer</button><button id="orderChanges">Needs Changes</button><button id="orderReject">Reject</button><button id="orderApprove" class="primary">Approve & Create Project</button></div><p class="suite-muted">Approval reuses an existing client with the same email when possible. Only approval creates the Project ID.</p>`);
  const draw=()=>{
    const tbody=by('orderReviewItems');if(!tbody)return;
    tbody.innerHTML=items.map((i,n)=>`<tr><td><input data-rname="${n}" value="${esc(i.name||'Order Item')}" maxlength="180"></td><td><input data-rqty="${n}" type="number" min="1" max="100" value="${Math.max(1,Number(i.qty||1))}" style="width:70px"></td><td><input data-rprice="${n}" type="number" min="0" step="0.01" value="${Number(i.price||0)}" style="width:110px"></td><td data-ramount="${n}"></td><td><button data-rremove="${n}">Remove</button></td></tr>`).join('');
    dialog.querySelectorAll('[data-rremove]').forEach(b=>b.onclick=()=>{items.splice(Number(b.dataset.rremove),1);draw();recalc()});
    dialog.querySelectorAll('[data-rname],[data-rqty],[data-rprice]').forEach(input=>input.oninput=recalc);
    recalc();
  };
  const collect=()=>items.map((base,n)=>({...base,name:String(dialog.querySelector(`[data-rname="${n}"]`)?.value||base.name||'Order Item').trim(),qty:Math.max(1,Math.min(100,Math.trunc(Number(dialog.querySelector(`[data-rqty="${n}"]`)?.value||1)))),price:Math.max(0,Number(dialog.querySelector(`[data-rprice="${n}"]`)?.value||0))}));
  const recalc=()=>{
    const current=collect(),subtotal=current.reduce((sum,i)=>sum+i.qty*i.price,0),discount=Math.max(0,Number(by('orderDiscount')?.value||0)),rush=Math.max(0,Number(by('orderRush')?.value||0)),total=Math.max(0,subtotal+rush-discount);
    by('orderSubtotal').textContent=peso(subtotal);by('orderDiscountView').textContent='- '+peso(discount);by('orderRushView').textContent=peso(rush);by('orderTotal').textContent=peso(total);
    current.forEach((i,n)=>{const cell=dialog.querySelector(`[data-ramount="${n}"]`);if(cell)cell.textContent=peso(i.qty*i.price)});
    return {items:current,discount_amount:discount,rush_fee:rush};
  };
  const save=async send=>{
    const payload=recalc();const note=by('orderReviewNote').value;
    const {order}=await api({action:'revise-order',id:o.id,...payload,note,send_to_client:send});
    toast(send?'Revised offer sent to tracking page.':'Order request review saved.');reviewOrder(order);
  };
  draw();by('orderDiscount').oninput=recalc;by('orderRush').oninput=recalc;
  bind('orderAddItem',()=>{items.push({id:crypto.randomUUID(),name:'Custom Item',type:'service',price:0,qty:1,includedItems:[]});draw()});
  bind('orderAutoRush',()=>{const d=o.deadline?new Date(o.deadline+'T00:00:00'):null;if(!d||Number.isNaN(d.getTime()))throw Error('This request has no valid requested deadline.');const start=new Date();start.setHours(0,0,0,0);const days=Math.max(0,Math.round((d-start)/86400000)),standard=collect().some(i=>String(i.type).toLowerCase()==='package')?14:10;by('orderRush').value=String(Math.ceil(Math.max(0,standard-days)/4)*500);recalc()});
  bind('orderSave',()=>save(false));bind('orderOffer',()=>save(true));
  for(const [id,status] of [['orderChanges','Needs Changes'],['orderReject','Rejected']])bind(id,async()=>{const note=by('orderReviewNote').value;if(!note.trim())throw Error('Add a review note first.');await api({action:'review-order',id:o.id,status,note});incoming()});
  bind('orderApprove',async()=>{const payload=recalc();await api({action:'revise-order',id:o.id,...payload,note:by('orderReviewNote').value,send_to_client:false});const result=await api({action:'convert',id:o.id});await T.refresh();toast('Order approved. Project ID created.');projectTools(result.project.id)});
}
async function scanner(){open('Workspace QR Scanner',`<p>Scan a JUAN Client Card or Order Request QR, or enter its Client / Order Request ID.</p><label>QR contents or ID<input id="scanValue" placeholder="CL-001, OR-001, or tracking link"></label><div class="suite-tabs"><button id="scanFind" class="primary">Open record</button><button id="scanCamera">Start camera</button><label>Scan an image<input id="scanImage" type="file" accept="image/*"></label></div><video id="scanVideo" playsinline muted></video><div id="scanResult"></div>`);const find=async value=>{const r=await api({action:'lookup',value});if(r.kind==='client'){close();window.app.openClientProfile(r.record.id)}else{const d=await api({action:'dashboard'});reviewOrder(d.incoming_orders.find(o=>o.id===r.record.id))}};bind('scanFind',()=>find(by('scanValue').value));const detector=()=>({async detect(source){const canvas=document.createElement('canvas');canvas.width=source.videoWidth||source.width;canvas.height=source.videoHeight||source.height;if(!canvas.width||!canvas.height)return [];const x=canvas.getContext('2d',{willReadFrequently:true});x.drawImage(source,0,0);const pixels=x.getImageData(0,0,canvas.width,canvas.height);const result=window.jsQR(pixels.data,pixels.width,pixels.height);return result?[{rawValue:result.data}]:[]}});bind('scanCamera',async()=>{const d=detector(),stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}),v=by('scanVideo');v.srcObject=stream;await v.play();let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{const codes=await d.detect(v);if(codes[0]){stopCamera();await find(codes[0].rawValue)}}catch(e){error(e)}finally{busy=false}},350);stopCamera=()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop())}});by('scanImage').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const bitmap=await createImageBitmap(f);try{const codes=await detector().detect(bitmap);if(!codes.length)throw Error('No QR code found. Try a clearer image.');await find(codes[0].rawValue)}finally{bitmap.close()}}catch(e){error(e)}}}
async function card(){const {client:c}=await api({action:'client-card'});const link=url('workspace','#client='+c.qr_token);let back=false;open('JUAN Membership Card',`<button id="clientCard" class="suite-client-card" aria-label="Flip membership card"></button><div class="suite-tabs"><button id="cardFull">Full-screen QR</button><button id="cardSave">Save Card Image</button></div><p style="text-align:center" class="suite-muted">Tap the card to flip. Your QR identifies your JUAN PROJECT client profile to Workspace.</p>`);function draw(){by('clientCard').innerHTML=back?`<img class="suite-qr" src="${qr(link)}" alt="Client card QR"><div style="text-align:center">${esc(c.client_code)}</div>`:`<div class="card-brand">JUAN PROJECT</div><small>${esc(c.loyalty_tier||'BRONZE')} MEMBER · ${Number(c.completed_projects||0)} COMPLETED</small><div class="card-name">${esc(c.name)}</div><small>${esc(c.client_code)} · Member since ${esc(c.member_since?new Date(c.member_since).toLocaleDateString('en-PH',{year:'numeric',month:'short'}):'—')}</small>`}draw();by('clientCard').onclick=()=>{back=!back;draw()};bind('cardFull',()=>open('Client QR',`<img class="suite-qr" style="width:min(65vw,500px);height:auto" src="${qr(link)}" alt="Client QR"><p style="text-align:center">${esc(c.name)} · ${esc(c.client_code)} · ${esc(c.loyalty_tier||'BRONZE')}</p>`));bind('cardSave',async()=>{const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=620;const x=canvas.getContext('2d');x.fillStyle='#101713';x.fillRect(0,0,1100,620);x.fillStyle='#fff';x.font='700 42px "SF Pro Display"';x.fillText('JUAN PROJECT',55,90);x.font='400 22px "SF Pro Text"';x.fillText((c.loyalty_tier||'BRONZE')+' MEMBER',55,140);x.font='700 34px "SF Pro Display"';x.fillText(c.name.slice(0,28),55,420);x.font='600 26px "SF Pro Text"';x.fillText(c.client_code,55,475);x.font='400 18px "SF Pro Text"';x.fillText(String(c.completed_projects||0)+' completed projects',55,515);x.drawImage(await img(qr(link)),760,290,280,280);canvas.toBlob(b=>download(b,c.client_code+'-membership-card.png'))})}
async function projectTools(id){const d=await api({action:'dashboard'}),p=d.projects.find(x=>x.id===id)||d.projects[0];open('Projects · tracking & files',`<label>Project<select id="toolProject">${d.projects.map(x=>`<option value="${esc(x.id)}" ${x.id===p?.id?'selected':''}>${esc(x.project_code)} · ${esc(x.title)}</option>`).join('')}</select></label>${p?`<div class="suite-grid"><label>Current stage<select id="toolStage">${stages.map((s,i)=>`<option value="${i}" ${i===Number(p.tracker_stage||0)?'selected':''}>${s}</option>`).join('')}</select></label><label>Google Drive folder<input id="toolDrive" type="url" value="${esc(p.drive_url||'')}"></label></div><label class="check"><input id="toolOverride" type="checkbox" ${p.files_override?'checked':''}> Admin override: release files before final payment</label><h3>Deliverables</h3><div id="toolDeliverables">${(p.deliverables||[]).map((x,i)=>`<div class="suite-card"><label class="check"><input data-del="${i}" type="checkbox" ${x.completed?'checked':''}>${esc(x.item_name||x.name)}</label>${(x.children||[]).map((c,j)=>`<label class="check suite-child"><input data-parent="${i}" data-child="${j}" type="checkbox" ${c.completed?'checked':''}>${esc(c.item_name)}</label>`).join('')}</div>`).join('')||empty('Use the existing Project Details screen to add deliverables.')}</div><button id="toolSave" class="primary">Save project updates</button>`:empty('Create or approve an order first.')}`);if(!p)return;by('toolProject').onchange=e=>projectTools(e.target.value);bind('toolSave',async()=>{const ds=structuredClone(p.deliverables||[]);dialog.querySelectorAll('[data-del]').forEach(e=>{ds[+e.dataset.del].completed=e.checked;ds[+e.dataset.del].status=e.checked?'Completed':'Pending'});dialog.querySelectorAll('[data-child]').forEach(e=>ds[+e.dataset.parent].children[+e.dataset.child].completed=e.checked);ds.forEach(x=>{if(x.children?.length){x.completed=x.children.every(c=>c.completed);x.status=x.completed?'Completed':'Pending'}});await api({action:'save-project',id:p.id,updates:{tracker_stage:+by('toolStage').value,drive_url:by('toolDrive').value.trim(),files_override:by('toolOverride').checked,deliverables:ds}});await T.refresh();toast('Project updates synced to Online');projectTools(p.id)})}
async function clientPreview(id){
  const d=await api({action:'dashboard'}),c=d.clients.find(x=>String(x.id)===String(id));
  if(!c)return toast('Client not found.');
  const projects=d.projects.filter(p=>String(p.client_id)===String(id));
  const submissions=d.payment_submissions.filter(p=>String(p.client_id)===String(id));
  open('Preview as Client',`<div class="suite-card"><small>READ-ONLY PREVIEW</small><h3>${esc(c.name)}</h3><p>${esc(c.client_code||'')} · ${esc(c.email||'')}</p><span class="suite-badge">${esc(c.classification||'New')}</span></div><h3>Projects</h3>${projects.map(p=>`<div class="suite-card"><div class="suite-row"><div><b>${esc(p.project_code||'Project')}</b><div>${esc(p.title||'Untitled Project')}</div></div><span class="suite-badge">${esc(stages[Number(p.tracker_stage||0)]||p.status||'In Progress')}</span></div><p>Files: ${p.files_override||!p.drive_url?'Managed by Workspace': 'Available when payment rules allow'}</p></div>`).join('')||empty('No projects yet.')}<h3>Payment Submissions</h3>${submissions.slice(0,5).map(x=>`<div class="suite-row suite-card"><span>${esc(x.reference_number||'Payment')}</span><span class="suite-badge">${esc(x.status||'pending')}</span></div>`).join('')||empty('No payment submissions.')}`, 'JUAN PROJECT Online · Read-only');
}
async function portal(tab='clients'){const d=await api({action:'dashboard'});let html='';if(tab==='clients')html=d.clients.map(c=>`<div class="suite-card suite-row"><div><h3>${esc(c.name)}</h3><small>${esc(c.client_code)} · ${esc(c.email)}</small></div><div class="suite-tabs"><select data-classify="${esc(c.id)}">${['New','Returning','Loyal','VIP'].map(x=>`<option ${c.classification===x?'selected':''}>${x}</option>`).join('')}</select><button data-preview="${esc(c.id)}">Preview as Client</button><button data-invite="${esc(c.id)}">Create invitation</button></div></div>`).join('')||empty('Clients appear after an order is created or converted.');if(tab==='payments')html=d.payment_submissions.slice().reverse().map(s=>{const p=d.projects.find(p=>p.id===s.project_id),c=d.clients.find(c=>c.id===s.client_id);return `<div class="suite-card"><div class="suite-row"><h3>${esc(p?.project_code)} · ${peso(s.submitted_amount)}</h3><span class="suite-badge">${esc(s.status)}</span></div><p>${esc(c?.name)} · ${esc(s.sender_institution)} · ${esc(s.reference_number)}</p><p class="suite-muted">Fee ${peso(s.transfer_fee||s.extracted_transfer_fee)} — credited separately · ${esc(s.payment_date)}</p><div class="suite-tabs">${s.receipt_url?`<a href="${esc(s.receipt_url)}" target="_blank" rel="noopener">Open proof</a>`:'<span class="suite-muted">Proof unavailable</span>'}${s.status==='pending'?`<button data-pay="${esc(s.id)}" data-decision="approved" class="primary">Approve payment</button><button data-pay="${esc(s.id)}" data-decision="rejected">Reject</button>`:''}</div></div>`}).join('')||empty('Online payment proofs appear here.');if(tab==='invitations')html=d.invitations.map(i=>`<div class="suite-card"><h3>${esc(d.clients.find(c=>c.id===i.client_id)?.name)}</h3><p>${esc(i.status)} · expires ${esc(i.expires_at?new Date(i.expires_at).toLocaleString():'—')}</p><button data-copyinvite="${esc(i.id)}">Copy invitation link</button> <button data-revoke="${esc(i.id)}">Revoke</button></div>`).join('')||empty('Create an invitation from Client Access. Invitation links can be shared directly with the client.');if(tab==='activity')html=d.portal_activity.slice().reverse().map(x=>`<div class="suite-card suite-row"><b>${esc(x.title)}</b><small>${esc(x.entity)} · ${esc(new Date(x.at).toLocaleString())}</small></div>`).join('')||empty('No portal activity yet.');if(tab==='ads')html=`<button id="newAd" class="primary">+ Create promotion</button>${d.promotions.map(a=>`<div class="suite-card suite-row"><div><h3>${esc(a.title)}</h3><span class="suite-badge">${a.enabled?'Enabled':'Hidden'}</span></div><div><button data-editad="${esc(a.id)}">Edit</button> <button data-deletead="${esc(a.id)}">Delete</button></div></div>`).join('')}`;if(tab==='config'){const c=d.suite_config[0]||{};html=`<form id="configForm"><p>UnionBank via InstaPay is the receiving account. Sender fees are separate from credited amounts.</p><label>Published Online URL<input name="online_url" type="url" value="${esc(c.online_url||'')}"></label><label>Sender reference rules (JSON object of sender code → regex)<textarea name="rules">${esc(JSON.stringify(c.rules||{maribank:'^\\d{6,12}$'},null,2))}</textarea></label><p class="suite-muted">MariBank stays fixed at 6–12 digits. GCash and Maya default to ₱10 transfer fees.</p><button class="primary">Save portal configuration</button></form><hr><button id="exportShared">Export all test data</button><p class="suite-muted">Exports are portable backups of the current production portal data.</p>`}open('Online Portal',`<nav class="suite-tabs">${[['clients','Client Access'],['payments','Payment Reviews'],['invitations','Invitations'],['activity','Portal Activity'],['ads','In-House Ads'],['config','Portal Configuration']].map(([v,l])=>`<button data-tab="${v}" class="${v===tab?'active':''}">${l}</button>`).join('')}</nav>${html}`);dialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>portal(b.dataset.tab));dialog.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>clientPreview(b.dataset.preview));dialog.querySelectorAll('[data-classify]').forEach(b=>b.onchange=async()=>{try{await api({action:'classify',id:b.dataset.classify,value:b.value});toast('Client classification saved')}catch(e){error(e)}});dialog.querySelectorAll('[data-invite]').forEach(b=>b.onclick=async()=>{try{await api({action:'invite',id:b.dataset.invite});portal('invitations')}catch(e){error(e)}});dialog.querySelectorAll('[data-copyinvite]').forEach(b=>b.onclick=async()=>{const i=d.invitations.find(i=>i.id===b.dataset.copyinvite);await navigator.clipboard.writeText(url('online','?invite='+i.token));toast('Test invitation copied')});dialog.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{await api({action:'revoke-invite',id:b.dataset.revoke});portal('invitations')});dialog.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{if(b.dataset.decision==='approved')return paymentDecision(b.dataset.pay,'approved');open('Reject payment',`<label>Reason for the client<textarea id="rejectReason" required></textarea></label><button id="rejectConfirm">Reject submission</button>`);bind('rejectConfirm',()=>paymentDecision(b.dataset.pay,'rejected',by('rejectReason').value))});async function paymentDecision(id,decision,reason=''){try{await api({action:'review-payment',id,decision,reason});toast('Payment '+decision);await T.refresh();portal('payments')}catch(e){error(e)}}bind('newAd',()=>editAd());dialog.querySelectorAll('[data-editad]').forEach(b=>b.onclick=()=>editAd(d.promotions.find(x=>x.id===b.dataset.editad)));dialog.querySelectorAll('[data-deletead]').forEach(b=>b.onclick=async()=>{await api({action:'delete-ad',id:b.dataset.deletead});portal('ads')});bind('exportShared',async()=>{const data=await api({action:'export'});download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'JUAN_PROJECT_SHARED_TEST_BACKUP.json')});if(by('configForm'))by('configForm').onsubmit=async e=>{e.preventDefault();try{const form=Object.fromEntries(new FormData(e.target));await api({action:'configure',config:{online_url:form.online_url,rules:JSON.parse(form.rules)}});toast('Portal configuration saved')}catch(e){error(e)}}}
function editAd(a={}){open(a.id?'Edit promotion':'Create promotion',`<form id="adForm"><div class="suite-grid"><label>Title<input name="title" required value="${esc(a.title||'')}"></label><label>Button label<input name="cta" value="${esc(a.cta||'Browse services')}"></label><label>Destination URL<input name="url" type="url" value="${esc(a.url||'')}"></label><label>Image URL<input name="image" type="url" value="${esc(a.image||'')}"></label><label>Audience<select name="audience">${['all','guest','client'].map(v=>`<option ${a.audience===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Start date<input type="date" name="start" value="${esc(a.start||'')}"></label><label>End date<input type="date" name="end" value="${esc(a.end||'')}"></label></div><label>Message<textarea name="body">${esc(a.body||'')}</textarea></label><label class="check"><input name="enabled" type="checkbox" ${a.enabled!==false?'checked':''}> Enabled</label><button class="primary">Save promotion</button></form>`);by('adForm').onsubmit=async e=>{e.preventDefault();try{const v=Object.fromEntries(new FormData(e.target));await api({action:'save-ad',ad:{...v,id:a.id,enabled:v.enabled==='on'}});portal('ads')}catch(e){error(e)}}}
async function onlineExtras(){if(admin)return;const page=document.querySelector('main.page');if(!page||page.querySelector('.suite-inline'))return;const logged=!!T.session();const el=document.createElement('div');el.className='suite-inline suite-online-quick-actions';el.innerHTML=`<div class="suite-tabs"><button id="suiteShopOpen">${logged?'Start New Order':'Shop Now'}</button><button id="suiteTrackOpen">Track Order Request</button>${logged?'<button id="suiteCardOpen">My Client Card</button>':''}</div><div id="suiteAds"></div>`;const quickAnchor=page.querySelector('.topbar,.page-header,.home-hero,.hero');if(quickAnchor)quickAnchor.insertAdjacentElement('afterend',el);else page.prepend(el);bind('suiteShopOpen',shop);bind('suiteTrackOpen',()=>track());bind('suiteCardOpen',card);try{const {ads}=await api({action:'ads'});const adRoot=el.querySelector('#suiteAds');adRoot.innerHTML=ads.map(a=>`<div class="suite-ad">${a.image?`<img src="${esc(a.image)}" alt="">`:''}<h3>${esc(a.title)}</h3><p>${esc(a.body)}</p>${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.cta||'Learn more')}</a>`:''}</div>`).join('')}catch{}}
function clientOnboard(){const key='JUAN_CLIENT_TOUR_'+T.session()?.user.id;if(!T.session()||sessionStorage.getItem(key)||T.preview)return;let step=0;const pages=[['Your projects, together','See your orders, deliverables and progress in one place.'],['Payments made clear','Submit a proof of payment and follow its review status.'],['Ready when you are','Your project files unlock after final payment or an admin release.']];function show(){open('Welcome to your client portal',`<div class="suite-onboard"><small>${step+1} / 3</small><h3>${pages[step][0]}</h3><p>${pages[step][1]}</p><div class="suite-tabs"><button id="tourSkip">Skip</button><button id="tourNext" class="primary">${step===2?'Open my portal':'Next'}</button></div></div>`);bind('tourSkip',()=>{sessionStorage.setItem(key,'1');close()});bind('tourNext',()=>{if(step===2){sessionStorage.setItem(key,'1');close()}else{step++;show()}})}show()}
async function boot(){
  const invite=new URLSearchParams(location.search).get('invite');
  if(invite&&!admin){
    try{
      const accepted=await api({action:'accept-invite',token:invite});
      open('Client invitation verified',`<div class="suite-card"><h3>${esc(accepted.name||'Client')}</h3><p>${esc(accepted.email||'')}</p><p>Your JUAN PROJECT access is ready. Use the normal Log In button with your client account.</p></div><button id="inviteDone" class="primary">Continue to Online</button>`);
      bind('inviteDone',()=>{history.replaceState({},'',location.pathname);close()});
    }catch(e){error(e)}
  }
  if(admin){
    // Workspace navigation is now native in index.html.
    // Do not inject the old "Order Intake" section or duplicate Overview/New Order buttons.
    ['workspaceOrdersNav'].forEach(id=>bind(id,incoming));
    document.body.classList.add('suite-workspace');
  }else{
    window.addEventListener('juan-online-render',onlineExtras);
    await onlineExtras();
    clientOnboard();
    if(location.hash.startsWith('#track='))await track(location.hash.slice(7));
  }
}
window.addEventListener('juan-client-profile',e=>{let button=by('suiteProfilePreview');if(!button){button=document.createElement('button');button.id='suiteProfilePreview';button.className='btn btn-secondary';button.textContent='Preview as Client';by('view-client-profile')?.querySelector('header')?.append(button)}button.onclick=()=>clientPreview(e.detail.id)});

window.JuanSuite={shop,track,card,incoming,orderRequests:incoming,scanner,portal,addShopItem:addShopItemToOrder,openCart:openOrderCart};window.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'&&dialog){const nodes=[...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});boot().catch(error);
})();
