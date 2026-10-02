/* JUAN PROJECT Workspace — centralized keyboard navigation */
(function(){
  "use strict";
  var isMac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent),prefix=isMac?"⌘":"Ctrl";
  var palette=null,hud=null,sequence=null,sequenceTimer=null,lastFocus=null,commands=[],selected=0,tableRow=null,paletteRequest=0;
  var inputTags=["INPUT","TEXTAREA","SELECT"];
  function typingTarget(t){return !!t&&(inputTags.indexOf(t.tagName)>=0||t.isContentEditable);}
  function toast(m){if(window.showToast)window.showToast(m);}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function icon(name){var p={overview:"⌂",projects:"▣",clients:"◉",payments:"▤",reports:"▥",calendar:"□",shop:"◇",portal:"▧",orders:"▦",scanner:"⌗",settings:"⚙",create:"+",search:"⌕",refresh:"↻"};return p[name]||"•";}
  function nav(view){window.app&&window.app.navigateTo(view);}
  function openScanner(){if(window.jpOpenQrScanner)window.jpOpenQrScanner();toast("QR Scanner opened");}
  function openOrders(){nav("orders");}
  function newOrder(){nav("new-order");}
  function newClient(){nav("new-order");setTimeout(function(){window.app&&window.app.setClientMode("new");},30);}
  function newProject(){newOrder();}
  function staticCommands(){
    return [
      {group:"Navigation",name:"Overview",shortcut:"G O",icon:"overview",run:function(){nav("my-works");}},
      {group:"Navigation",name:"Projects",shortcut:"G P",icon:"projects",run:function(){nav("projects");}},
      {group:"Navigation",name:"Clients",shortcut:"G C",icon:"clients",run:function(){nav("clients");}},
      {group:"Navigation",name:"Invoices & Payments",shortcut:"G I",icon:"payments",run:function(){nav("payments");}},
      {group:"Navigation",name:"Reports",shortcut:"G R",icon:"reports",run:function(){nav("reports");}},
      {group:"Navigation",name:"Calendar",shortcut:"G A",icon:"calendar",run:function(){nav("calendar");}},
      {group:"Navigation",name:"Shop",shortcut:"G S",icon:"shop",run:function(){nav("pricelist");}},
      {group:"Navigation",name:"Online Portal",shortcut:"G L",icon:"portal",run:function(){nav("online-portal");}},
      {group:"Navigation",name:"Orders",shortcut:"G Q",icon:"orders",run:openOrders},
      {group:"Navigation",name:"QR Scanner",shortcut:"G X",icon:"scanner",run:openScanner},
      {group:"Navigation",name:"Settings",shortcut:"G T",icon:"settings",run:function(){nav("settings");}},
      {group:"Create",name:"New Order",shortcut:"N O",icon:"create",run:newOrder},
      {group:"Create",name:"New Client",shortcut:"N C",icon:"create",run:newClient},
      {group:"Create",name:"New Project",shortcut:"N P",icon:"create",run:newProject},
      {group:"Utilities",name:"Refresh Data",shortcut:"",icon:"refresh",run:async function(){try{await window.app.refreshSharedTest();toast("Data refreshed");}catch(e){toast(e.message||"Refresh failed");}}},
      {group:"Utilities",name:"Search Clients",shortcut:"",icon:"search",run:function(){nav("clients");setTimeout(function(){document.getElementById("clientsSearch")?.focus();},30);}},
      {group:"Utilities",name:"Search Projects",shortcut:"",icon:"search",run:function(){nav("projects");setTimeout(function(){document.getElementById("projectsSearch")?.focus();},30);}}
    ];
  }
  async function recordCommands(){
    var out=[],st=window.app?.getWorkspaceState?.();
    if(st){
      (st.clients||[]).filter(function(c){return !c.archived_at;}).slice(0,250).forEach(function(c){out.push({group:"Clients",name:(c.client_code||"Client")+" · "+(c.name||c.email||"Client"),meta:c.email||"",icon:"clients",run:function(){toast("Opening "+(c.client_code||"client"));window.app.openClientProfile(c.id);}});});
      (st.projects||[]).filter(function(p){return !p.deleted;}).slice(0,250).forEach(function(p){out.push({group:"Projects",name:(p.project_code||"Project")+" · "+(p.title||"Untitled"),meta:p.client_name||p.client_email||"",icon:"projects",run:function(){window.app.openProjectDetails(p.id);}});});
    }
    try{
      var d=await window.JuanSuiteRuntime.request("/api/suite",{action:"dashboard"});
      (d.incoming_orders||[]).filter(function(o){return !o.archived_at;}).slice(0,150).forEach(function(o){out.push({group:"Order Requests",name:(o.code||"Order")+" · "+(o.title||"Request"),meta:(o.name||"")+" "+(o.email||""),icon:"orders",run:function(){nav("orders");setTimeout(function(){window.JPGeneral?.openOrder(o.id);},120);}});});
      (d.payment_submissions||[]).slice(0,80).forEach(function(p){out.push({group:"Payments",name:"Payment · "+(p.reference_number||p.id||"Submission"),meta:p.status||"",icon:"payments",run:function(){nav("online-portal");setTimeout(function(){window.app.setOnlinePortalTab("payments");},80);}});});
    }catch(_){}
    return out;
  }
  function closePalette(){
    paletteRequest++;document.querySelectorAll(".jp-command-overlay").forEach(function(layer){layer.remove();});palette=null;commands=[];selected=0;
    if(lastFocus&&document.contains(lastFocus))lastFocus.focus();lastFocus=null;
  }
  function trapFocus(e){
    if(!palette||e.key!=="Tab")return;var f=Array.from(palette.querySelectorAll("input,button,[tabindex]:not([tabindex='-1'])")).filter(function(x){return !x.disabled;});if(!f.length)return;
    var first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
  function filtered(){
    if(!palette)return [];var q=(palette.querySelector("#jpCommandInput").value||"").trim().toLowerCase();
    return commands.filter(function(c){return !q||(c.name+" "+(c.meta||"")+" "+c.group).toLowerCase().indexOf(q)>=0;});
  }
  function drawPalette(){
    if(!palette)return;var rows=filtered(),host=palette.querySelector("#jpCommandRows");if(selected>=rows.length)selected=Math.max(0,rows.length-1);
    var lastGroup="";
    host.innerHTML=rows.map(function(c,i){var heading=c.group!==lastGroup?'<div class="jp-command-group">'+esc(c.group)+"</div>":"";lastGroup=c.group;return heading+'<button class="jp-command-row '+(i===selected?"selected":"")+'" data-command-index="'+i+'"><span class="jp-command-icon">'+esc(icon(c.icon))+'</span><span class="jp-command-copy"><strong>'+esc(c.name)+'</strong>'+(c.meta?'<small>'+esc(c.meta)+"</small>":"")+'</span>'+(c.shortcut?'<kbd>'+esc(c.shortcut)+"</kbd>":"")+"</button>";}).join("")||'<div class="jp-command-empty">No matching commands or records.</div>';
    host.querySelectorAll("[data-command-index]").forEach(function(b){b.onmouseenter=function(){selected=Number(b.dataset.commandIndex);drawPalette();};b.onclick=function(){runSelected();};});
    var active=host.querySelector(".selected");if(active)active.scrollIntoView({block:"nearest"});
  }
  function runSelected(){
    var rows=filtered(),c=rows[selected];if(!c)return;
    Promise.resolve().then(function(){return c.run();}).then(function(){closePalette();}).catch(function(e){toast(e.message||"Command failed");drawPalette();});
  }
  async function openPalette(initial){
    closeHud();closePalette();var request=++paletteRequest;lastFocus=document.activeElement;var dynamicCommands=await recordCommands();if(request!==paletteRequest)return;commands=staticCommands().concat(dynamicCommands);selected=0;
    palette=document.createElement("div");palette.className="jp-command-overlay";palette.innerHTML='<section class="jp-command-palette" role="dialog" aria-modal="false" aria-label="Command Palette"><div class="jp-command-search"><span>⌕</span><input id="jpCommandInput" autocomplete="off" placeholder="Search commands, clients, projects..." aria-label="Search commands"><button type="button" id="jpCommandClose" class="jp-command-close" aria-label="Close command center">×</button></div><div id="jpCommandRows" class="jp-command-rows"></div><footer><span>↑↓ Navigate</span><span>Enter Open</span><span>Esc Close</span></footer></section>';
    document.body.appendChild(palette);palette.querySelector("#jpCommandClose").onclick=closePalette;var input=palette.querySelector("#jpCommandInput");input.value=initial||"";input.oninput=function(){selected=0;drawPalette();};input.onkeydown=function(e){if(e.key==="ArrowDown"){e.preventDefault();selected=Math.min(selected+1,filtered().length-1);drawPalette();}else if(e.key==="ArrowUp"){e.preventDefault();selected=Math.max(0,selected-1);drawPalette();}else if(e.key==="Enter"){e.preventDefault();runSelected();}else if(e.key==="Escape"){e.preventDefault();closePalette();}};drawPalette();requestAnimationFrame(function(){input.focus();input.select();});
  }
  function closeHud(){if(hud)hud.remove();hud=null;if(sequenceTimer)clearTimeout(sequenceTimer);sequenceTimer=null;sequence=null;}
  function showHud(kind){
    closeHud();sequence=kind;hud=document.createElement("div");hud.className="jp-shortcut-hud";
    if(kind==="g")hud.innerHTML='<strong>Go to…</strong><div><kbd>O</kbd> Overview <kbd>P</kbd> Projects <kbd>C</kbd> Clients <kbd>I</kbd> Invoices <kbd>R</kbd> Reports <kbd>A</kbd> Calendar <kbd>S</kbd> Shop <kbd>L</kbd> Portal <kbd>Q</kbd> Orders <kbd>X</kbd> QR <kbd>T</kbd> Settings</div>';
    else hud.innerHTML='<strong>Create…</strong><div><kbd>O</kbd> Order <kbd>C</kbd> Client <kbd>P</kbd> Project</div>';
    document.body.appendChild(hud);sequenceTimer=setTimeout(closeHud,1500);
  }
  function runSequence(key){
    var k=key.toLowerCase(),map=sequence==="g"?{o:function(){nav("my-works");},p:function(){nav("projects");},c:function(){nav("clients");},i:function(){nav("payments");},r:function(){nav("reports");},a:function(){nav("calendar");},s:function(){nav("pricelist");},l:function(){nav("online-portal");},q:openOrders,x:openScanner,t:function(){nav("settings");}}:{o:newOrder,c:newClient,p:newProject};var fn=map[k];closeHud();if(fn){fn();return true;}return false;
  }
  function openHelp(){
    closePalette();lastFocus=document.activeElement;palette=document.createElement("div");palette.className="jp-command-overlay";palette.innerHTML='<section class="jp-shortcut-help" role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts"><header><div><span>JUAN PROJECT</span><h2>Keyboard Shortcuts</h2></div><button id="jpHelpClose" aria-label="Close">×</button></header><div class="jp-help-grid"><section><h3>Navigation</h3><p><kbd>G O</kbd> Overview</p><p><kbd>G P</kbd> Projects</p><p><kbd>G C</kbd> Clients</p><p><kbd>G I</kbd> Invoices</p><p><kbd>G R</kbd> Reports</p><p><kbd>G A</kbd> Calendar</p><p><kbd>G Q</kbd> Orders</p><p><kbd>G X</kbd> QR Scanner</p></section><section><h3>Create</h3><p><kbd>N O</kbd> New Order</p><p><kbd>N C</kbd> New Client</p><p><kbd>N P</kbd> New Project</p><h3>General</h3><p><kbd>'+prefix+' K</kbd> Command Palette</p><p><kbd>/</kbd> Search</p><p><kbd>'+prefix+' S</kbd> Save</p><p><kbd>Esc</kbd> Close / Back</p><p><kbd>↑ ↓</kbd> Navigate table</p><p><kbd>Shift Enter</kbd> Actions</p></section></div></section>';document.body.appendChild(palette);palette.querySelector("#jpHelpClose").onclick=closePalette;palette.onclick=function(e){if(e.target===palette)closePalette();};palette.querySelector("#jpHelpClose").focus();
  }
  function contextualSave(){
    var candidates=["#inlineClientSave","#orderSaveEdits","#saveDraftBtn","#portalSavePaymentSettings","#saveProjectDataBtn",".modal.show .btn-primary[data-save]"];
    for(var i=0;i<candidates.length;i++){var b=document.querySelector(candidates[i]);if(b&&b.offsetParent!==null&&!b.disabled){b.click();return true;}}
    toast("No editable form is active.");return false;
  }
  function topOverlayClose(){
    var pop=document.querySelector(".popover-wrap.open");if(pop){pop.classList.remove("open");return true;}
    if(window.JPGeneral&&document.querySelector(".jp-general-overlay")){window.JPGeneral.closeOverlay();return true;}
    if(document.querySelector(".jp-suite-overlay")){var x=document.querySelector(".jp-suite-close");if(x)x.click();return true;}
    var modal=document.querySelector(".modal.show");if(modal){var close=modal.querySelector("[data-close],.modal-close,.close");if(close)close.click();return true;}
    return false;
  }
  function activeTableRows(){
    var view=document.querySelector(".view.active");if(!view)return [];var table=view.querySelector("table.data-table, table.unified-table");if(!table)return [];return Array.from(table.querySelectorAll("tbody tr")).filter(function(r){return r.querySelector("td")&&!r.querySelector("td[colspan]");});
  }
  function tableNav(key,shift){
    var rows=activeTableRows();if(!rows.length)return false;var idx=tableRow&&rows.indexOf(tableRow)>=0?rows.indexOf(tableRow):-1;
    if(key==="ArrowDown")idx=Math.min(rows.length-1,idx+1);else if(key==="ArrowUp")idx=Math.max(0,idx<0?0:idx-1);else if((key==="Enter"||key==="Escape")&&idx<0)return false;
    else if(key!=="Enter"&&key!=="Escape")return false;
    if(key==="Escape"){tableRow.classList.remove("jp-kb-selected");tableRow=null;return true;}
    if(key==="Enter"){
      if(shift){var more=tableRow.querySelector(".vertical-more,.icon-more-button");if(more)more.click();}
      else tableRow.click();
      return true;
    }
    if(tableRow)tableRow.classList.remove("jp-kb-selected");tableRow=rows[idx];tableRow.classList.add("jp-kb-selected");tableRow.scrollIntoView({block:"nearest"});return true;
  }
  function scannerContext(e){
    if(!document.querySelector(".jp-scanner-modal,.suite-overlay video"))return false;
    if(e.key==="Escape"){e.preventDefault();topOverlayClose();return true;}
    if(e.key.toLowerCase()==="r"&&!typingTarget(e.target)){var r=document.getElementById("jpScanAgain")||document.getElementById("jpCameraStart");if(r){e.preventDefault();r.click();return true;}}
    if(e.key==="Enter"&&!typingTarget(e.target)){var b=document.getElementById("jpScanOpen")||document.getElementById("jpScanFind");if(b){e.preventDefault();b.click();return true;}}
    return false;
  }
  document.addEventListener("keydown",function(e){
    var mod=isMac?e.metaKey:e.ctrlKey;
    if(mod&&e.key.toLowerCase()==="k"){e.preventDefault();openPalette();return;}
    if(mod&&e.key.toLowerCase()==="s"){e.preventDefault();contextualSave();return;}
    if(palette){if(e.key==="Escape"){e.preventDefault();closePalette();return;}trapFocus(e);return;}
    if(scannerContext(e))return;
    if(e.key==="Escape"){
      if(topOverlayClose()){e.preventDefault();return;}
      if(tableRow){tableRow.classList.remove("jp-kb-selected");tableRow=null;e.preventDefault();return;}
    }
    var typing=typingTarget(e.target);if(typing)return;
    if(sequence){e.preventDefault();runSequence(e.key);return;}
    if(e.key.toLowerCase()==="g"){e.preventDefault();showHud("g");return;}
    if(e.key.toLowerCase()==="n"){e.preventDefault();showHud("n");return;}
    if(e.key==="/"){e.preventDefault();openPalette("");return;}
    if(e.key==="?"){e.preventDefault();openHelp();return;}
    if(["ArrowDown","ArrowUp","Enter","Escape"].indexOf(e.key)>=0&&tableNav(e.key,e.shiftKey)){e.preventDefault();}
  },true);
  document.addEventListener("click",function(e){if(!e.target.closest("table")){if(tableRow){tableRow.classList.remove("jp-kb-selected");tableRow=null;}}});
  function removeVisibleCommandHelpers(){
    document.querySelectorAll('#jpCommandHelper,.jp-command-helper,[data-command-helper]').forEach(function(node){node.remove();});
    document.querySelectorAll('button').forEach(function(node){
      if(node.closest('.jp-command-overlay'))return;
      var label=String(node.textContent||'').replace(/\s+/g,' ').trim();
      if(label==='Commands'||(/Commands/i.test(label)&&(/[⌘Ctrl]/.test(label)||/\bK\b/.test(label))))node.remove();
    });
  }
  function install(){
    removeVisibleCommandHelpers();
    document.addEventListener('click',function(e){
      if(e.target.closest('.nav-item,[data-settings-tab]'))requestAnimationFrame(removeVisibleCommandHelpers);
    },true);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
  window.JPKeyboard={openPalette:openPalette,openHelp:openHelp};
})();
