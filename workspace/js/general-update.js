/* JUAN PROJECT Workspace — coordinated Sep 20 update */
(function(){
  "use strict";
  var API=function(body){return window.JuanSuiteRuntime.request("/api/suite",body);};
  var esc=function(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
  var peso=function(v){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(v||0));};
  var dateText=function(v){
    if(!v)return "—";var s=String(v),d;
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){var p=s.split("-").map(Number);d=new Date(p[0],p[1]-1,p[2],12);}
    else d=new Date(s);
    return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
  };
  var dateTime=function(v){if(!v)return "—";var d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});};
  var toast=function(m){if(window.showToast)window.showToast(m);};
  var orders=[],filter="active",query="",overlay=null;

  function ready(fn,n){n=n||0;if(window.app&&window.JuanSuiteRuntime)return fn();if(n<60)setTimeout(function(){ready(fn,n+1);},100);}
  function closeOverlay(){if(overlay)overlay.remove();overlay=null;document.body.classList.remove("jp-general-modal-open");}
  function modal(html,cls){
    closeOverlay();overlay=document.createElement("div");overlay.className="jp-general-overlay";
    overlay.innerHTML='<section class="jp-general-modal '+(cls||"")+'" role="dialog" aria-modal="true">'+html+"</section>";
    document.body.appendChild(overlay);document.body.classList.add("jp-general-modal-open");
    overlay.addEventListener("click",function(e){if(e.target===overlay)closeOverlay();});
    return overlay.firstElementChild;
  }
  function confirmAction(options){
    options=options||{};
    return new Promise(function(resolve){
      var previous=overlay;
      if(previous)previous.style.display="none";
      var layer=document.createElement("div");layer.className="jp-confirm-overlay";
      layer.innerHTML='<section class="jp-confirm-card" role="alertdialog" aria-modal="true"><div class="jp-confirm-icon '+(options.danger?"danger":"")+'">'+(options.danger?"!":"✓")+'</div><h3>'+esc(options.title||"Confirm action")+'</h3><p>'+esc(options.message||"")+'</p><div class="jp-confirm-error" data-error aria-live="polite"></div><div class="jp-confirm-actions"><button class="btn btn-secondary" data-no>Cancel</button><button class="btn '+(options.danger?"btn-danger":"btn-primary")+'" data-yes>'+esc(options.confirmLabel||"Confirm")+'</button></div></section>';
      document.body.appendChild(layer);
      var onKey=function(e){if(e.key==="Escape"){finish(false);}else if(e.key==="Enter"){finish(true);}};
      function finish(value){document.removeEventListener("keydown",onKey,true);layer.remove();if(previous&&document.body.contains(previous))previous.style.display="";resolve(value);}
      layer.querySelector("[data-no]").onclick=function(){finish(false);};
      layer.querySelector("[data-yes]").onclick=async function(){var yes=this,err=layer.querySelector("[data-error]");if(!options.action){finish(true);return;}yes.disabled=true;err.textContent="";try{await options.action();finish(true);}catch(e){err.textContent=e?.message||"Could not complete this action.";yes.disabled=false;}};
      layer.addEventListener("click",function(e){if(e.target===layer)finish(false);});
      document.addEventListener("keydown",onKey,true);
      layer.querySelector("[data-yes]").focus();
    });
  }
  function preparingOrder(order){
    var layer=document.createElement("div");layer.className="jp-prepare-overlay";
    layer.innerHTML='<section class="jp-prepare-card"><div class="jp-prepare-mark"><span></span></div><div><span class="section-kicker">ORDER REQUEST</span><h3>Preparing '+esc(order?.code||"order")+'…</h3><p>Matching the client email and loading the request into New Order.</p></div></section>';
    document.body.appendChild(layer);
    return {
      done:function(message){layer.classList.add("done");layer.querySelector(".jp-prepare-mark").innerHTML="✓";layer.querySelector("h3").textContent=message||"Order ready";layer.querySelector("p").textContent="You can review dates, discounts, and charges before creating the project.";setTimeout(function(){layer.remove();},650);},
      fail:function(message){layer.classList.add("failed");layer.querySelector(".jp-prepare-mark").innerHTML="!";layer.querySelector("h3").textContent="Could not prepare order";layer.querySelector("p").textContent=message||"Try again.";setTimeout(function(){layer.remove();},1600);}
    };
  }

  function ensureOrdersView(){
    var s=document.getElementById("view-orders");
    if(!s){
      s=document.createElement("section");s.id="view-orders";s.className="view";
      s.innerHTML=
        '<header class="page-header"><div><div class="greeting-subtitle">Online Intake</div><h1 class="page-title">Orders</h1><div class="page-description">Review Order Requests before turning them into projects.</div></div><button class="btn btn-secondary" id="ordersRefreshBtn" type="button">Refresh</button></header>'+
        '<div class="view-toolbar unified-toolbar jp-orders-toolbar"><input class="form-control" id="ordersPageSearch" placeholder="Search Order ID, client, email, or request..."><div class="toolbar-actions"><div class="filter-pills" id="ordersPageFilters"></div></div></div>'+
        '<div class="card table-card"><div class="table-responsive"><table class="data-table unified-table jp-orders-page-table" data-keyboard-table="orders"><thead><tr><th>Order ID</th><th>Client</th><th>Request</th><th>Amount</th><th>Submitted</th><th>Status</th><th class="table-actions-col"></th></tr></thead><tbody id="ordersPageRows"></tbody></table></div></div>';
      var clients=document.getElementById("view-clients"),parent=clients?clients.parentNode:document.querySelector(".main-content");
      if(clients)parent.insertBefore(s,clients);else parent.appendChild(s);
    }
    var refresh=document.getElementById("ordersRefreshBtn");
    if(refresh&&!refresh.dataset.ordersBound){refresh.dataset.ordersBound="1";refresh.addEventListener("click",function(){renderOrders(true);});}
    var search=document.getElementById("ordersPageSearch");
    if(search&&!search.dataset.ordersBound){search.dataset.ordersBound="1";search.addEventListener("input",function(e){query=e.target.value.trim().toLowerCase();renderOrders(false);});}
  }
  function effectiveStatus(o){return o.archived_at?"Archived":(o.status||"Order Received");}
  function drawFilters(){
    var host=document.getElementById("ordersPageFilters");if(!host)return;
    var opts=[["active","Active"],["all","All"],["approved","Approved"],["rejected","Rejected"],["archived","Archived"]];
    host.innerHTML=opts.map(function(x){return '<button class="filter-pill '+(filter===x[0]?"active":"")+'" data-filter="'+x[0]+'">'+x[1]+"</button>";}).join("");
    host.querySelectorAll("[data-filter]").forEach(function(b){b.onclick=function(){filter=b.dataset.filter;renderOrders(false);};});
  }
  function visibleOrders(){
    return orders.filter(function(o){
      var s=effectiveStatus(o).toLowerCase();
      if(filter==="active"&&(o.archived_at||s==="rejected"||s==="project created"))return false;
      if(filter==="approved"&&s!=="approved")return false;
      if(filter==="rejected"&&s!=="rejected")return false;
      if(filter==="archived"&&s!=="archived")return false;
      if(query&&((o.code||"")+" "+(o.name||"")+" "+(o.email||"")+" "+(o.title||"")+" "+s).toLowerCase().indexOf(query)<0)return false;
      return true;
    });
  }
  async function renderOrders(reload){
    ensureOrdersView();drawFilters();var body=document.getElementById("ordersPageRows");if(!body)return;
    if(reload!==false){
      body.innerHTML='<tr><td colspan="7" class="text-center text-muted py-4">Loading orders…</td></tr>';
      try{var d=await API({action:"dashboard"});orders=Array.isArray(d.incoming_orders)?d.incoming_orders:[];}
      catch(e){body.innerHTML='<tr><td colspan="7" class="text-center text-danger py-4">'+esc(e.message||"Orders could not be loaded.")+"</td></tr>";return;}
    }
    var list=visibleOrders();
    body.innerHTML=list.map(function(o){
      var id=esc(o.id),menu="orderPageMenu_"+String(o.id).replace(/[^a-zA-Z0-9_-]/g,""),status=effectiveStatus(o);
      return '<tr class="clickable-row" data-record-id="'+id+'" tabindex="-1" onclick="window.JPGeneral.openOrder(\''+id+'\')">'+
        '<td><strong class="project-id-cell">'+esc(o.code||"—")+"</strong></td>"+
        '<td><strong>'+esc(o.name||"Client")+'</strong><span class="jp-secondary-cell">'+esc(o.email||"")+"</span></td>"+
        '<td><strong>'+esc(o.title||"Order Request")+'</strong><span class="jp-secondary-cell">'+(o.items||[]).length+" item(s)</span></td>"+
        "<td><strong>"+peso(o.total)+"</strong></td><td class=\"jp-date-cell\">"+esc(dateText(o.created_at))+"</td>"+
        '<td><span class="badge '+(status==="Rejected"?"badge-red":status==="Approved"?"badge-green":"badge-neutral")+'">'+esc(status)+"</span></td>"+
        '<td class="table-row-actions" onclick="event.stopPropagation()"><div class="popover-wrap" id="'+menu+'"><button class="icon-more-button vertical-more" aria-label="Order actions" onclick="app.togglePopover(\''+menu+'\',event)">⋮</button><div class="popover-panel client-row-menu">'+
        '<button class="popover-action" onclick="window.JPGeneral.openOrder(\''+id+'\',true)">Edit Order</button>'+
        (o.project_id?"":'<button class="popover-action text-danger" onclick="window.JPGeneral.archiveOrder(\''+id+'\')">Delete Order</button>')+
        "</div></div></td></tr>";
    }).join("")||'<tr><td colspan="7" class="text-center text-muted py-4">No matching orders.</td></tr>';
  }
  function findOrder(id){return orders.find(function(o){return String(o.id)===String(id);});}
  function itemTable(items,editing){
    return (items||[]).map(function(i,n){
      var name=editing?'<input class="form-control" data-oname="'+n+'" value="'+esc(i.name||"Order Item")+'">':'<strong>'+esc(i.name||"Order Item")+"</strong>";
      var qty=editing?'<input class="form-control" data-oqty="'+n+'" type="number" min="1" value="'+Number(i.qty||1)+'">':String(Number(i.qty||1));
      var price=editing?'<input class="form-control" data-oprice="'+n+'" type="number" min="0" step=".01" value="'+Number(i.price||0)+'">':peso(i.price);
      return "<tr><td>"+name+"</td><td>"+qty+"</td><td>"+price+"</td><td>"+peso(Number(i.price||0)*Number(i.qty||1))+"</td></tr>";
    }).join("");
  }
  function openOrder(id,editing){
    var o=findOrder(id);if(!o)return;var items=(o.items||[]).map(function(i){return Object.assign({},i);});
    var canDecide=!o.project_id&&!o.archived_at&&o.status!=="Rejected"&&o.status!=="Project Created";
    var m=modal(
      '<header class="jp-general-modal-head"><div><span class="section-kicker">ORDER REQUEST</span><h2>'+esc(o.code||"Order")+'</h2><p>'+esc(o.title||"Order Request")+'</p></div><button class="jp-general-x" aria-label="Close">×</button></header>'+
      '<section class="card jp-order-client-card"><div class="jp-order-card-head"><div><div class="section-kicker">CLIENT INFORMATION</div><div class="jp-order-client-name">'+esc(o.name||"Client")+'</div></div><span class="badge '+(o.status==="Rejected"?"badge-red":o.status==="Approved"?"badge-green":"badge-neutral")+'">'+esc(effectiveStatus(o))+'</span></div><div class="jp-order-facts"><span>Email</span><b>'+esc(o.email||"—")+'</b><span>Phone</span><b>'+esc(o.phone||"—")+'</b><span>Requested Date</span><b>'+esc(dateText(o.deadline))+'</b><span>Submitted</span><b>'+esc(dateTime(o.created_at))+'</b></div></section>'+
      '<section class="card"><div class="card-header"><div><div class="section-kicker">ORDER ITEMS</div><h3 class="card-title">'+(editing?"Edit Requested Items":"Requested Items")+'</h3></div></div><div class="table-responsive"><table class="data-table jp-order-preview-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>'+itemTable(items,!!editing)+"</tbody></table></div></section>"+
      '<section class="card jp-order-summary-card"><div class="section-kicker">ORDER SUMMARY</div><div><span>Subtotal</span><b>'+peso(o.subtotal)+'</b></div><div><span>Rush Fee</span><b>'+peso(o.rush_fee)+'</b></div><div><span>Discount</span><b>− '+peso(o.discount_amount)+'</b></div><div class="total"><span>Estimated Total</span><strong>'+peso(o.total)+'</strong></div></section>'+
      '<section class="card"><label class="form-label">Review Note</label><textarea id="orderPageNote" class="form-control" rows="3" placeholder="Add an internal note (optional)">'+esc(o.review_note||"")+"</textarea></section>"+
      '<footer class="jp-order-preview-actions">'+(editing?'<button class="btn btn-secondary" id="orderSaveEdits">Save Changes</button>':"")+(canDecide?'<button class="btn btn-danger" id="orderRejectBtn">Reject</button><button class="btn btn-primary" id="orderApproveBtn">Approve Order</button>':"")+"</footer>",
      "jp-order-preview-modal"
    );
    m.querySelector(".jp-general-x").onclick=closeOverlay;
    var save=m.querySelector("#orderSaveEdits");
    if(save)save.onclick=async function(){
      try{
        var edited=items.map(function(base,n){
          return Object.assign({},base,{name:m.querySelector('[data-oname="'+n+'"]').value.trim()||base.name,qty:Math.max(1,Number(m.querySelector('[data-oqty="'+n+'"]').value||1)),price:Math.max(0,Number(m.querySelector('[data-oprice="'+n+'"]').value||0))});
        });
        var r=await API({action:"revise-order",id:o.id,items:edited,rush_fee:Number(o.rush_fee||0),discount_amount:Number(o.discount_amount||0),note:m.querySelector("#orderPageNote").value,send_to_client:false});
        Object.assign(o,r.order);toast("Changes saved");openOrder(o.id,false);
      }catch(e){toast(e.message||"Could not save changes.");}
    };
    var reject=m.querySelector("#orderRejectBtn");
    if(reject)reject.onclick=async function(){
      var note=m.querySelector("#orderPageNote").value.trim();if(!note){toast("Add a rejection reason first.");return;}
      if(!(await confirmAction({title:"Reject "+o.code+"?",message:"This request will stay in history with a Rejected status.",confirmLabel:"Reject Order",danger:true})))return;
      try{
        await API({action:"review-order",id:o.id,status:"Rejected",note:note});
        o.status="Rejected";o.review_note=note;closeOverlay();toast("Order rejected.");renderOrders(false);
      }catch(e){toast(e.message);}
    };
    var approve=m.querySelector("#orderApproveBtn");
    if(approve)approve.onclick=async function(){
      if(!(await confirmAction({title:"Approve "+o.code+"?",message:"The request will be prepared in New Order. An existing client is used only when the email matches exactly.",confirmLabel:"Approve Order"})))return;
      var prep=preparingOrder(o);
      try{
        approve.disabled=true;
        var r=await API({action:"approve-order",id:o.id,note:m.querySelector("#orderPageNote").value});
        o.status="Approved";o.client_id=r.client?.id||null;Object.assign(o,r.order||{});
        closeOverlay();
        window.app.preloadOrderRequestData(r.order,r.client);
        prep.done((o.code||"Order")+" is ready");
        toast((o.code||"Order")+" loaded into New Order.");
      }catch(e){prep.fail(e.message);approve.disabled=false;toast(e.message);}
    };
  }
  async function archiveOrder(id){
    var o=findOrder(id);if(!o)return;
    if(!(await confirmAction({title:"Delete "+o.code+"?",message:"It will disappear from Active Orders and remain archived for history.",confirmLabel:"Delete Order",danger:true})))return;
    var index=orders.findIndex(function(x){return String(x.id)===String(id);});
    var snapshot=index>=0?Object.assign({},orders[index]):null;
    if(index>=0){orders[index].archived_at=new Date().toISOString();orders[index].status="Archived";}
    closeOverlay();renderOrders(false);toast("Order removed.");
    try{await API({action:"archive-order",id:id});}
    catch(e){if(index>=0&&snapshot)orders[index]=snapshot;renderOrders(false);toast("Delete failed: "+(e.message||e));}
  }

  function renderEditableClient(){
    var st=window.app.getWorkspaceState(),id=st.activeClientId,c=(st.clients||[]).find(function(x){return String(x.id)===String(id);}),host=document.getElementById("clientProfileContent");
    if(!c||!host)return;
    var ps=(st.projects||[]).filter(function(p){return !p.deleted&&String(p.client_id)===String(c.id);});
    var paid=function(p){return (p.payments||[]).filter(function(x){return !x.deleted_at;}).reduce(function(s,x){return s+Number(x.amount_paid||x.amount||0);},0);};
    var total=ps.reduce(function(s,p){return s+Number(p.total_amount||0);},0),paidTotal=ps.reduce(function(s,p){return s+paid(p);},0);
    document.getElementById("clientProfileName").textContent=c.name||"Client";document.getElementById("clientProfileEmail").textContent=(c.client_code||"Client")+" · Editable Client Record";
    host.innerHTML=
      '<div class="jp-inline-client-layout"><section class="card"><div class="card-header"><div><div class="section-kicker">CLIENT RECORD</div><h2 class="card-title">Client Information</h2></div><span class="badge badge-green">Active</span></div><div class="form-grid">'+
      '<div class="form-group"><label class="form-label">Client ID</label><input class="form-control" value="'+esc(c.client_code||"—")+'" readonly></div>'+
      '<div class="form-group"><label class="form-label">Full Name</label><input id="inlineClientName" class="form-control" value="'+esc(c.name||"")+'"></div>'+
      '<div class="form-group"><label class="form-label">Email</label><input id="inlineClientEmail" type="email" class="form-control" value="'+esc(c.email||"")+'"></div>'+
      '<div class="form-group"><label class="form-label">Contact Number</label><input id="inlineClientPhone" class="form-control" value="'+esc(c.phone||"")+'"></div>'+
      '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Address</label><input id="inlineClientAddress" class="form-control" value="'+esc(c.address||"")+'"></div>'+
      '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Notes</label><textarea id="inlineClientNotes" class="form-control" rows="4">'+esc(c.notes||"")+"</textarea></div></div>"+
      '<div class="jp-inline-form-footer"><span id="inlineClientSaveState">Changes save automatically.</span></div></section>'+
      '<aside class="card jp-inline-client-summary"><div class="section-kicker">SUMMARY</div><h2 class="card-title">Client Value</h2><div class="jp-summary-line"><span>Total Projects</span><b>'+ps.length+'</b></div><div class="jp-summary-line"><span>Total Project Value</span><b>'+peso(total)+'</b></div><div class="jp-summary-line"><span>Total Paid</span><b class="positive">'+peso(paidTotal)+'</b></div><div class="jp-summary-line"><span>Outstanding</span><b>'+peso(Math.max(0,total-paidTotal))+'</b></div><div class="jp-summary-line"><span>Date Added</span><b>'+esc(dateText(c.created_at))+"</b></div></aside></div>"+
      '<section class="card jp-inline-recent"><div class="card-header"><h2 class="card-title">Recent Projects</h2><button class="btn btn-secondary btn-sm" onclick="app.navigateTo(\'projects\')">View All →</button></div><div class="table-responsive"><table class="data-table"><thead><tr><th>Project</th><th>Value</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th></tr></thead><tbody>'+
      (ps.slice().sort(function(a,b){return new Date(b.created_at||0)-new Date(a.created_at||0);}).slice(0,5).map(function(p){var pd=paid(p);return '<tr class="clickable-row" onclick="app.openProjectDetails(\''+esc(p.id)+'\')"><td><strong class="project-id-cell">'+esc(p.title||p.project_code||"Project")+'</strong></td><td>'+peso(p.total_amount)+'</td><td>'+peso(pd)+'</td><td>'+peso(Math.max(0,Number(p.total_amount||0)-pd))+'</td><td><span class="badge badge-green">'+esc(p.status||p.delivery_status||"Active")+'</span></td><td class="jp-date-cell">'+esc(dateText(p.created_at||p.start_date))+"</td></tr>";}).join("")||'<tr><td colspan="6" class="text-center text-muted">No projects.</td></tr>')+
      "</tbody></table></div></section>";
    var timer=null;
    ["inlineClientName","inlineClientEmail","inlineClientPhone","inlineClientAddress","inlineClientNotes"].forEach(function(fid){
      var field=document.getElementById(fid);if(!field)return;
      field.addEventListener("input",function(){
        localStorage.setItem("JUAN_CLIENT_DRAFT_"+c.id,JSON.stringify({name:document.getElementById("inlineClientName").value,email:document.getElementById("inlineClientEmail").value,phone:document.getElementById("inlineClientPhone").value,address:document.getElementById("inlineClientAddress").value,notes:document.getElementById("inlineClientNotes").value,at:Date.now()}));
        var stateEl=document.getElementById("inlineClientSaveState");if(stateEl)stateEl.textContent="Saving…";
        clearTimeout(timer);timer=setTimeout(function(){saveClient(c.id,true);},650);
      });
    });
    var draft=localStorage.getItem("JUAN_CLIENT_DRAFT_"+c.id);
    if(draft){try{var d=JSON.parse(draft);if(Date.now()-Number(d.at||0)<86400000){document.getElementById("inlineClientName").value=d.name??document.getElementById("inlineClientName").value;document.getElementById("inlineClientEmail").value=d.email??document.getElementById("inlineClientEmail").value;document.getElementById("inlineClientPhone").value=d.phone??document.getElementById("inlineClientPhone").value;document.getElementById("inlineClientAddress").value=d.address??document.getElementById("inlineClientAddress").value;document.getElementById("inlineClientNotes").value=d.notes??document.getElementById("inlineClientNotes").value;}}catch(_){}}
  }
  async function saveClient(id,silent){
    var st=window.app.getWorkspaceState(),c=(st.clients||[]).find(function(x){return String(x.id)===String(id);}),db=window.app.getDatabaseClient();if(!c||!db)return toast("Database is not connected.");
    var name=document.getElementById("inlineClientName").value.trim(),email=document.getElementById("inlineClientEmail").value.trim().toLowerCase(),phone=document.getElementById("inlineClientPhone").value.trim(),address=document.getElementById("inlineClientAddress").value.trim(),notes=document.getElementById("inlineClientNotes").value.trim();
    if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast("Enter a client name and valid email.");
    var stateEl=document.getElementById("inlineClientSaveState");
    try{
      var u=await db.from("clients").update({name:name,email:email,phone:phone||null,address:address||null,notes:notes}).eq("id",id).select("*").single();if(u.error)throw u.error;
      var pu=await db.from("projects").update({client_name:name,client_email:email,client_phone:phone||null}).eq("client_id",id);if(pu.error)throw pu.error;
      Object.assign(c,u.data);(st.projects||[]).filter(function(p){return String(p.client_id)===String(id);}).forEach(function(p){p.client_name=name;p.client_email=email;p.client_phone=phone||null;});
      localStorage.removeItem("JUAN_CLIENT_DRAFT_"+id);if(stateEl)stateEl.textContent="Saved";
      if(!silent)toast("Changes saved");
    }catch(e){if(stateEl)stateEl.textContent="Save failed";toast(e.code==="23505"?"That email is already assigned to another client.":e.message);}
  }

  function ensureAdsPage(){
    document.querySelector('#onlinePortalTabs [data-portal-tab="ads"]')?.remove();
    document.getElementById("onlinePortalAdsPanel")?.remove();
    return document.getElementById("jpAdsAdmin");
  }
  function adStatus(a){
    if(a.archived_at||a.status==="archived")return "Archived";if(a.status==="paused")return "Paused";var now=Date.now(),start=a.start_at?new Date(a.start_at).getTime():0,end=a.end_at?new Date(a.end_at).getTime():0;
    if(end&&!a.no_expiration&&end<=now)return "Expired";if(start&&start>now)return "Scheduled";if(a.status==="published"&&a.enabled!==false)return "Live";return a.status==="draft"?"Draft":(a.status||"Draft");
  }
  function adPlacementLabel(v){return ({homepage_banner:"Home Banner",guest_home_banner:"Guest Home",guest_shop_banner:"Guest Shop",client_home_banner:"Client Home",client_shop_banner:"Client Shop",homepage_popup:"Home Popup",guest_home_popup:"Guest Home Popup",client_home_popup:"Client Home Popup"})[v]||String(v||"—").replace(/_/g," ");}
  function adAudienceLabel(v){return ({all:"Everyone",guest:"Guests",client:"Clients"})[v]||"Everyone";}
  function adDestinationLabel(a){var type=String(a.destination_type||"no_action"),value=String(a.destination_value||"").trim(),label=({no_action:"No action",shop:"Shop",package:"Package",service:"Service",referral:"Referral",loyalty:"Loyalty",page:"Online page",external_url:"External URL"})[type]||type;return label+(value?" · "+value:"");}
  async function renderAds(){
    var host=ensureAdsPage();if(!host)return;host.innerHTML='<div class="jp-ad-loading"><span class="portal-loading-spinner"></span><div><strong>Loading Ad Management</strong><small>Syncing campaigns…</small></div></div>';
    try{
      var d=await API({action:"ad-dashboard"}),ads=d.ads||[],settings=d.settings||{enabled:true,rotation_seconds:8,max_active_popups:1,auto_archive_expired:true};
      host.innerHTML='<div class="jp-ads-page"><div class="jp-ads-heading"><div><span class="section-kicker">ONLINE PORTAL</span><h1>Ad Management</h1><p>Control banners and popups shown in JUAN PROJECT Online.</p></div><div class="jp-ads-heading-actions"><label class="jp-ad-master-toggle"><span>In-house Ads</span><span class="toggle-switch"><input id="jpAdsMaster" type="checkbox" '+(settings.enabled!==false?'checked':'')+'><span class="toggle-slider"></span></span></label><button class="btn btn-secondary" id="jpBannerSettings">Ad Settings</button><button class="btn btn-primary" id="jpCreateAd">+ New Ad</button></div></div>'+
        '<section class="jp-ad-management"><div class="jp-ad-toolbar"><div class="jp-ad-search-wrap"><span aria-hidden="true">⌕</span><input id="jpAdSearch" class="form-control" placeholder="Search ad or destination…"></div><div class="filter-pills" id="jpAdFilters"><button class="filter-pill active">All</button><button class="filter-pill">Active</button><button class="filter-pill">Scheduled</button><button class="filter-pill">Draft</button><button class="filter-pill">Paused</button><button class="filter-pill">Expired</button><button class="filter-pill">Archived</button></div></div>'+
        '<div class="jp-ad-table-wrap"><table class="data-table unified-table jp-ad-table"><thead><tr><th>Ad Name</th><th>Type</th><th>Placement</th><th>Status</th><th>Schedule</th><th>Destination</th><th class="table-actions-col"></th></tr></thead><tbody id="jpAdRows"></tbody></table></div></section>'+
        '<div class="jp-ad-rules"><div><strong>Display rules</strong><span>Banners rotate and cannot be dismissed. Only one popup may be active at a time.</span></div><small>Rotation: '+Number(settings.rotation_seconds||8)+' seconds</small></div></div>';
      var current="All",search=document.getElementById("jpAdSearch"),filters=document.getElementById("jpAdFilters"),rows=document.getElementById("jpAdRows");
      function draw(){
        var q=(search.value||"").toLowerCase().trim(),list=ads.filter(function(a){var s=adStatus(a),match=current==="All"||current==="Active"&&s==="Live"||s===current;if(!match)return false;return !q||((a.title||"")+" "+adPlacementLabel(a.placement)+" "+adDestinationLabel(a)).toLowerCase().indexOf(q)>=0;});
        rows.innerHTML=list.map(function(a){var status=adStatus(a),menu="adMenu_"+String(a.id).replace(/-/g,""),statusClass=status==="Live"?"badge-green":status==="Expired"?"badge-red":status==="Scheduled"?"badge-orange":"badge-neutral",schedule=(a.start_at?esc(dateTime(a.start_at)):"Now")+'<span class="jp-secondary-cell">'+(a.no_expiration?"No expiration":a.end_at?"Ends "+esc(dateTime(a.end_at)):"No end date")+"</span>",archiveAction=status==="Archived"?"":'<button class="popover-action" data-aarchive="'+a.id+'">Archive</button>',deleteAction='<div class="jp-popover-separator"></div><button class="popover-action text-danger" data-adelete="'+a.id+'">Delete Campaign</button>';return '<tr><td><strong>'+esc(a.title||"Untitled ad")+'</strong></td><td><span class="badge badge-neutral">'+esc(a.ad_type==="popup"?"Popup":"Banner")+'</span></td><td><strong class="jp-ad-cell-primary">'+esc(adPlacementLabel(a.placement))+'</strong></td><td><span class="badge '+statusClass+'">'+esc(status==="Live"?"Active":status)+'</span></td><td>'+schedule+'</td><td>'+esc(adDestinationLabel(a))+'</td><td class="table-row-actions"><div class="popover-wrap" id="'+menu+'"><button class="icon-more-button vertical-more" aria-label="Ad actions" onclick="app.togglePopover(\''+menu+'\',event)">⋮</button><div class="popover-panel client-row-menu"><button class="popover-action" data-aedit="'+a.id+'">Edit</button><button class="popover-action" data-aduplicate="'+a.id+'">Duplicate</button><button class="popover-action" data-atoggle="'+a.id+'">'+(status==="Live"?"Pause":"Publish")+'</button>'+archiveAction+deleteAction+'</div></div></td></tr>';}).join("")||'<tr><td colspan="7" class="text-center text-muted py-4">No matching ads.</td></tr>';
        rows.querySelectorAll("[data-aedit]").forEach(function(btn){btn.onclick=function(){openAd(ads.find(function(a){return a.id===btn.dataset.aedit;}),renderAds);};});
        rows.querySelectorAll("[data-aduplicate]").forEach(function(btn){btn.onclick=async function(){var a=ads.find(function(x){return x.id===btn.dataset.aduplicate;});if(!a)return;try{var copy=Object.assign({},a,{id:null,title:(a.title||"Ad")+" Copy",status:"draft",enabled:false,published_at:null,archived_at:null});await API({action:"save-ad",ad:copy});toast("Ad duplicated as draft.");renderAds();}catch(e){toast(e.message);}};});
        rows.querySelectorAll("[data-atoggle]").forEach(function(btn){btn.onclick=async function(){var a=ads.find(function(x){return x.id===btn.dataset.atoggle;}),wasLive=adStatus(a)==="Live";try{await API({action:"save-ad",ad:Object.assign({},a,{status:wasLive?"paused":"published"})});toast(wasLive?"Ad paused.":"Ad published.");renderAds();}catch(e){toast(e.message);}};});
        rows.querySelectorAll("[data-aarchive]").forEach(function(btn){btn.onclick=async function(){var a=ads.find(function(x){return x.id===btn.dataset.aarchive;});if(!(await confirmAction({title:"Archive "+(a?.title||"ad")+"?",message:"The ad will stop appearing in JUAN PROJECT Online and remain in Archived.",confirmLabel:"Archive",danger:false})))return;try{await API({action:"archive-ad",id:btn.dataset.aarchive});toast("Ad archived.");renderAds();}catch(e){toast(e.message);}};});
        rows.querySelectorAll("[data-adelete]").forEach(function(btn){btn.onclick=async function(){var a=ads.find(function(x){return x.id===btn.dataset.adelete;});var ok=await confirmAction({title:"Delete "+(a?.title||"campaign")+"?",message:"This permanently removes the campaign. This action cannot be undone.",confirmLabel:"Delete permanently",danger:true,action:async function(){await API({action:"delete-ad",id:btn.dataset.adelete});}});if(ok){toast("Campaign deleted.");renderAds();}};});
      }
      filters.querySelectorAll("button").forEach(function(btn){btn.onclick=function(){current=btn.textContent.trim();filters.querySelectorAll("button").forEach(function(x){x.classList.toggle("active",x===btn);});draw();};});search.oninput=draw;draw();
      document.getElementById("jpCreateAd").onclick=function(){openAd(null,renderAds);};
      document.getElementById("jpBannerSettings").onclick=function(){bannerSettings(settings,renderAds);};
      document.getElementById("jpAdsMaster").onchange=async function(){var enabled=this.checked;this.disabled=true;try{await API({action:"ad-settings",enabled:enabled,rotation_seconds:Number(settings.rotation_seconds||8),max_active_popups:1,auto_archive_expired:settings.auto_archive_expired!==false});toast(enabled?"In-house ads enabled.":"In-house ads disabled.");settings.enabled=enabled;}catch(e){this.checked=!enabled;toast(e.message);}finally{this.disabled=false;}};
    }catch(e){host.innerHTML='<div class="card text-danger">'+esc(e.message)+"</div>";}
  }
  async function uploadAd(file,type){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error("Use JPG, PNG, or WEBP.");
    var bitmap=await createImageBitmap(file),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
    if(type==="banner"){
      canvas.width=1800;canvas.height=600;
      var scale=Math.max(canvas.width/bitmap.width,canvas.height/bitmap.height),dw=bitmap.width*scale,dh=bitmap.height*scale,dx=(canvas.width-dw)/2,dy=(canvas.height-dh)/2;
      ctx.drawImage(bitmap,dx,dy,dw,dh);
    }else{
      var scale=Math.min(1,1600/bitmap.width);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    }
    bitmap.close();
    var blob=await new Promise(function(r){canvas.toBlob(r,"image/webp",.84);});if(!blob||blob.size>2097152)throw new Error("Promotional image must be 2 MB or smaller after compression.");
    var db=window.app.getDatabaseClient();if(!db)throw new Error("Database is not connected.");var name="ads/"+Date.now()+"-"+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2))+".webp",up=await db.storage.from("juan-ad-assets").upload(name,blob,{contentType:"image/webp",upsert:false});if(up.error)throw up.error;return db.storage.from("juan-ad-assets").getPublicUrl(name).data.publicUrl;
  }
  function openAd(a,done){
    a=a||{ad_type:"banner",status:"draft",placement:"guest_home_banner",audience:"all",destination_type:"no_action",priority:0,no_expiration:false};
    var existingMode=a.destination_type==="external_url"?"external_url":a.destination_type==="no_action"?"no_action":"page";
    var existingPage=a.destination_type==="page"?a.destination_value:(["shop","loyalty","referral"].includes(a.destination_type)?({shop:"shop",loyalty:"loyalty",referral:"rewards"}[a.destination_type]):"home");
    var m=modal('<header class="jp-general-modal-head"><div><span class="section-kicker">'+(a.id?"EDIT CAMPAIGN":"CREATE CAMPAIGN")+'</span><h2>'+(a.id?esc(a.title):"New Campaign")+'</h2></div><button class="jp-general-x" aria-label="Close">×</button></header>'+
      '<div class="jp-ad-editor-simple">'+
      '<section class="jp-ad-editor-section"><h3>Campaign</h3><div class="jp-ad-editor-grid"><div class="form-group"><label class="form-label">Campaign Name</label><input id="adTitle" class="form-control" value="'+esc(a.title||"")+'" placeholder="e.g. Most Sulit Package"><div id="adTitleError" class="jp-field-error"></div></div><div class="form-group"><label class="form-label">Ad Type</label><select id="adType" class="form-control"><option value="banner">Banner</option><option value="popup">Popup</option></select></div></div></section>'+
      '<section class="jp-ad-editor-section"><h3>Creative</h3><div class="form-group"><label class="form-label">Promotional Image</label><input id="adFile" class="form-control" type="file" accept="image/jpeg,image/png,image/webp"><small class="text-muted">'+(a.image?"Current image will stay unless you replace it.":"Banner images are prepared at 1800 × 600 px automatically.")+'</small><div id="adImageError" class="jp-field-error"></div></div><div class="form-group"><label class="form-label">Alt Text</label><input id="adAlt" class="form-control" value="'+esc(a.image_alt||a.title||"")+'" placeholder="Describe the image briefly"></div></section>'+
      '<section class="jp-ad-editor-section"><h3>Destination</h3><div class="form-group"><label class="form-label">When clicked</label><select id="adDestMode" class="form-control"><option value="no_action">No Link</option><option value="page">JUAN PROJECT Page</option><option value="external_url">External Website</option></select></div><div id="adPageGroup" class="form-group"><label class="form-label">Page</label><select id="adPage" class="form-control"><option value="home">Home</option><option value="shop">Shop</option><option value="track">Track Request</option><option value="login">Login</option><option value="orders">Orders</option><option value="payment">Payment</option><option value="account">Account</option><option value="loyalty">Loyalty / Rewards</option></select></div><div id="adUrlGroup" class="form-group"><label class="form-label">Website URL</label><input id="adUrl" class="form-control" inputmode="url" placeholder="https://example.com" value="'+esc(a.destination_type==="external_url"?a.destination_value||"":"")+'"><div id="adDestError" class="jp-field-error"></div></div></section>'+
      '<section class="jp-ad-editor-section"><h3>Schedule</h3><div class="jp-ad-editor-grid"><div class="form-group"><label class="form-label">Start</label><input id="adStart" class="form-control" type="datetime-local"></div><div class="form-group"><label class="form-label">End</label><input id="adEnd" class="form-control" type="datetime-local"><div id="adScheduleError" class="jp-field-error"></div></div></div><label class="jp-check-row"><input id="adNoExpiry" type="checkbox"> No expiration</label></section>'+
      '<details class="jp-ad-advanced"><summary>Advanced Settings</summary><div class="jp-ad-editor-grid"><div class="form-group"><label class="form-label">Audience</label><select id="adAudience" class="form-control"><option value="all">Everyone</option><option value="guest">Guests only</option><option value="client">Signed-in clients only</option></select></div><div class="form-group"><label class="form-label">Placement</label><select id="adPlacement" class="form-control"><optgroup label="Banner"><option value="guest_home_banner">Guest Home</option><option value="guest_shop_banner">Guest Shop</option><option value="client_home_banner">Client Home</option><option value="client_shop_banner">Client Shop</option></optgroup><optgroup label="Popup"><option value="guest_home_popup">Guest Home Popup</option><option value="client_home_popup">Client Home Popup</option></optgroup></select></div><div class="form-group"><label class="form-label">Priority</label><input id="adPriority" class="form-control" type="number" min="0" max="1000" value="'+Number(a.priority||0)+'"></div></div></details>'+
      '</div><footer class="jp-order-preview-actions"><button id="adDraft" class="btn btn-secondary">Save Draft</button><button id="adPublish" class="btn btn-primary">Publish</button></footer>',"jp-ad-editor-modal");
    m.querySelector(".jp-general-x").onclick=closeOverlay;
    document.getElementById("adType").value=a.ad_type||"banner";document.getElementById("adDestMode").value=existingMode;document.getElementById("adPage").value=existingPage||"home";document.getElementById("adAudience").value=a.audience||"all";document.getElementById("adPlacement").value=a.placement||((a.ad_type||"banner")==="popup"?"client_home_popup":"client_home_banner");document.getElementById("adNoExpiry").checked=!!a.no_expiration;
    function dt(v){if(!v)return "";var d=new Date(v),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,16);}document.getElementById("adStart").value=dt(a.start_at);document.getElementById("adEnd").value=dt(a.end_at);
    function syncDestination(){var mode=document.getElementById("adDestMode").value;document.getElementById("adPageGroup").classList.toggle("hidden",mode!=="page");document.getElementById("adUrlGroup").classList.toggle("hidden",mode!=="external_url");}
    function syncAdPlacement(){var type=document.getElementById("adType").value,placement=document.getElementById("adPlacement"),isPopup=type==="popup";Array.from(placement.options).forEach(function(o){o.disabled=isPopup?!o.value.endsWith("_popup"):o.value.endsWith("_popup");});if(placement.selectedOptions[0]?.disabled)placement.value=isPopup?"client_home_popup":"client_home_banner";}
    document.getElementById("adDestMode").onchange=syncDestination;document.getElementById("adType").onchange=syncAdPlacement;syncDestination();syncAdPlacement();
    document.getElementById("adUrl").onblur=function(){var raw=this.value.trim();if(raw&&!/^https?:\/\//i.test(raw))this.value="https://"+raw;};
    ["adTitle","adUrl","adStart","adEnd"].forEach(function(id){document.getElementById(id)?.addEventListener("input",function(){document.getElementById("adTitleError").textContent="";document.getElementById("adImageError").textContent="";document.getElementById("adDestError").textContent="";document.getElementById("adScheduleError").textContent="";});});
    async function save(status){
      var get=function(id){return document.getElementById(id).value;},title=get("adTitle").trim(),mode=get("adDestMode"),url=get("adUrl").trim(),start=get("adStart"),end=get("adEnd"),noExpiry=document.getElementById("adNoExpiry").checked,file=document.getElementById("adFile").files[0],image=a.image||null,valid=true;
      if(!title){document.getElementById("adTitleError").textContent="Enter a campaign name.";valid=false;}
      if(status==="published"&&!image&&!file){document.getElementById("adImageError").textContent="Add a promotional image before publishing.";valid=false;}
      if(mode==="external_url"&&!/^https:\/\/[^\s]+$/i.test(url)){document.getElementById("adDestError").textContent="Enter a complete secure URL beginning with https://";valid=false;}
      if(!noExpiry&&start&&end&&new Date(end)<=new Date(start)){document.getElementById("adScheduleError").textContent="End must be later than Start.";valid=false;}
      if(!valid){var first=m.querySelector(".jp-field-error:not(:empty)");first?.scrollIntoView({block:"center",behavior:"smooth"});return;}
      try{
        if(file)image=await uploadAd(file,get("adType"));
        var destValue=mode==="page"?get("adPage"):mode==="external_url"?url:"";
        await API({action:"save-ad",ad:Object.assign({},a,{id:a.id||null,title:title,ad_type:get("adType"),status:status,image:image,placement:get("adPlacement"),destination_type:mode,destination_value:destValue,start_at:start?new Date(start).toISOString():null,end_at:!noExpiry&&end?new Date(end).toISOString():null,no_expiration:noExpiry,priority:Number(get("adPriority")||0),image_alt:get("adAlt").trim()||title,audience:get("adAudience")})});
        toast(status==="published"?"Campaign published.":"Draft saved.");closeOverlay();done();
      }catch(e){document.getElementById("adTitleError").textContent=e?.message||"Campaign could not be saved.";}
    }
    document.getElementById("adDraft").onclick=function(){save("draft");};document.getElementById("adPublish").onclick=function(){save("published");};
  }
  function bannerSettings(settings,done){
    var m=modal('<header class="jp-general-modal-head"><div><span class="section-kicker">GLOBAL SETTINGS</span><h2>Ad Settings</h2></div><button class="jp-general-x">×</button></header><div class="form-group"><label class="form-label">Banner Rotation Interval</label><input id="bannerSeconds" class="form-control" type="number" min="3" max="120" value="'+Number(settings.rotation_seconds||8)+'"><small class="text-muted">Seconds before the next active banner appears.</small></div><div class="form-group"><label class="form-label">Maximum Active Popups</label><input class="form-control" value="1" readonly></div><label class="jp-check-row"><input id="adAutoArchive" type="checkbox" '+(settings.auto_archive_expired!==false?'checked':'')+'> Automatically archive expired ads</label><footer class="jp-order-preview-actions"><button id="bannerSave" class="btn btn-primary">Save Settings</button></footer>',"jp-banner-settings-modal");
    m.querySelector(".jp-general-x").onclick=closeOverlay;document.getElementById("bannerSave").onclick=async function(){try{await API({action:"ad-settings",enabled:settings.enabled!==false,rotation_seconds:Number(document.getElementById("bannerSeconds").value||8),max_active_popups:1,auto_archive_expired:document.getElementById("adAutoArchive").checked});toast("Ad settings saved.");closeOverlay();done();}catch(e){toast(e.message);}};
  }

  function install(){
    document.getElementById("juanSuiteNavGroup")?.remove();document.getElementById("suiteHeaderRequests")?.remove();document.getElementById("suiteHeaderScanner")?.remove();document.querySelectorAll(".suite-order-shortcuts").forEach(function(x){x.remove();});document.getElementById("suiteProfilePreview")?.remove();
    ensureOrdersView();ensureAdsPage();var nav=document.getElementById("workspaceOrdersNav");if(nav){nav.dataset.view="orders";nav.removeAttribute("onclick");}
    var originalNav=window.app.navigateTo.bind(window.app);window.app.navigateTo=function(view){var r=originalNav(view);if(view==="orders")setTimeout(function(){renderOrders(true);},0);if(view==="client-profile")setTimeout(renderEditableClient,0);if(view==="in-house-ads")setTimeout(renderAds,0);return r;};
    var openClient=window.app.openClientProfile&&window.app.openClientProfile.bind(window.app);if(openClient)window.app.openClientProfile=function(id){var r=openClient(id);setTimeout(renderEditableClient,0);return r;};
    var renderPortal=window.app.renderOnlinePortal&&window.app.renderOnlinePortal.bind(window.app);if(renderPortal)window.app.renderOnlinePortal=function(){var r=renderPortal();setTimeout(ensureAdsPage,0);return r;};
    window.jpOpenOrders=function(){window.app.navigateTo("orders");};nav&&nav.addEventListener("click",function(e){e.preventDefault();window.app.navigateTo("orders");});
    window.JPGeneral={renderOrders:renderOrders,openOrder:openOrder,archiveOrder:archiveOrder,renderEditableClient:renderEditableClient,renderAds:renderAds,closeOverlay:closeOverlay};
  }
  ready(install);
})();