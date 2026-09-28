/* JUAN PROJECT Online — mobile service-commerce flow */
(function(){
  "use strict";
  var CART_KEY="JUAN_ORDER_REQUEST_CART_V1",TERMS_VERSION="2026-09-22",catalog=null,layer=null,checkout={name:"",email:"",title:"",deadline:"",notes:"",referral:""},lastReceipt=null;
  var T=function(){return window.JuanSuiteRuntime;};
  var esc=function(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
  var peso=function(v){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(v||0));};
  var toast=function(msg){var e=document.createElement("div");e.className="jp-mobile-toast";e.innerHTML='<span>✓</span><b>'+esc(msg)+"</b>";document.body.appendChild(e);setTimeout(function(){e.classList.add("show");},10);setTimeout(function(){e.classList.remove("show");setTimeout(function(){e.remove();},220);},2600);};
  function cart(){try{var x=JSON.parse(localStorage.getItem(CART_KEY)||"[]");return Array.isArray(x)?x:[];}catch(_){return [];}}
  function saveCart(items){localStorage.setItem(CART_KEY,JSON.stringify(items));window.dispatchEvent(new CustomEvent("juan-cart-change",{detail:{count:count(items)}}));}
  function count(items){return (items||cart()).reduce(function(s,x){return s+Number(x.qty||1);},0);}
  function total(items){return (items||cart()).reduce(function(s,x){return s+Number(x.price||0)*Number(x.qty||1);},0);}
  function cartCount(){return count(cart());}
  function cartTotal(){return total(cart());}
  async function getCatalog(){if(catalog)return catalog;catalog=await fetch("/api/catalog",{cache:"no-store"}).then(async function(r){var j=await r.json();if(!r.ok)throw new Error(j.error||"Catalog unavailable");return j;});return catalog;}
  async function addCatalogItem(kind,id){
    var c=await getCatalog(),isPackage=String(kind).toLowerCase()==="package",src=isPackage?(c.packages||[]):(c.services||[]),item=src.find(function(x){return String(x.id)===String(id);});
    if(!item)throw new Error("This item is no longer available.");
    var items=cart(),existing=items.find(function(x){return String(x.id)===String(id)&&x.type===(isPackage?"package":"service");}),price=Number(isPackage?(item.new_price??item.original_price??0):(item.price||0));
    if(existing)existing.qty=Math.min(100,Number(existing.qty||1)+1);else items.push({id:item.id,type:isPackage?"package":"service",name:item.name,price:price,qty:1,product_code:item.product_code||""});
    saveCart(items);toast("Added to your cart");return items;
  }
  function close(){if(layer)layer.remove();layer=null;document.body.classList.remove("jp-flow-open");}
  function shell(content,back,mode){
    close();
    var flowMode=String(mode||"default"),withFeature=["checkout","terms","processing","receipt","track"].includes(flowMode);
    var feature=withFeature?'<aside class="jp-flow-feature-panel"><div class="jp-flow-feature-copy"><span>JUAN PROJECT ONLINE</span><strong>'+(flowMode==="track"?"Track with confidence.":flowMode==="receipt"?"Your request is ready.":"A simpler way to start your project.")+'</strong><p>'+(flowMode==="track"?"Follow your Order Request and project progress in one place.":"Featured JUAN PROJECT services and promotions appear here.")+'</p></div><div id="jpAdBannerAnchor" class="jp-flow-feature-ad"></div></aside>':"";
    layer=document.createElement("div");layer.className="jp-flow-layer jp-flow-"+flowMode;
    layer.innerHTML='<div class="jp-flow-phone"><header class="jp-flow-header">'+(back?'<button id="jpFlowBack" aria-label="Back">←</button>':'<span></span>')+'<div class="jp-flow-brand"><b>JUAN PROJECT</b><small>Online</small></div><button id="jpFlowClose" aria-label="Close">×</button></header><div class="jp-flow-body">'+feature+'<main class="jp-flow-main">'+content+"</main></div></div>";
    document.body.appendChild(layer);document.body.classList.add("jp-flow-open");document.getElementById("jpFlowClose").onclick=close;
    window.dispatchEvent(new Event("juan-online-render"));
    return layer;
  }
  function thumb(){return "";}
  function openCart(){
    var items=cart();
    var html='<div class="jp-flow-title"><h1>Your Cart</h1><button id="jpClearCart" class="jp-icon-clear" aria-label="Clear cart">⌫</button></div>';
    if(!items.length)html+='<div class="jp-flow-empty"><div>🛒</div><h2>Your cart is empty.</h2><p>Browse JUAN PROJECT services and add something when you are ready.</p><button id="jpBrowse" class="jp-mobile-primary">Browse Services</button></div>';
    else html+='<div class="jp-cart-list">'+items.map(function(i,n){return '<article class="jp-cart-item" data-cart-index="'+n+'"><div class="jp-cart-copy"><h3>'+esc(i.name)+'</h3><b>'+peso(i.price)+'</b></div><div class="jp-qty"><button data-minus="'+n+'">−</button><span>'+Number(i.qty||1)+'</span><button data-plus="'+n+'">+</button></div><button class="jp-cart-remove" data-remove="'+n+'" aria-label="Remove">⌫</button></article>';}).join("")+'</div><div class="jp-cart-sticky"><button class="jp-promo-row" disabled><span>Have a promo code?</span><b>Available Soon</b></button><div class="jp-cart-summary"><div><span>Subtotal</span><b>'+peso(total(items))+'</b></div><div class="total"><span>Estimated Total</span><strong>'+peso(total(items))+'</strong></div></div><button id="jpCheckout" class="jp-mobile-primary">Continue to Checkout →</button></div>';
    var v=shell(html,true,"cart");document.getElementById("jpFlowBack").onclick=close;
    function updateCartInPlace(){
      var x=cart(),sum=total(x);
      if(!x.length){return openCart();}
      v.querySelectorAll(".jp-cart-item").forEach(function(card){var i=Number(card.dataset.cartIndex),item=x[i];if(!item)return;var q=card.querySelector(".jp-qty span");if(q)q.textContent=Number(item.qty||1);});
      var subtotal=v.querySelector(".jp-cart-summary>div:first-child b"),estimated=v.querySelector(".jp-cart-summary .total strong");if(subtotal)subtotal.textContent=peso(sum);if(estimated)estimated.textContent=peso(sum);
    }
    v.querySelectorAll("[data-minus]").forEach(function(b){b.onclick=function(){var x=cart(),i=Number(b.dataset.minus);x[i].qty=Math.max(1,Number(x[i].qty||1)-1);saveCart(x);updateCartInPlace();};});
    v.querySelectorAll("[data-plus]").forEach(function(b){b.onclick=function(){var x=cart(),i=Number(b.dataset.plus);x[i].qty=Math.min(100,Number(x[i].qty||1)+1);saveCart(x);updateCartInPlace();};});
    v.querySelectorAll("[data-remove]").forEach(function(b){b.onclick=function(){var list=v.querySelector(".jp-cart-list"),top=list?list.scrollTop:0,x=cart(),i=Number(b.dataset.remove);x.splice(i,1);saveCart(x);if(!x.length)return openCart();var card=b.closest(".jp-cart-item");if(card)card.remove();v.querySelectorAll(".jp-cart-item").forEach(function(el,n){el.dataset.cartIndex=n;el.querySelector("[data-minus]")?.setAttribute("data-minus",n);el.querySelector("[data-plus]")?.setAttribute("data-plus",n);el.querySelector("[data-remove]")?.setAttribute("data-remove",n);});updateCartInPlace();if(list)list.scrollTop=top;};});
    var clear=document.getElementById("jpClearCart");if(clear)clear.onclick=function(){if(confirm("Clear your cart?")){saveCart([]);openCart();}};
    var browse=document.getElementById("jpBrowse");if(browse)browse.onclick=close;
    var next=document.getElementById("jpCheckout");if(next)next.onclick=checkoutOne;
  }
  function profilePrefill(){
    var p=window.JPOAppState?.portal?.profile||{};
    var profileName=String(p.name||"").trim();
    var savedName=String(checkout.name||"").trim();
    // Never mirror an email address into Full Name. Some legacy client rows used
    // the email as a temporary display name, so treat that value as empty here.
    if(profileName.includes("@"))profileName="";
    if(savedName.includes("@"))savedName="";
    return {name:profileName||savedName,email:String(p.email||checkout.email||"").trim()};
  }
  function checkoutOne(){
    var pre=profilePrefill(),html='<div class="jp-step-head"><span>Checkout</span><b>1 / 2</b></div><div class="jp-step-bar"><i style="width:50%"></i></div><div class="jp-step-icon">♙</div><div class="jp-step-copy"><h1>Your Information</h1><p>We only need a few details to process your Order Request.</p></div><div class="jp-mobile-field"><label>Full Name *</label><input id="jpGuestName" value="'+esc(pre.name)+'" autocomplete="name"></div><div class="jp-mobile-field"><label>Email Address *</label><input id="jpGuestEmail" type="email" value="'+esc(pre.email)+'" autocomplete="email"></div><div id="jpContactError" class="jp-mobile-error"></div><button id="jpContactNext" class="jp-mobile-primary">Continue →</button><p class="jp-safe-note">🔒 Your information is safe with us.</p>';
    shell(html,true,"checkout");document.getElementById("jpFlowBack").onclick=openCart;document.getElementById("jpContactNext").onclick=function(){var n=document.getElementById("jpGuestName").value.trim(),e=document.getElementById("jpGuestEmail").value.trim().toLowerCase();if(!n||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){document.getElementById("jpContactError").textContent="Enter your full name and a valid email address.";return;}checkout.name=n;checkout.email=e;checkoutTwo();};
  }
  function checkoutTwo(){
    var today=new Date(),min=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
    var html='<div class="jp-step-head"><span>Checkout</span><b>2 / 2</b></div><div class="jp-step-bar"><i style="width:100%"></i></div><div class="jp-step-copy left"><h1>Additional Details</h1><p>These details help JUAN PROJECT understand your request. Optional.</p></div><div class="jp-mobile-field"><label>Project / Output Name</label><input id="jpProjectTitle" value="'+esc(checkout.title)+'" placeholder="e.g. KAMPUS KONEK / CAMPUS PATROL"></div><div class="jp-mobile-field"><label>Requested Date</label><input id="jpRequestedDate" type="date" min="'+min+'" value="'+esc(checkout.deadline)+'"><small>Your requested date is a preference. Standard timeline and rush rules still apply.</small></div><div class="jp-mobile-field"><label>Notes</label><textarea id="jpProjectNotes" maxlength="500" placeholder="Any additional details about your project?">'+esc(checkout.notes)+'</textarea><small>Optional · 500 characters max</small></div><div class="jp-mobile-field"><label>Referral Code</label><input id="jpReferralCode" value="'+esc(checkout.referral)+'" placeholder="Optional · e.g. JUAN-CL-035" autocomplete="off"><small>If someone referred you to JUAN PROJECT, enter their code here.</small></div><button id="jpReviewOrder" class="jp-mobile-primary">Review Order →</button>';
    shell(html,true,"checkout");
    document.getElementById("jpFlowBack").onclick=checkoutOne;
    var referral=document.getElementById("jpReferralCode");
    if(referral){
      referral.setAttribute("inputmode","text");
      referral.setAttribute("autocapitalize","characters");
      referral.addEventListener("input",function(){
        var raw=referral.value.toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,18);
        referral.value=raw;
      });
    }
    document.getElementById("jpReviewOrder").onclick=function(){checkout.title=document.getElementById("jpProjectTitle").value.trim();checkout.deadline=document.getElementById("jpRequestedDate").value;checkout.notes=document.getElementById("jpProjectNotes").value.trim();checkout.referral=document.getElementById("jpReferralCode").value.trim().toUpperCase();reviewOrder();};
  }
  function reviewOrder(){
    var items=cart(),html='<div class="jp-flow-title"><h1>Review Order</h1></div><section class="jp-review-card"><div class="jp-review-label">Guest Information <button id="jpEditGuest">Edit</button></div><b>'+esc(checkout.name)+'</b><span>'+esc(checkout.email)+'</span>'+(checkout.referral?'<small>Referral: '+esc(checkout.referral)+'</small>':'')+'</section><section class="jp-review-card"><div class="jp-review-label">Order Summary <span>'+count(items)+' item(s)</span></div>'+items.map(function(i){return '<div class="jp-review-item">'+thumb(i)+'<div><b>'+esc(i.name)+'</b><small>Qty: '+Number(i.qty||1)+'</small></div><strong>'+peso(Number(i.price||0)*Number(i.qty||1))+'</strong></div>';}).join("")+'<div class="jp-review-total"><span>Subtotal</span><b>'+peso(total(items))+'</b></div><div class="jp-review-total final"><span>Estimated Total</span><strong>'+peso(total(items))+'</strong></div></section><div class="jp-terms-note">ⓘ By continuing, you will need to read and agree to the <b>Terms of Service</b> before submitting your Order Request.</div><button id="jpTermsNext" class="jp-mobile-primary">Continue →</button>';
    shell(html,true,"checkout");document.getElementById("jpFlowBack").onclick=checkoutTwo;document.getElementById("jpEditGuest").onclick=checkoutOne;document.getElementById("jpTermsNext").onclick=termsScreen;
  }
  function termsScreen(){
    var terms='<h2>JUAN PROJECT ONLINE - TERMS OF SERVICE</h2><p><b>Last Updated: September 28, 2026</b></p><p>Welcome to JUAN PROJECT ONLINE. By submitting this Order Request you acknowledge these terms. The service agreement becomes effective when the required downpayment is submitted and verified.</p>'+
      '<h3>1. AGREEMENT TO TERMS</h3><p>By proceeding with the initial payment, you ("the Client") enter into a binding agreement with Benzel Delmo, operating under JUAN PROJECT WORKSPACE ("the Service Provider"). This agreement governs your use of the online workspace and the fulfillment of requested services.</p>'+
      '<h3>2. PROJECT INITIATION & DOWNPAYMENT</h3><ul><li><b>Initial Deposit:</b> A non-refundable downpayment of 50% (unless otherwise specified in your invoice) is required to initialize your workspace and secure your place in the service queue.</li><li><b>Work Commencement:</b> No design, development, or production work will begin until the downpayment is successfully processed and verified in the system.</li><li><b>Final Balance:</b> Any remaining balance becomes due upon project completion or delivery and should be settled immediately.</li></ul>'+
      '<h3>3. BALANCE DUE, GRACE PERIOD & OVERDUE FEES</h3><ul><li><b>Due Date:</b> The Project End / Completion Date is also the Payment Due Date. Any remaining balance is due on that date and should be settled immediately.</li><li><b>1-Day Grace Period:</b> The first day after the due date is a grace period. No overdue charge is added on Day 1.</li><li><b>Daily Overdue Charge:</b> Beginning on Day 2 after the due date, every unpaid overdue day is counted at ₱35 per day until the outstanding balance is fully settled.</li><li><b>Initial Overdue Fee:</b> If the balance remains unpaid on Day 3 after the due date, an additional ₱500 is applied on top of accumulated daily charges.</li><li><b>7-Day Overdue Fee:</b> On Day 7 after the due date, an additional ₱250 is applied. Another ₱250 is added for every succeeding 7-day period while a balance remains unpaid.</li><li><b>Partial Payments:</b> A partial payment reduces the outstanding balance but does not stop overdue charges while a balance remains unpaid. Charges stop once the outstanding balance is fully settled.</li><li><b>Fee Waiver:</b> JUAN PROJECT may waive overdue charges for a specific project when approved by the Service Provider.</li><li><b>Release of Final Assets:</b> Final source files or restricted deliverables may be withheld until all outstanding balances and applicable overdue charges are fully settled.</li></ul>'+
      '<h3>4. DELIVERABLES & REVISION POLICY</h3><ul><li><b>Scope:</b> The Service Provider is only obligated to complete the specific Deliverables outlined and approved in your active workspace dashboard.</li><li><b>Revisions:</b> Each Deliverable includes the allotted minor revision rounds specified in the package. Major structural changes after concept approval may be billed separately.</li><li><b>Approval Window:</b> Clients are expected to review Deliverables within 3 business days. Prolonged delays may result in auto-approval to keep the timeline on track.</li></ul>'+
      '<h3>5. LOYALTY PROGRAM & REWARDS</h3><p>Clients may earn points through the workspace loyalty system. Loyalty points and referral codes have no direct cash value and may only be used for JUAN PROJECT ONLINE discounts or perks. Points cannot be applied retroactively to paid invoices.</p>'+
      '<h3>6. INTELLECTUAL PROPERTY & USAGE RIGHTS</h3><ul><li><b>Ownership Transfer:</b> Full usage rights for final approved Deliverables transfer only after final payment.</li><li><b>Working Files:</b> Raw source files, backend code, and 3D project files remain the Service Provider\'s property unless a Source File Transfer add-on was purchased.</li><li><b>Portfolio Rights:</b> JUAN PROJECT WORKSPACE may display completed Deliverables and early concepts in portfolios, case studies, and social media promotions.</li></ul>'+
      '<h3>7. CANCELLATION & TERMINATION</h3><p>If the Client cancels after work has commenced, the initial downpayment is forfeited to cover administrative and labor costs. If cancelled midway, completed and approved Deliverables may be invoiced up to the cancellation date.</p>';
    var html='<div class="jp-flow-title"><h1>Terms & Conditions</h1></div><div class="jp-terms-scroll">'+terms+'</div><label class="jp-terms-check"><input id="jpTermsAgree" type="checkbox"><span>I have read, understood, and agree to the Terms of Service.</span></label><button id="jpSubmitOrder" class="jp-mobile-primary" disabled>Agree & Submit Order Request</button>';
    shell(html,true,"terms");document.getElementById("jpFlowBack").onclick=reviewOrder;var chk=document.getElementById("jpTermsAgree"),btn=document.getElementById("jpSubmitOrder");chk.onchange=function(){btn.disabled=!chk.checked;};btn.onclick=submitOrder;
  }

  async function submitOrder(){
    var items=cart(),key=crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random();
    processing();
    try{
      var request={action:"submit-order",key:key,items:items,name:checkout.name,email:checkout.email,title:checkout.title,deadline:checkout.deadline||null,notes:checkout.notes,referralCode:checkout.referral,termsAccepted:true,termsVersion:TERMS_VERSION,website:""};
      var r=await T().request("/api/suite",request);
      await delay(1150);saveCart([]);localStorage.setItem("JUAN_LAST_GUEST_TOKEN",r.token);lastReceipt={order:r.order,token:r.token};success(r.order,r.token);
    }catch(e){await delay(400);failure(e.message||"We could not submit your request.");}
  }
  function delay(ms){return new Promise(function(r){setTimeout(r,ms);});}
  function processing(){
    var html='<div class="jp-processing-screen"><div class="jp-processing-logo">➤</div><h1>Submitting<br>your request...</h1><p>Please wait a moment while we process your order.</p><div class="jp-process-list"><div class="done">✓ <span>Validating your information</span></div><div class="done">✓ <span>Creating your Order Request</span></div><div class="active"><i></i><span>Generating receipt</span></div><div><i></i><span>Finalizing</span></div></div></div>';
    shell(html,false,"processing");
  }
  function trackingLink(token){return location.origin+location.pathname+"#track="+encodeURIComponent(token);}
  function success(o,token){
    var link=trackingLink(token),requested=o.deadline?'<div class="jp-receipt-row"><span>REQUESTED DATE</span><b>'+esc(o.deadline)+'</b></div>':'';
    var icon=function(path){return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';};
    var saveIcon=icon('<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M5 20h14"/>');
    var shareIcon=icon('<path d="M12 16V4"/><path d="m8 8 4-4 4 4"/><path d="M5 14v6h14v-6"/>');
    var copyIcon=icon('<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>');
    var trackIcon=icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>');
    var html='<div class="jp-receipt-result">'+
      '<div class="jp-receipt-confirm">✓ ORDER REQUEST CONFIRMED</div>'+
      '<article class="jp-receipt-card jp-thermal-receipt">'+
        '<header class="jp-thermal-head"><b>JUAN PROJECT</b><span>ORDER REQUEST</span></header>'+
        '<div class="jp-thermal-dash"></div>'+
        '<b class="jp-thermal-order-id">'+esc(o.code||"")+'</b>'+
        '<div class="jp-thermal-date">'+esc(new Date(o.created_at).toLocaleString("en-PH"))+'</div>'+
        '<img class="jp-thermal-qr" src="/api/qr?text='+encodeURIComponent(link)+'" alt="QR code to track '+esc(o.code)+'">'+
        '<div class="jp-thermal-dash"></div>'+
        '<div class="jp-receipt-items">'+(o.items||[]).map(function(i){return '<div><span>'+esc(i.name)+' × '+Number(i.qty||1)+'</span><b>'+peso(Number(i.price||0)*Number(i.qty||1))+'</b></div>';}).join("")+'</div>'+
        '<div class="jp-thermal-dash"></div>'+
        '<div class="jp-receipt-row"><span>SUBTOTAL</span><b>'+peso(o.subtotal)+'</b></div>'+
        requested+
        '<div class="jp-receipt-row total"><span>ESTIMATED TOTAL</span><strong>'+peso(o.total)+'</strong></div>'+
        '<div class="jp-thermal-dash"></div>'+
        '<div class="jp-thermal-status">*** ORDER SENT ***</div>'+
        '<div class="jp-thermal-dash"></div>'+
        '<small class="jp-not-invoice">THIS IS NOT AN INVOICE OR PROOF OF PAYMENT.</small>'+
      '</article>'+
      '<div class="jp-receipt-actions jp-receipt-icon-actions">'+
        '<button id="jpSaveReceipt" type="button" aria-label="Save receipt image" title="Save">'+saveIcon+'</button>'+
        '<button id="jpShareReceipt" type="button" aria-label="Share receipt image" title="Share">'+shareIcon+'</button>'+
        '<button id="jpCopyTrack" type="button" aria-label="Copy tracking link" title="Copy link">'+copyIcon+'</button>'+
        '<button id="jpTrackReceipt" type="button" aria-label="Track request" title="Track">'+trackIcon+'</button>'+
      '</div>'+
      '<button id="jpDone" class="jp-mobile-primary jp-track-order-primary">Track Order</button>'+
    '</div>';
    shell(html,false,"receipt");
    document.getElementById("jpDone").onclick=function(){trackToken(token);};
    document.getElementById("jpCopyTrack").onclick=async function(){await navigator.clipboard.writeText(link);toast("Tracking link copied");};
    document.getElementById("jpTrackReceipt").onclick=function(){trackToken(token);};
    document.getElementById("jpSaveReceipt").onclick=function(){saveReceipt(o,link);};
    document.getElementById("jpShareReceipt").onclick=function(){shareReceipt(o,link);};
  }
  function failure(message){var html='<div class="jp-failure">!<h1>Request not submitted</h1><p>'+esc(message)+'</p><button id="jpRetrySubmit" class="jp-mobile-primary">Try Again</button><button id="jpBackReview" class="jp-mobile-secondary">Back to Review</button></div>';shell(html,false,"checkout");document.getElementById("jpRetrySubmit").onclick=submitOrder;document.getElementById("jpBackReview").onclick=reviewOrder;}
  async function makeReceiptBlob(o,link){
    var canvas=document.createElement("canvas");canvas.width=720;canvas.height=900+(o.items||[]).length*55;var x=canvas.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,canvas.width,canvas.height);x.fillStyle="#111";x.textAlign="center";x.font="bold 32px monospace";x.fillText("JUAN PROJECT",360,60);x.font="bold 20px monospace";x.fillText("ORDER REQUEST",360,94);x.font="bold 24px monospace";x.fillText(String(o.code||""),360,135);var y=190;x.textAlign="left";x.font="18px monospace";x.fillText(String(o.name||"").slice(0,45),45,y);y+=38;
    (o.items||[]).forEach(function(i){x.fillText(String(i.name||"Item").slice(0,38)+" x"+Number(i.qty||1),45,y);x.textAlign="right";x.fillText(peso(Number(i.price||0)*Number(i.qty||1)),675,y);x.textAlign="left";y+=48;});x.fillText("TOTAL",45,y+20);x.textAlign="right";x.font="bold 22px monospace";x.fillText(peso(o.total),675,y+20);y+=70;
    var image=new Image();image.src="/api/qr?text="+encodeURIComponent(link);await image.decode();x.drawImage(image,240,y,240,240);x.textAlign="center";x.font="15px monospace";x.fillText("NOT AN INVOICE OR PROOF OF PAYMENT",360,y+280);
    return await new Promise(function(resolve,reject){canvas.toBlob(function(b){b?resolve(b):reject(new Error("Could not create receipt image."));},"image/png",1);});
  }
  function download(blob,name){var a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(u);},1200);}
  async function saveReceipt(o,link){try{download(await makeReceiptBlob(o,link),(o.code||"JUAN-ORDER")+"-receipt.png");toast("Receipt image saved successfully");}catch(e){toast(e.message);}}
  async function shareReceipt(o,link){try{var blob=await makeReceiptBlob(o,link),file=new File([blob],(o.code||"JUAN-ORDER")+"-receipt.png",{type:"image/png"});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"JUAN PROJECT "+o.code});toast("Receipt shared");}else{download(blob,file.name);toast("Receipt saved for sharing");}}catch(e){if(e.name!=="AbortError")toast(e.message);}}
  function stageFor(status){
    var order=["Order Received","Under Review","Revised Offer Sent","Client Accepted","Project Created","In Progress","Delivered"],s=String(status||"Order Received");var idx=order.indexOf(s);if(idx<0){if(s==="Approved")idx=3;else if(s==="Needs Changes")idx=1;else idx=0;}return {order:order,index:idx};
  }
  function timeline(order,token){
    var st=stageFor(order.status),titles={ "Order Received":"Your request has been received.","Under Review":"We’re reviewing your request and preparing an offer.","Revised Offer Sent":"A revised offer is ready for your review.","Client Accepted":"You accepted the revised offer.","Project Created":"Your JUAN PROJECT has been created.","In Progress":"Production is underway.","Delivered":"Your project has been delivered."};
    return '<div class="jp-track-layout"><div class="jp-track-overview"><div class="jp-track-summary"><div><h2>'+esc(order.code||"Order Request")+'</h2><p>'+esc(order.title||"Order Request")+'</p></div><span>'+esc(order.status||"Order Received")+'</span><div class="meta"><b>'+peso(order.total||0)+'</b><small>'+((order.items||[]).length)+' item(s)</small></div></div><div class="jp-next-step"><b>Next Step</b><p>'+esc(titles[st.order[Math.min(st.index,st.order.length-1)]]||"We’ll keep you updated.")+'</p></div>'+(order.status==="Revised Offer Sent"&&token?'<button id="jpAcceptOffer" class="jp-mobile-primary">Accept Revised Offer</button>':"")+'<button id="jpRefreshTrack" class="jp-mobile-secondary">Refresh Status</button></div><div class="jp-track-timeline">'+st.order.map(function(s,i){var cls=i<st.index?"done":i===st.index?"current":"future";return '<div class="jp-track-node '+cls+'"><i>'+(i<st.index?"✓":i===st.index?"●":"○")+'</i><div><b>'+s+'</b><small>'+(i<=st.index?titles[s]:"Waiting")+'</small></div></div>';}).join("")+'</div></div>';
  }
  function openTrack(){
    var html='<div class="jp-flow-title"><h1>Track Request</h1></div><section class="jp-track-search-card"><div class="jp-step-copy left"><h2>Find an Order Request</h2><p>Enter your Order Request ID and the email used at checkout.</p></div><div class="jp-track-search-fields"><div class="jp-mobile-field"><label>Order Request ID</label><input id="jpTrackCode" placeholder="OR-001"></div><div class="jp-mobile-field"><label>Email Address</label><input id="jpTrackEmail" type="email" placeholder="you@example.com"></div></div><button id="jpTrackLookup" class="jp-mobile-primary">Track Request</button></section>';
    shell(html,true,"track");
    document.getElementById("jpFlowBack").onclick=close;
    var trackCode=document.getElementById("jpTrackCode");
    if(trackCode){
      trackCode.setAttribute("inputmode","text");
      trackCode.setAttribute("autocapitalize","characters");
      trackCode.addEventListener("input",function(){
        var digits=trackCode.value.toUpperCase().replace(/^OR-?/,"").replace(/\D/g,"").slice(0,6);
        trackCode.value=digits?"OR-"+digits:"";
      });
    }
    document.getElementById("jpTrackLookup").onclick=async function(){var code=document.getElementById("jpTrackCode").value.trim().toUpperCase(),email=document.getElementById("jpTrackEmail").value.trim();try{var r=await T().request("/api/suite",{action:"track-public",code:code,email:email});showTrack(r.order,"");}catch(e){toast(e.message);}};
  }
  async function trackToken(token){try{var r=await T().request("/api/suite",{action:"track",token:token});showTrack(r.order,token);}catch(e){toast(e.message);openTrack();}}
  function showTrack(order,token){
    var html='<div class="jp-flow-title"><h1>Track Request</h1></div>'+timeline(order,token);shell(html,true,"track");document.getElementById("jpFlowBack").onclick=close;var ref=document.getElementById("jpRefreshTrack");if(ref)ref.onclick=function(){token?trackToken(token):showTrack(order,"");};var accept=document.getElementById("jpAcceptOffer");if(accept)accept.onclick=async function(){try{var r=await T().request("/api/suite",{action:"accept-revision",token:token});toast("Revised offer accepted");showTrack(r.order,token);}catch(e){toast(e.message);}};
  }
  function trackClientRequest(order){showTrack(order,"");}
  function install(){
    window.JPMobileCommerce={addCatalogItem:addCatalogItem,openCart:openCart,openTrack:openTrack,trackClientRequest:trackClientRequest,trackToken:trackToken,cartCount:cartCount,cartTotal:cartTotal,close:close};
    if(window.JuanSuite){window.JuanSuite.addShopItem=addCatalogItem;window.JuanSuite.openCart=openCart;window.JuanSuite.track=openTrack;window.JuanSuite.shop=function(){return null;};}
    document.querySelectorAll(".suite-online-quick-actions").forEach(function(x){x.remove();});
    if(location.hash.indexOf("#track=")===0){var token=decodeURIComponent(location.hash.slice(7));setTimeout(function(){trackToken(token);},150);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(install,50);});else setTimeout(install,50);
})();