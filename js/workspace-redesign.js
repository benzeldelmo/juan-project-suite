/* JUAN PROJECT Workspace — Order Intake / QR UX redesign */
(function(){
  'use strict';
  var runtime=window.JuanSuiteRuntime;
  if(!runtime||runtime.app!=='workspace')return;

  var overlay=null;
  var stopCamera=function(){};
  var previousNav=null;
  var audioContext=null;

  var esc=function(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };
  var money=function(value){
    return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(value||0));
  };
  var api=function(body){return runtime.request('/api/suite',body);};
  var by=function(id){return document.getElementById(id);};
  var delay=function(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});};
  var icon=function(name){
    var paths={
      refresh:'<path d="M20 11a8 8 0 1 0 1 5"/><path d="M20 4v7h-7"/>',
      file:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
      qr:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="M9 9h2v2H9zM13 9h2v2h-2zM9 13h2v2H9zM13 13h2v2h-2z"/>',
      camera:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13" r="3"/>',
      stop:'<rect x="7" y="7" width="10" height="10" rx="1"/>',
      link:'<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
      upload:'<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
      check:'<path d="m5 12 4 4L19 6"/>',
      alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.7 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/>',
      user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      phone:'<path d="M7 3h3l1 5-2 1a14 14 0 0 0 6 6l1-2 5 1v3c0 2-2 4-4 4A16 16 0 0 1 3 7c0-2 2-4 4-4Z"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'
    };
    return '<svg class="jp-suite-icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||'')+'</svg>';
  };

  function ensureAudio(){
    try{
      if(!audioContext){
        var Ctx=window.AudioContext||window.webkitAudioContext;
        if(Ctx)audioContext=new Ctx();
      }
      if(audioContext&&audioContext.state==='suspended')audioContext.resume().catch(function(){});
    }catch(_){}
  }
  function playTone(kind){
    ensureAudio();
    if(!audioContext)return;
    try{
      var now=audioContext.currentTime;
      var notes=kind==='error'
        ? [{f:260,t:0,d:.14},{f:190,t:.16,d:.22}]
        : [{f:523,t:0,d:.10},{f:659,t:.11,d:.10},{f:784,t:.22,d:.19}];
      notes.forEach(function(n){
        var osc=audioContext.createOscillator(),gain=audioContext.createGain();
        osc.type=kind==='error'?'sawtooth':'sine';osc.frequency.setValueAtTime(n.f,now+n.t);
        gain.gain.setValueAtTime(.0001,now+n.t);
        gain.gain.exponentialRampToValueAtTime(kind==='error'?.055:.04,now+n.t+.015);
        gain.gain.exponentialRampToValueAtTime(.0001,now+n.t+n.d);
        osc.connect(gain);gain.connect(audioContext.destination);
        osc.start(now+n.t);osc.stop(now+n.t+n.d+.03);
      });
    }catch(_){}
  }

  function activeViewNav(){
    var active=document.querySelector('.view.active');
    if(!active||active.id.indexOf('view-')!==0)return null;
    var view=active.id.replace(/^view-/,'');
    return document.querySelector('.nav-item[data-view="'+CSS.escape(view)+'"]');
  }
  function activateOrdersNav(){
    if(!previousNav)previousNav=document.querySelector('.nav-item.active');
    document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
    var orders=by('workspaceOrdersNav');if(orders)orders.classList.add('active');
  }
  function restoreNav(){
    document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
    var current=activeViewNav()||previousNav;
    if(current&&document.body.contains(current))current.classList.add('active');
    previousNav=null;
  }
  function closeModal(){
    try{stopCamera();}catch(_){}
    stopCamera=function(){};
    if(overlay)overlay.remove();
    overlay=null;
    restoreNav();
  }
  function openModal(title,subtitle,body,className){
    try{stopCamera();}catch(_){}
    stopCamera=function(){};
    if(overlay)overlay.remove();
    overlay=document.createElement('div');
    overlay.className='jp-suite-overlay';
    overlay.innerHTML='<section class="jp-suite-modal '+esc(className||'')+'" role="dialog" aria-modal="true">'+
      '<header class="jp-suite-head"><div><span class="jp-suite-brand">JUAN PROJECT</span><h2>'+esc(title)+'</h2>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div>'+
      '<button class="jp-suite-close" type="button" aria-label="Close">×</button></header>'+
      '<div id="jpSuiteError" class="jp-suite-error" hidden></div>'+
      '<div class="jp-suite-body">'+body+'</div></section>';
    document.body.appendChild(overlay);
    overlay.querySelector('.jp-suite-close').onclick=closeModal;
    overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal();});
    return overlay.querySelector('.jp-suite-modal');
  }
  function showError(message){
    var el=by('jpSuiteError');if(!el)return;
    el.hidden=false;el.textContent=message||'Something went wrong.';
  }
  function statusClass(status){
    return String(status||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  }

  async function openDrafts(){
    activateOrdersNav();
    try{
      var x=await runtime.request('/api/drafts');
      var drafts=Array.isArray(x.drafts)?x.drafts:[];
      var html='<div class="jp-suite-toolbar"><div><span class="jp-suite-kicker">WORKSPACE DRAFTS</span><strong>'+drafts.length+' saved draft'+(drafts.length===1?'':'s')+'</strong></div><button id="jpBackRequests" class="jp-btn">← Order Requests</button></div>';
      html+='<div class="jp-draft-list">'+(drafts.length?drafts.map(function(v){
        return '<article class="jp-draft-card"><div><strong>'+esc(v.title||'Untitled Draft')+'</strong><span>'+esc(v.project_name||'')+'</span></div><span class="jp-status neutral">Draft</span></article>';
      }).join(''):'<div class="jp-empty-state">No saved drafts yet.</div>')+'</div>';
      openModal('Drafts','Saved order drafts',html,'jp-orders-modal');
      by('jpBackRequests').onclick=openOrders;
    }catch(e){showError(e.message||String(e));}
  }

  async function openOrders(){
    activateOrdersNav();
    var modal=openModal('Order Requests','Review Online orders before they become projects.','<div class="jp-loading-block"><span class="jp-mini-spinner"></span>Loading requests…</div>','jp-orders-modal');
    try{
      var d=await api({action:'dashboard'});
      var requests=Array.isArray(d.incoming_orders)?d.incoming_orders:[];
      var pending=requests.filter(function(o){return ['Approved','Rejected'].indexOf(String(o.status||''))<0;}).length;
      var body='<div class="jp-suite-toolbar">'+
        '<div><span class="jp-suite-kicker">ONLINE INTAKE</span><strong>'+pending+' request'+(pending===1?'':'s')+' need attention</strong></div>'+
        '<div class="jp-toolbar-actions">'+
          '<button id="jpOrdersRefresh" class="jp-btn">'+icon('refresh')+'Refresh</button>'+
          '<button id="jpOrdersDrafts" class="jp-btn">'+icon('file')+'Drafts</button>'+
          '<button id="jpOrdersScan" class="jp-btn jp-btn-green">'+icon('qr')+'Scan QR</button>'+
        '</div></div>'+
        '<div class="jp-request-table-wrap"><table class="jp-request-table"><thead><tr><th>Request</th><th>Client</th><th>Current Total</th><th>Status</th><th aria-label="Actions"></th></tr></thead><tbody>'+
        (requests.length?requests.map(function(o){
          return '<tr data-review-id="'+esc(o.id)+'">'+
            '<td><strong>'+esc(o.code||'—')+'</strong><small>'+esc(o.title||'Untitled request')+'</small></td>'+
            '<td><strong>'+esc(o.name||'Client')+'</strong><small>'+esc(o.email||'')+'</small></td>'+
            '<td><b>'+money(o.total)+'</b></td>'+
            '<td><span class="jp-status '+statusClass(o.status)+'"><i></i>'+esc(o.status||'Order Received')+'</span></td>'+
            '<td><button class="jp-icon-button" data-review-button="'+esc(o.id)+'" aria-label="Review request">'+icon('more')+'</button></td>'+
          '</tr>';
        }).join(''):'<tr><td colspan="5"><div class="jp-empty-state">Order requests submitted through JUAN PROJECT Online will appear here.</div></td></tr>')+
        '</tbody></table></div>';
      modal.querySelector('.jp-suite-body').innerHTML=body;
      modal.querySelectorAll('[data-review-id]').forEach(function(row){
        row.addEventListener('click',function(e){if(e.target.closest('button'))return;reviewOrder(requests.find(function(o){return String(o.id)===String(row.dataset.reviewId);}));});
      });
      modal.querySelectorAll('[data-review-button]').forEach(function(button){
        button.onclick=function(){reviewOrder(requests.find(function(o){return String(o.id)===String(button.dataset.reviewButton);}));};
      });
      by('jpOrdersRefresh').onclick=openOrders;
      by('jpOrdersDrafts').onclick=openDrafts;
      by('jpOrdersScan').onclick=openScanner;
    }catch(e){
      showError(e.message||String(e));
      var b=modal.querySelector('.jp-suite-body');if(b)b.innerHTML='<div class="jp-empty-state">Order requests could not be loaded.</div>';
    }
  }

  async function reviewOrder(order){
    if(!order)return;
    activateOrdersNav();
    if(order.project_id){
      closeModal();
      if(window.app&&window.app.openProjectDetails)window.app.openProjectDetails(order.project_id);
      return;
    }
    var items=(Array.isArray(order.items)?order.items:[]).map(function(i){
      var copy=Object.assign({},i);
      copy.includedItems=Array.isArray(i.includedItems)?i.includedItems:[];
      return copy;
    });
    var clientBits=[
      ['user','Name',order.name||'Client'],
      ['mail','Email',order.email||'—'],
      ['phone','Phone',order.phone||'—'],
      ['calendar','Due',order.deadline||'Not specified']
    ];
    var html='<div class="jp-review-top">'+
      '<section class="jp-review-client"><div class="jp-review-section-head"><div><span class="jp-suite-kicker">CLIENT INFORMATION</span><h3>'+esc(order.name||'Client')+'</h3></div><span class="jp-status '+statusClass(order.status)+'">'+esc(order.status||'Order Received')+'</span></div>'+
      '<div class="jp-client-facts">'+clientBits.map(function(x){return '<div><span>'+icon(x[0])+esc(x[1])+'</span><b>'+esc(x[2])+'</b></div>';}).join('')+'</div></section>'+
      '<aside class="jp-review-summary"><span class="jp-suite-kicker">SUMMARY</span><div><span>Subtotal</span><b id="jpReviewSubtotal">—</b></div><div><span>Discount</span><b id="jpReviewDiscountView">—</b></div><div><span>Rush Fee</span><b id="jpReviewRushView">—</b></div><div class="final"><span>Final Amount</span><strong id="jpReviewTotal">—</strong></div></aside>'+
    '</div>'+
    '<section class="jp-review-items"><div class="jp-review-section-head"><div><span class="jp-suite-kicker">ORDER ITEMS</span><h3>'+esc(order.code||'Order Request')+'</h3></div><button id="jpReviewAdd" class="jp-btn">+ Add Custom Item</button></div>'+
      '<div class="jp-request-table-wrap"><table class="jp-review-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th><th></th></tr></thead><tbody id="jpReviewItems"></tbody></table></div></section>'+
    '<div class="jp-review-bottom">'+
      '<section><span class="jp-suite-kicker">ADDITIONAL CHARGES</span><div class="jp-charge-grid"><label>Discount<input id="jpReviewDiscount" type="number" min="0" step="0.01" value="'+Number(order.discount_amount||0)+'"></label><label>Rush Fee<input id="jpReviewRush" type="number" min="0" step="0.01" value="'+Number(order.rush_fee||0)+'"></label></div><button id="jpReviewAutoRush" class="jp-text-action">Recalculate rush fee from requested date</button></section>'+
      '<section><label class="jp-note-label">Review Note / Client Message<textarea id="jpReviewNote" placeholder="Add notes for the client or internal review…">'+esc(order.review_note||'')+'</textarea></label></section>'+
    '</div>'+
    '<footer class="jp-review-actions"><button id="jpReviewSave" class="jp-btn">'+icon('file')+'Save Review</button><button id="jpReviewOffer" class="jp-btn">Send Revised Offer</button><button id="jpReviewChanges" class="jp-btn jp-btn-warning">Needs Changes</button><button id="jpReviewReject" class="jp-btn jp-btn-danger">Reject</button><button id="jpReviewApprove" class="jp-btn jp-btn-green jp-approve">'+icon('check')+'Approve & Create Project</button></footer>';
    var modal=openModal('Review '+String(order.code||'Order Request'),'Check the details, edit if needed, then create the project.',html,'jp-review-modal');

    function collect(){
      return items.map(function(base,n){
        var name=modal.querySelector('[data-rname="'+n+'"]');
        var qty=modal.querySelector('[data-rqty="'+n+'"]');
        var price=modal.querySelector('[data-rprice="'+n+'"]');
        return Object.assign({},base,{
          name:String(name?name.value:(base.name||'Order Item')).trim(),
          qty:Math.max(1,Math.min(100,Math.trunc(Number(qty?qty.value:1)||1))),
          price:Math.max(0,Number(price?price.value:0)||0)
        });
      });
    }
    function recalc(){
      var current=collect();
      var subtotal=current.reduce(function(sum,i){return sum+i.qty*i.price;},0);
      var discount=Math.max(0,Number(by('jpReviewDiscount').value||0));
      var rush=Math.max(0,Number(by('jpReviewRush').value||0));
      var total=Math.max(0,subtotal+rush-discount);
      by('jpReviewSubtotal').textContent=money(subtotal);
      by('jpReviewDiscountView').textContent='- '+money(discount);
      by('jpReviewRushView').textContent=money(rush);
      by('jpReviewTotal').textContent=money(total);
      current.forEach(function(i,n){var cell=modal.querySelector('[data-ramount="'+n+'"]');if(cell)cell.textContent=money(i.qty*i.price);});
      return {items:current,discount_amount:discount,rush_fee:rush};
    }
    function draw(){
      var tbody=by('jpReviewItems');if(!tbody)return;
      tbody.innerHTML=items.map(function(i,n){
        return '<tr><td><input data-rname="'+n+'" value="'+esc(i.name||'Order Item')+'" maxlength="180"></td>'+
          '<td><input data-rqty="'+n+'" type="number" min="1" max="100" value="'+Math.max(1,Number(i.qty||1))+'"></td>'+
          '<td><input data-rprice="'+n+'" type="number" min="0" step="0.01" value="'+Number(i.price||0)+'"></td>'+
          '<td data-ramount="'+n+'" class="jp-money-cell"></td>'+
          '<td><button class="jp-remove-row" data-rremove="'+n+'" aria-label="Remove item">×</button></td></tr>';
      }).join('');
      modal.querySelectorAll('[data-rremove]').forEach(function(button){button.onclick=function(){items.splice(Number(button.dataset.rremove),1);draw();recalc();};});
      modal.querySelectorAll('[data-rname],[data-rqty],[data-rprice]').forEach(function(input){input.oninput=recalc;});
      recalc();
    }
    async function save(send){
      var payload=recalc();
      var note=by('jpReviewNote').value;
      var result=await api(Object.assign({action:'revise-order',id:order.id,note:note,send_to_client:send},payload));
      window.showToast&&window.showToast(send?'Revised offer sent to the client tracking page.':'Order request review saved.');
      reviewOrder(result.order);
    }

    draw();
    by('jpReviewDiscount').oninput=recalc;
    by('jpReviewRush').oninput=recalc;
    by('jpReviewAdd').onclick=function(){items.push({id:crypto.randomUUID(),name:'Custom Item',type:'service',price:0,qty:1,includedItems:[]});draw();};
    by('jpReviewAutoRush').onclick=function(){
      try{
        var d=order.deadline?new Date(order.deadline+'T00:00:00'):null;
        if(!d||Number.isNaN(d.getTime()))throw new Error('This request has no valid requested deadline.');
        var start=new Date();start.setHours(0,0,0,0);
        var days=Math.max(0,Math.round((d-start)/86400000));
        var standard=collect().some(function(i){return String(i.type).toLowerCase()==='package';})?14:10;
        by('jpReviewRush').value=String(Math.ceil(Math.max(0,standard-days)/4)*500);recalc();
      }catch(e){showError(e.message);}
    };
    by('jpReviewSave').onclick=function(){save(false).catch(function(e){showError(e.message);});};
    by('jpReviewOffer').onclick=function(){save(true).catch(function(e){showError(e.message);});};
    by('jpReviewChanges').onclick=async function(){
      try{
        var note=by('jpReviewNote').value;if(!note.trim())throw new Error('Add a review note first.');
        await api({action:'review-order',id:order.id,status:'Needs Changes',note:note});
        window.showToast&&window.showToast('Changes requested.');openOrders();
      }catch(e){showError(e.message);}
    };
    by('jpReviewReject').onclick=async function(){
      try{
        var note=by('jpReviewNote').value;if(!note.trim())throw new Error('Add a rejection reason in the review note first.');
        await api({action:'review-order',id:order.id,status:'Rejected',note:note});
        playTone('error');window.showToast&&window.showToast('Order request rejected.');openOrders();
      }catch(e){showError(e.message);}
    };
    by('jpReviewApprove').onclick=async function(){
      var button=by('jpReviewApprove');
      try{
        button.disabled=true;button.textContent='Creating Project…';
        var payload=recalc();
        await api(Object.assign({action:'revise-order',id:order.id,note:by('jpReviewNote').value,send_to_client:false},payload));
        var result=await api({action:'convert',id:order.id});
        await runtime.refresh();
        playTone('success');
        var p=result.project||{};
        openModal('Project Created','Order request approved successfully.',
          '<div class="jp-scan-success"><div class="jp-success-mark">'+icon('check')+'</div><span class="jp-suite-kicker">APPROVED</span><h3>'+esc(p.project_code||'Project Created')+'</h3><p>'+esc(order.title||'Order Request')+' is now an active JUAN PROJECT.</p><div class="jp-confirm-actions"><button id="jpApprovalBack" class="jp-btn">Back to Requests</button><button id="jpApprovalOpen" class="jp-btn jp-btn-green">Open Project</button></div></div>',
          'jp-confirm-modal');
        by('jpApprovalBack').onclick=openOrders;
        by('jpApprovalOpen').onclick=function(){closeModal();if(window.app&&window.app.openProjectDetails)window.app.openProjectDetails(p.id);};
      }catch(e){button.disabled=false;button.innerHTML=icon('check')+'Approve & Create Project';showError(e.message);}
    };
  }

  function detector(){
    return {detect:async function(source){
      var canvas=document.createElement('canvas');
      canvas.width=source.videoWidth||source.width;
      canvas.height=source.videoHeight||source.height;
      if(!canvas.width||!canvas.height)return [];
      var ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
      var pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
      var result=window.jsQR&&window.jsQR(pixels.data,pixels.width,pixels.height);
      return result?[{rawValue:result.data}]:[];
    }};
  }

  function processingScreen(){
    activateOrdersNav();
    var html='<div class="jp-processing-flow"><div class="jp-processing-qr">'+icon('qr')+'<span></span></div><h3>Processing…</h3><p>Reading QR code, please wait.</p>'+
      '<div class="jp-process-list"><div class="done">'+icon('check')+'<span>Detecting QR code…</span></div><div id="jpProcessMatch" class="active"><span class="jp-mini-spinner"></span><span>Matching data…</span></div><div id="jpProcessVerify"><i></i><span>Verifying information…</span></div><div id="jpProcessPrepare"><i></i><span>Preparing preview…</span></div></div></div>';
    openModal('Scanning QR Code','PROCESSING',html,'jp-processing-modal');
    setTimeout(function(){var a=by('jpProcessMatch'),b=by('jpProcessVerify');if(a){a.className='done';a.innerHTML=icon('check')+'<span>Matching data…</span>';}if(b){b.className='active';b.innerHTML='<span class="jp-mini-spinner"></span><span>Verifying information…</span>'; }},280);
    setTimeout(function(){var a=by('jpProcessVerify'),b=by('jpProcessPrepare');if(a){a.className='done';a.innerHTML=icon('check')+'<span>Verifying information…</span>';}if(b){b.className='active';b.innerHTML='<span class="jp-mini-spinner"></span><span>Preparing preview…</span>'; }},580);
  }

  async function processScan(value){
    var clean=String(value||'').trim();
    if(!clean){playTone('error');showError('Enter or scan a QR value first.');return;}
    try{stopCamera();}catch(_){}
    processingScreen();
    try{
      var pair=await Promise.all([api({action:'lookup',value:clean}),delay(900)]);
      playTone('success');
      showScanComplete(pair[0]);
    }catch(e){
      playTone('error');
      showScanFailure(e.message||'No matching client or order request was found.');
    }
  }

  function showScanComplete(result){
    var record=result.record||{};
    var isOrder=result.kind==='order';
    var code=isOrder?(record.code||'Order Request'):(record.client_code||'Client');
    var title=isOrder?(record.title||'Order Request'):(record.name||'Client');
    var status=isOrder?(record.status||'Order Received'):(record.classification||'Client');
    var rows=isOrder
      ? [['Client',record.name||'—'],['Email',record.email||'—'],['Project',record.title||'—'],['Estimated',money(record.total||0)]]
      : [['Client',record.name||'—'],['Email',record.email||'—'],['Client ID',record.client_code||'—'],['Status',record.classification||'Active']];
    var html='<div class="jp-scan-success"><div class="jp-success-mark">'+icon('check')+'</div><span class="jp-suite-kicker">JUAN PROJECT</span><h3>QR Scanned Successfully!</h3><p>'+esc(isOrder?'Order Request found.':'Client profile found.')+'</p>'+
      '<section class="jp-scan-result-card"><div class="jp-scan-result-top"><div><span>'+esc(isOrder?'ORDER REQUEST':'CLIENT RECORD')+'</span><strong>'+esc(code)+'</strong></div><span class="jp-status '+statusClass(status)+'">'+esc(status)+'</span></div>'+
      '<div class="jp-scan-result-details">'+rows.map(function(row){return '<div><span>'+esc(row[0])+'</span><b>'+esc(row[1])+'</b></div>';}).join('')+'</div></section>'+
      '<div class="jp-confirm-actions"><button id="jpScanAgain" class="jp-btn">'+icon('qr')+'Scan Another</button><button id="jpScanOpen" class="jp-btn jp-btn-green">'+(isOrder?'Open Request':'Open Client')+'</button></div></div>';
    openModal('Scan Complete','CONFIRMED',html,'jp-confirm-modal');
    by('jpScanAgain').onclick=openScanner;
    by('jpScanOpen').onclick=async function(){
      if(isOrder){
        try{
          var d=await api({action:'dashboard'});
          var order=(d.incoming_orders||[]).find(function(o){return String(o.id)===String(record.id);});
          if(!order)throw new Error('The order request could not be loaded.');
          reviewOrder(order);
        }catch(e){showError(e.message);}
      }else{
        closeModal();
        if(window.app&&window.app.openClientProfile)window.app.openClientProfile(record.id);
      }
    };
  }

  function showScanFailure(message){
    var html='<div class="jp-scan-failure"><div class="jp-error-mark">'+icon('alert')+'</div><span class="jp-suite-kicker">SCAN REJECTED</span><h3>QR could not be verified</h3><p>'+esc(message)+'</p><div class="jp-confirm-actions"><button id="jpScanRetry" class="jp-btn jp-btn-green">Try Again</button><button id="jpScanClose" class="jp-btn">Close</button></div></div>';
    openModal('Scan Failed','NOT VERIFIED',html,'jp-confirm-modal');
    by('jpScanRetry').onclick=openScanner;
    by('jpScanClose').onclick=closeModal;
  }

  async function startCamera(){
    ensureAudio();
    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('Camera access is not supported in this browser.');
      var stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      var video=by('jpScanVideo'),idle=by('jpCameraIdle'),start=by('jpCameraStart'),stop=by('jpCameraStop');
      video.srcObject=stream;video.hidden=false;if(idle)idle.hidden=true;await video.play();
      if(start){start.classList.add('active');start.innerHTML=icon('camera')+'Camera Active';}
      if(stop)stop.disabled=false;
      var busy=false,reader=detector();
      var timer=setInterval(async function(){
        if(busy||!video||video.readyState<2)return;busy=true;
        try{
          var codes=await reader.detect(video);
          if(codes[0]){stopCamera();await processScan(codes[0].rawValue);}
        }catch(_){}
        finally{busy=false;}
      },320);
      stopCamera=function(){
        clearInterval(timer);
        try{stream.getTracks().forEach(function(t){t.stop();});}catch(_){}
        if(video){video.pause();video.srcObject=null;video.hidden=true;}
        if(idle)idle.hidden=false;
        if(start){start.classList.remove('active');start.innerHTML=icon('camera')+'Start Camera';}
        if(stop)stop.disabled=true;
      };
    }catch(e){playTone('error');showError(e.message||String(e));}
  }

  function openScanner(){
    activateOrdersNav();ensureAudio();
    var html='<div class="jp-scanner-layout">'+
      '<section class="jp-camera-stage"><video id="jpScanVideo" playsinline muted hidden></video><div id="jpCameraIdle" class="jp-camera-idle">'+icon('qr')+'<strong>Ready to scan</strong><span>Start the camera and place the QR code inside the frame.</span></div><div class="jp-scan-frame"><i></i><i></i><i></i><i></i><span></span></div><div class="jp-camera-status"><b></b>Looking for QR codes…</div></section>'+
      '<aside class="jp-scanner-controls"><div class="jp-camera-buttons"><button id="jpCameraStart" class="jp-btn jp-btn-green">'+icon('camera')+'Start Camera</button><button id="jpCameraStop" class="jp-btn" disabled>'+icon('stop')+'Stop Camera</button></div>'+
        '<section class="jp-scanner-option"><div class="jp-option-icon">'+icon('link')+'</div><div><strong>Enter ID Manually</strong><span>Type a Client ID, Order ID, or tracking link.</span><div class="jp-inline-field"><input id="jpScanValue" placeholder="CL-001, OR-001, or tracking link"><button id="jpScanFind" aria-label="Open record">→</button></div></div></section>'+
        '<section class="jp-scanner-option"><div class="jp-option-icon">'+icon('upload')+'</div><div><strong>Upload QR Image</strong><span>Select an image from your device.</span><label class="jp-upload-zone">'+icon('file')+'<b>Choose Image</b><small>PNG, JPG or WEBP</small><input id="jpScanImage" type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div></section>'+
        '<div class="jp-scanner-support">ⓘ Supports Client Cards · Order Requests · Tracking QR</div>'+
      '</aside></div>';
    openModal('QR Scanner','Scan a client card or order request to quickly open a record.',html,'jp-scanner-modal');
    by('jpCameraStart').onclick=startCamera;
    by('jpCameraStop').onclick=function(){stopCamera();};
    by('jpScanFind').onclick=function(){processScan(by('jpScanValue').value);};
    by('jpScanValue').addEventListener('keydown',function(e){if(e.key==='Enter')processScan(by('jpScanValue').value);});
    by('jpScanImage').onchange=async function(e){
      var file=e.target.files&&e.target.files[0];if(!file)return;
      try{
        var bitmap=await createImageBitmap(file),codes;
        try{codes=await detector().detect(bitmap);}finally{bitmap.close();}
        if(!codes.length)throw new Error('No QR code was detected. Try a clearer image.');
        await processScan(codes[0].rawValue);
      }catch(err){playTone('error');showScanFailure(err.message||String(err));}
    };
  }

  function wire(){
    if(window.JuanSuite){
      window.JuanSuite.orderRequests=openOrders;
      window.JuanSuite.incoming=openOrders;
      window.JuanSuite.scanner=openScanner;
    }
    window.jpOpenOrders=function(){
      window.jpToggleQuickActions&&window.jpToggleQuickActions(false);
      if(window.app?.navigateTo)return window.app.navigateTo('orders');
      openOrders();
    };
    window.jpOpenQrScanner=function(){window.jpToggleQuickActions&&window.jpToggleQuickActions(false);openScanner();};

    var orders=by('workspaceOrdersNav');
    if(orders)orders.onclick=null;
    var scanBtn=by('workspaceNewOrderQrScanner');
    if(scanBtn)scanBtn.onclick=openScanner;
  }

  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay)closeModal();});
  document.addEventListener('DOMContentLoaded',function(){setTimeout(wire,220);});
  setTimeout(wire,0);
  setTimeout(wire,700);
})();