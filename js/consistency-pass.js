/* JUAN PROJECT Workspace — consistency & reliability pass */
(function(){
  "use strict";
  const SETTINGS_KEY="JUAN_WORKSPACE_SETTINGS_V2";
  const SETTINGS_TAB_KEY="JUAN_WORKSPACE_SETTINGS_TAB_V1";
  const SETTINGS_SEGMENTS=["profile","workspace","database","appearance","notifications","data","security","about","danger"];
  const FORM_DRAFT_KEY="JUAN_WORKSPACE_DRAFTS_V2";
  let settingsBuilt=false, settingsDirty=false, saveTimers=new Map();

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast=m=>window.showToast?window.showToast(m):void 0;
  const appReady=()=>window.app&&window.app.getWorkspaceState&&window.app.getDatabaseClient;
  function later(fn,n=0){if(appReady())return fn();if(n<80)setTimeout(()=>later(fn,n+1),75);}

  function cleanRootText(){
    // Only remove truly empty/whitespace body text nodes. Literal escaped text must
    // be fixed at its source instead of being rewritten broadly at runtime.
    Array.from(document.body.childNodes).forEach(node=>{
      if(node.nodeType===Node.TEXT_NODE&&!String(node.textContent||"").trim())node.remove();
    });
  }

  function stored(){
    try{return {...defaults(),...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")};}catch(_){return defaults();}
  }
  function defaults(){
    return {
      workspaceName:"JUAN PROJECT Workspace",businessName:"JUAN PROJECT",timezone:"Asia/Manila",currency:"PHP",dateFormat:"MMM D, YYYY",
      showBusinessContact:true,includeBranding:true,autoReference:true,reconnectAutomatically:true,showConnectionSidebar:true,notifySyncFailure:true,
      accent:"mint",theme:"system",density:"comfortable",sidebarSize:"standard",rowHeight:"comfortable",reduceMotion:false,
      notifNewOrder:true,notifPaymentSubmitted:true,notifPaymentApproved:true,notifPaymentRejected:false,notifDeadline:true,notifOverdue:true,notifDeliverableCompleted:true,notifClientMessage:true,notifSyncFail:true,
      browserNotifications:false,notificationSounds:true,deadlineReminderDays:3,autoLock:true,autoLockMinutes:30,
      verifyReset:true,verifyDisconnect:true
    };
  }
  function savePrefs(patch){
    const next={...stored(),...patch};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));applyInterfacePrefs(next);setSettingsStatus("Saved");return next;
  }
  function applyInterfacePrefs(p=stored()){
    document.documentElement.dataset.jpDensity=p.density||"comfortable";
    document.documentElement.dataset.jpSidebarSize=p.sidebarSize||"standard";
    document.documentElement.dataset.jpRowHeight=p.rowHeight||"comfortable";
    document.documentElement.dataset.jpAccent=p.accent||"mint";
    document.documentElement.classList.toggle("jp-reduce-motion",!!p.reduceMotion);
  }
  function setSettingsStatus(text){
    const el=$("#jpSettingsSaveState");if(!el)return;
    el.textContent=text;el.classList.add("visible");
    clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("visible"),text==="Saving…"?4000:1300);
  }

  function toggleRow(label,key,value,help=""){
    return '<label class="jp-settings-toggle-row"><span><b>'+esc(label)+'</b>'+(help?'<small>'+esc(help)+'</small>':'')+'</span><input type="checkbox" class="jp-setting-toggle jp-setting-local" data-key="'+esc(key)+'" '+(value?'checked':'')+'><i></i></label>';
  }
  function field(label,id,value,type="text",attrs=""){
    return '<label class="jp-settings-field"><span>'+esc(label)+'</span><input id="'+id+'" class="form-control jp-settings-control" type="'+type+'" value="'+esc(value||"")+'" '+attrs+'></label>';
  }
  function section(id,title,description,content,danger=false){
    return '<section id="settings-'+id+'" class="jp-settings-segment '+(danger?"danger":"")+'" data-segment="'+id+'"><header class="jp-settings-segment-head"><h2>'+esc(title)+'</h2><p>'+esc(description||"")+'</p></header>'+content+'</section>';
  }
  function settingsNavIcon(id){
    const map={profile:'user',workspace:'building',database:'database',appearance:'appearance',notifications:'bell',data:'file',security:'shieldCheck',about:'info',danger:'trash'};
    const icon=window.JuanWorkspaceIcon?window.JuanWorkspaceIcon(map[id]||'info'):'';
    return '<span class="jp-settings-nav-icon" aria-hidden="true">'+icon+'</span>';
  }
  function setSettingsDirty(dirty=true){
    settingsDirty=!!dirty;
    const state=$("#jpSettingsDirtyState"),save=$("#jpSettingsSave"),discard=$("#jpSettingsDiscard");
    if(state)state.textContent=settingsDirty?"Unsaved changes":"No unsaved changes";
    if(save)save.disabled=!settingsDirty;
    if(discard)discard.disabled=!settingsDirty;
  }
  function editableSettingsSegment(id){
    return ["profile","workspace","database","appearance","notifications","security"].includes(id);
  }


  function buildSettings(){
    const view=$("#view-settings");if(!view)return;
    const st=window.app.getWorkspaceState(),p=stored();
    const ownerName=st.ownerName||localStorage.getItem("JUAN_OWNER_NAME")||"BENZEL DELMO";
    const ownerEmail=st.ownerEmail||localStorage.getItem("JUAN_OWNER_EMAIL")||"";
    const ownerPhone=st.ownerPhone||localStorage.getItem("JUAN_OWNER_PHONE")||"";
    const ownerAddress=st.ownerAddress||localStorage.getItem("JUAN_OWNER_ADDRESS")||"";
    const connected=!!st.isConnected;
    const initials=ownerName.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"BD";
    const avatar=st.profilePhoto?'<img src="'+esc(st.profilePhoto)+'" alt="'+esc(ownerName)+' profile photo">':esc(initials);
    const browserPermission=("Notification" in window)?Notification.permission:"unsupported";
    const lastSync=st.lastSuccessfulSync||st.lastSyncAt||st.lastSyncedAt||null;
    const lastSyncText=lastSync?new Date(lastSync).toLocaleString("en-PH"):"Not recorded";
    const currentDevice=(navigator.userAgentData?.platform||navigator.platform||"Current device")+" · "+(/Chrome/i.test(navigator.userAgent)?"Chrome":/Safari/i.test(navigator.userAgent)?"Safari":/Firefox/i.test(navigator.userAgent)?"Firefox":"Browser");
    const themeChoice=p.theme||"system";

    const profile=section("profile","Profile","Manage the identity and contact details used across Workspace.",
      '<div class="jp-ref-photo-row"><div><h3>Profile photo</h3><div class="jp-ref-photo-person"><div id="jpSettingsAvatar" class="jp-settings-avatar">'+avatar+'</div><div><b>'+esc(ownerName)+'</b><span>Workspace Owner</span><small>JPG, PNG, or WEBP up to 5 MB.</small></div></div></div><div class="jp-inline-actions"><button class="btn btn-secondary" id="jpChangePhoto">Change photo</button><button class="btn btn-danger" id="jpRemovePhoto">Remove</button></div></div>'+
      '<div class="jp-ref-card"><h3>Personal information</h3><div class="jp-settings-grid-2">'+
        field("Account owner name","jpOwnerName",ownerName)+field("Email address","jpOwnerEmail",ownerEmail,"email")+
        field("Phone number","jpOwnerPhone",ownerPhone,"tel",'inputmode="tel" autocomplete="tel" placeholder="09XX XXX XXXX" oninput="app.maskPhoneField(this)"')+
        '<label class="jp-settings-field"><span>Role</span><input class="form-control" value="Workspace Owner" readonly aria-readonly="true"></label>'+
        '<label class="jp-settings-field wide"><span>Billing address</span><textarea id="jpOwnerAddress" class="form-control jp-settings-control" rows="2">'+esc(ownerAddress)+'</textarea></label>'+
      '</div></div>'+
      '<div class="jp-ref-card"><h3>Workspace identity</h3><div class="jp-settings-grid-3">'+
        '<label class="jp-settings-field"><span>Workspace name</span><input class="form-control jp-setting-local" data-key="workspaceName" value="'+esc(p.workspaceName)+'"></label>'+
        '<label class="jp-settings-field"><span>Display name</span><input class="form-control jp-setting-local" data-key="businessName" value="'+esc(p.businessName)+'"></label>'+
        '<label class="jp-settings-field"><span>Time zone</span><select class="form-control jp-setting-local" data-key="timezone"><option value="Asia/Manila">Asia/Manila (GMT+8)</option></select></label>'+
      '</div></div>');

    const workspace=section("workspace","Workspace","Configure the business identity and defaults used throughout JUAN PROJECT Workspace.",
      '<div class="jp-ref-card"><h3>Business identity</h3><div class="jp-settings-grid-2">'+
        field("Workspace name","jpWorkspaceName",p.workspaceName)+field("Business name","jpBusinessName",p.businessName)+
        '<label class="jp-settings-field"><span>Owner</span><input class="form-control" value="'+esc(ownerName)+'" readonly aria-readonly="true"></label>'+
        field("Business email","jpBusinessEmail",ownerEmail,"email")+
        field("Business phone","jpBusinessPhone",ownerPhone,"tel",'inputmode="tel" autocomplete="tel" placeholder="09XX XXX XXXX"')+
        '<label class="jp-settings-field"><span>Business address</span><textarea id="jpBusinessAddress" class="form-control jp-settings-control" rows="2">'+esc(ownerAddress)+'</textarea></label>'+
      '</div></div>'+
      '<div class="jp-ref-card"><h3>Regional defaults</h3><div class="jp-settings-grid-3">'+
        '<label class="jp-settings-field"><span>Time zone</span><select class="form-control jp-setting-local" data-key="timezone"><option value="Asia/Manila">Asia/Manila (GMT+8)</option></select></label>'+
        '<label class="jp-settings-field"><span>Currency</span><select class="form-control jp-setting-local" data-key="currency"><option value="PHP">Philippine Peso (PHP ₱)</option></select></label>'+
        '<label class="jp-settings-field"><span>Date format</span><select class="form-control jp-setting-local" data-key="dateFormat"><option value="MMM D, YYYY">MMM DD, YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="DD/MM/YYYY">DD/MM/YYYY</option></select></label>'+
      '</div></div>'+
      '<div class="jp-ref-card"><h3>Document defaults</h3><div class="jp-settings-toggle-list">'+
        toggleRow("Show business contact on invoices","showBusinessContact",p.showBusinessContact)+
        toggleRow("Include JUAN PROJECT branding","includeBranding",p.includeBranding)+
        toggleRow("Automatically assign JP reference numbers","autoReference",p.autoReference)+
      '</div></div>');

    const database=section("database","Database & Sync","Manage the live Supabase connection and Workspace synchronization.",
      '<div class="jp-ref-card jp-db-status-card"><div><h3>Database status</h3><div class="jp-db-state"><i class="'+(connected?"live":"offline")+'"></i><strong>'+(connected?"Connected":"Disconnected")+'</strong>'+(connected?'<span>LIVE</span>':'')+'</div><p>'+(connected?"Workspace is reading and writing directly to Supabase.":"Sign in to connect Workspace to Supabase.")+'</p></div><button class="btn btn-secondary" id="jpTestDb">Test connection</button></div>'+
      '<div class="jp-ref-two-col"><div class="jp-ref-card"><h3>Connection</h3><div class="jp-ref-key-values"><div><span>Provider</span><b>Supabase</b></div><div><span>Project</span><b>JUAN PROJECT Production</b></div><div><span>Last successful sync</span><b>'+esc(lastSyncText)+'</b></div></div><div class="jp-credential-note">Deployment credentials are managed through Vercel and are never displayed in Workspace.</div><div class="jp-settings-button-row">'+(connected?'<button class="btn btn-danger" id="jpDisconnectDb">Disconnect</button>':'<button class="btn btn-primary" id="jpReconnectDb">Sign In &amp; Connect</button>')+'</div></div>'+
      '<div class="jp-ref-card"><h3>Synchronization</h3><div class="jp-sync-summary"><strong>'+(connected?"All data synced":"Sync unavailable")+'</strong><small>'+(connected?"Projects, clients, invoices, payments, and orders use the shared production database.":"Connect to Supabase before syncing Workspace data.")+'</small></div><button class="btn btn-secondary btn-block" id="jpSyncNow" '+(connected?'':'disabled')+'>Sync now</button></div></div>'+
      '<div class="jp-ref-card"><h3>Connection behavior</h3><div class="jp-settings-toggle-list">'+toggleRow("Reconnect automatically","reconnectAutomatically",p.reconnectAutomatically)+toggleRow("Show connection status in sidebar","showConnectionSidebar",p.showConnectionSidebar)+toggleRow("Notify me when sync fails","notifySyncFailure",p.notifySyncFailure)+'</div></div>');

    const appearance=section("appearance","Appearance","Personalize how JUAN PROJECT Workspace looks and feels.",
      '<div class="jp-ref-two-col jp-appearance-top"><div class="jp-ref-card"><h3>Theme</h3><div class="jp-theme-options"><button data-theme="light" class="'+(themeChoice==="light"?"active":"")+'"><span class="light-preview"></span><b>Light</b></button><button data-theme="dark" class="'+(themeChoice==="dark"?"active":"")+'"><span class="dark-preview"></span><b>Dark</b></button><button data-theme="system" class="'+(themeChoice==="system"?"active":"")+'"><span class="system-preview"></span><b>System</b></button></div></div>'+
      '<div class="jp-ref-card"><h3>Color style</h3><div class="jp-settings-toggle-list">'+toggleRow("Colorful mode","colorfulMode",st.colorfulMode==="on","Uses stronger status colors for overdue, priority, pending, and completed records.")+'</div><div class="jp-accent-row"><span>Accent color</span><div class="jp-accent-dots"><button data-accent="mint" class="'+(p.accent==="mint"?"active":"")+'" aria-label="Mint"></button><button data-accent="blue" class="'+(p.accent==="blue"?"active":"")+'" aria-label="Blue"></button><button data-accent="violet" class="'+(p.accent==="violet"?"active":"")+'" aria-label="Violet"></button><button data-accent="orange" class="'+(p.accent==="orange"?"active":"")+'" aria-label="Orange"></button><button data-accent="pink" class="'+(p.accent==="pink"?"active":"")+'" aria-label="Pink"></button></div></div></div></div>'+
      '<div class="jp-ref-two-col"><div class="jp-ref-card"><h3>Interface</h3><div class="jp-ref-control-rows">'+
        '<label><span>Density</span><select class="form-control jp-setting-local" data-key="density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>'+
        '<label><span>Sidebar size</span><select class="form-control jp-setting-local" data-key="sidebarSize"><option value="standard">Standard</option><option value="compact">Compact</option></select></label>'+
        '<label><span>Table row height</span><select class="form-control jp-setting-local" data-key="rowHeight"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>'+
      '</div><div class="jp-settings-toggle-list">'+toggleRow("Reduce motion","reduceMotion",p.reduceMotion,"Minimize animations and transitions across the Workspace.")+'</div></div>'+
      '<div class="jp-ref-card"><h3>Preview</h3><p class="jp-ref-card-copy">Here’s how elements will look with your current settings.</p><div class="jp-interface-preview"><span class="badge badge-red">Priority</span><span class="badge badge-neutral">In progress</span><span class="badge badge-green">Paid</span><button class="btn btn-primary btn-sm" type="button">Primary action</button></div></div></div>');

    const notifications=section("notifications","Notifications","Choose which Workspace events should notify you.",
      '<div class="jp-ref-card"><h3>Orders & payments</h3><div class="jp-settings-toggle-list">'+
        toggleRow("New order received","notifNewOrder",p.notifNewOrder,"Get notified when a client places a new order.")+
        toggleRow("Payment submitted","notifPaymentSubmitted",p.notifPaymentSubmitted,"Get notified when a client submits a payment.")+
        toggleRow("Payment approved","notifPaymentApproved",p.notifPaymentApproved,"Get notified when a payment is approved.")+
        toggleRow("Payment rejected","notifPaymentRejected",p.notifPaymentRejected,"Get notified when a payment is rejected.")+
      '</div></div>'+
      '<div class="jp-ref-card"><h3>Projects & deadlines</h3><div class="jp-settings-toggle-list">'+
        '<div class="jp-notification-reminder"><div><b>Project deadline approaching</b><small>Get notified before a project deadline.</small></div><select class="form-control jp-setting-local" data-key="deadlineReminderDays"><option value="1">1 day before</option><option value="3">3 days before</option><option value="5">5 days before</option><option value="7">7 days before</option></select><input type="checkbox" class="jp-setting-toggle jp-setting-local" data-key="notifDeadline" '+(p.notifDeadline?'checked':'')+' aria-label="Project deadline approaching"><i></i></div>'+
        toggleRow("Project overdue","notifOverdue",p.notifOverdue,"Get notified when a project is overdue.")+
        toggleRow("Deliverable completed","notifDeliverableCompleted",p.notifDeliverableCompleted,"Get notified when a deliverable is marked complete.")+
        toggleRow("Client message received","notifClientMessage",p.notifClientMessage,"Get notified when a client sends a message.")+
      '</div></div>'+
      '<div class="jp-ref-card"><h3>System notifications</h3><div class="jp-settings-toggle-list">'+
        toggleRow("Database sync failed","notifSyncFail",p.notifSyncFail,"Get notified when database synchronization fails.")+
        toggleRow("Browser notifications","browserNotifications",p.browserNotifications,"Permission: "+browserPermission)+
        toggleRow("Notification sounds","notificationSounds",p.notificationSounds,"Play a sound when a notification is received.")+
      '</div></div><button class="btn btn-secondary" id="jpSendTestNotification">Send test notification</button>');

    const data=section("data","Data Management","Backups, exports, and validated imports.",
      '<div class="jp-ref-card"><h3>Backup & restore</h3><div class="jp-data-actions"><button class="btn btn-secondary" id="jpExportBackup">Export JSON Backup</button><button class="btn btn-secondary" id="jpRestoreBackup">Restore or Import Data</button></div><div class="jp-data-status"><span>Last Backup<b id="jpLastBackup">Not recorded</b></span><span>Last Import Result<b id="jpLastImport">No recent import</b></span></div></div>'+
      '<div class="jp-ref-card"><h3>Historical import</h3><p class="jp-ref-card-copy">Choose a CSV or paste data. Nothing is imported until the preview is validated and confirmed.</p><div class="jp-data-actions"><button class="btn btn-secondary" id="jpChooseHistorical">Choose CSV</button><button class="btn btn-secondary" id="jpTemplate">Download Import Template</button></div><textarea id="legacyPasteData" class="form-control" rows="5" placeholder="Paste historical rows here, including the header row…"></textarea><button class="btn btn-secondary" id="jpPreviewImport">Preview & Validate</button><div id="jpImportPreview"></div></div>'+
      '<div class="jp-ref-card"><h3>Exports</h3><div class="jp-data-actions"><button class="btn btn-secondary" data-export="projects">Export Projects</button><button class="btn btn-secondary" data-export="clients">Export Clients</button><button class="btn btn-secondary" data-export="finance">Export Invoices & Payments</button></div></div>'+
      '<input type="file" id="jpBackupInput" accept=".json" hidden><input type="file" id="jpHistoricalInput" accept=".csv,text/csv" hidden><button id="jpImportCsv" type="button" hidden></button>');

    const security=section("security","Security","Protect your account, sessions, and sensitive Workspace actions.",
      '<div class="jp-ref-card"><h3>Password & sign-in</h3><div class="jp-security-row"><div><b>Password</b><small>Use your Supabase account password to sign in.</small></div><button class="btn btn-secondary" id="jpChangePassword">Change password</button></div><div class="jp-security-row"><div><b>Device biometric / passkey login</b><small>Uses Face ID, Touch ID, Windows Hello, or Android biometrics when passkeys are supported. Password sign-in remains the fallback.</small></div><button class="btn btn-secondary" type="button" disabled title="Passkey authentication is not connected in this build.">Not available</button></div></div>'+
      '<div class="jp-ref-card"><h3>Workspace lock</h3><div class="jp-settings-toggle-list">'+toggleRow("Auto-lock Workspace","autoLock",p.autoLock)+
        '<div class="jp-ref-select-row"><span>Lock after inactivity</span><select class="form-control jp-setting-local" data-key="autoLockMinutes"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></div>'+
        toggleRow("Require verification before resetting data","verifyReset",p.verifyReset)+
        toggleRow("Require verification before disconnecting database","verifyDisconnect",p.verifyDisconnect)+
      '</div></div>'+
      '<div class="jp-ref-two-col"><div class="jp-ref-card"><h3>Active sessions</h3><div class="jp-current-session"><b>'+esc(currentDevice)+'</b><small>Current browser session</small><span>Current</span></div><button class="btn btn-danger btn-block" id="jpLogoutOthers">Sign out other sessions</button></div>'+
      '<div class="jp-ref-card"><h3>Recent sign-ins</h3><p class="jp-ref-card-copy">Detailed sign-in history is available through the connected Supabase authentication logs.</p><button class="btn btn-secondary" id="jpSignInHistory">View sign-in history</button><div id="jpSecurityInfo" class="jp-inline-info">Current browser session is active.</div></div></div>');

    const about=section("about","About","Application details, updates, and system information.",
      '<div class="jp-ref-card jp-about-hero"><img src="/assets/brand/j-mark.svg" alt="" aria-hidden="true"><div><h3>JUAN PROJECT Workspace</h3><p>JUAN PROJECT Management System</p><span class="jp-version-pill">Version 1.3.3.2</span><b>Developed by BENZEL DELMO</b><small>A centralized workspace for managing projects, clients, orders, payments, and production workflows.</small></div></div>'+
      '<div class="jp-ref-card jp-update-card"><div><h3>Updates</h3><p>Check the current deployed Workspace build when you need to verify release status.</p></div><button class="btn btn-secondary" id="jpCheckUpdates">Check for updates</button></div>'+
      '<div class="jp-ref-two-col"><div class="jp-ref-card"><h3>System information</h3><div class="jp-ref-key-values"><div><span>Environment</span><b>Production</b></div><div><span>Deployment</span><b>Vercel</b></div><div><span>Database</span><b>Supabase</b></div><div><span>Build</span><b id="jpBuildInfo">GitHub + Vercel</b></div></div><button class="btn btn-secondary" id="jpSystemInfo">Show device info</button></div>'+
      '<div class="jp-ref-card"><h3>Resources</h3><div class="jp-resource-list"><a href="/privacy" target="_blank" rel="noopener">Privacy information <span>›</span></a><details><summary>Release notes <span>›</span></summary><p>Settings control center, Online flow, ads navigation, tracker stages, notifications, cache reliability, and client ID protections.</p></details></div></div></div>');

    const danger=section("danger","Danger Zone","Manage irreversible workspace and data actions.",
      '<div class="jp-danger-warning"><div class="jp-danger-warning-icon">!</div><div><b>Proceed with caution</b><span>These actions can permanently remove workspace data and cannot be undone.</span></div></div>'+
      '<div class="jp-danger-list">'+
        '<div class="jp-danger-row"><div><b>Reset workspace data</b><small>Restore projects, clients, payments, orders, and catalog data using the protected reset workflow.</small></div><button class="btn btn-danger" data-danger="reset">Reset data</button></div>'+
        '<div class="jp-danger-row"><div><b>Delete historical imports</b><small>Permanently remove records added through CSV or pasted-data imports.</small></div><button class="btn btn-danger" data-danger="historical">Delete imports</button></div>'+
        '<div class="jp-danger-row"><div><b>Disconnect database</b><small>Remove the active Supabase connection from this Workspace. The remote database is not deleted.</small></div><button class="btn btn-danger" data-danger="disconnect">Disconnect</button></div>'+
        '<div class="jp-danger-row"><div><b>Delete workspace</b><small>A database-wide delete workflow is not exposed until it can be verified safely.</small></div><button class="btn btn-danger" type="button" disabled title="Protected workspace deletion is not connected in this build.">Unavailable</button></div>'+
      '</div><div class="jp-danger-confirm-note"><b>Confirmation required</b><span>Destructive actions use protected confirmation before anything is changed.</span></div>',true);

    const navItems=[
      ["profile","Profile"],["workspace","Workspace"],["database","Database & Sync"],["appearance","Appearance"],["notifications","Notifications"],["data","Data Management"],["security","Security"],["about","About"],["danger","Danger Zone"]
    ];
    const navHtml=navItems.map(([id,label])=>(id==="danger"?'<div class="jp-settings-nav-divider"></div>':'')+'<button type="button" role="tab" class="jp-settings-nav-item '+(id==="danger"?"danger":"")+'" data-settings-tab="'+id+'" aria-controls="settings-'+id+'" aria-selected="false" tabindex="-1"><span class="jp-settings-nav-mark" aria-hidden="true"></span>'+settingsNavIcon(id)+'<span class="jp-settings-nav-label">'+esc(label)+'</span>'+(id==="database"&&!connected?'<small>Sign in</small>':'')+'</button>').join("");
    view.innerHTML='<header class="jp-settings-header"><div><span class="section-kicker">PREFERENCES</span><h1>Settings</h1><p>Manage your Workspace profile, preferences, and system settings.</p></div><div class="jp-settings-search-wrap"><span class="jp-settings-search-icon" aria-hidden="true">'+(window.JuanWorkspaceIcon?window.JuanWorkspaceIcon('search'):'')+'</span><input id="jpSettingsSearch" class="form-control" placeholder="Search settings" autocomplete="off"><div id="jpSettingsSearchResults" class="jp-settings-search-results"></div></div></header>'+
      '<div class="jp-settings-layout"><aside id="jpSettingsSegments" class="jp-settings-navigation" role="tablist" aria-label="Settings sections">'+navHtml+'</aside><section class="jp-settings-content" aria-live="polite"><div class="jp-settings-scroll">'+profile+workspace+database+appearance+notifications+data+security+about+danger+'</div><footer id="jpSettingsActionBar" class="jp-settings-action-bar"><span id="jpSettingsDirtyState">No unsaved changes</span><div><button class="btn btn-secondary" id="jpSettingsDiscard" disabled>Discard</button><button class="btn btn-primary" id="jpSettingsSave" disabled>Save changes</button></div></footer></section></div>';
    settingsBuilt=true;settingsDirty=false;bindSettingsTabs();try{bindSettings();}catch(e){console.error("Settings control binding failed:",e);toast("Some Settings controls could not be initialized.");}
  }

  function activateSettingsSegment(id,{focus=false,force=false}={}){
    const segment=SETTINGS_SEGMENTS.includes(id)?id:"profile";
    const current=$(".jp-settings-segment.active")?.dataset.segment;
    if(settingsDirty&&!force&&current&&current!==segment){toast("Save or discard your Settings changes before switching sections.");return false;}
    localStorage.setItem(SETTINGS_TAB_KEY,segment);
    $$(".jp-settings-nav-item").forEach(btn=>{
      const active=btn.dataset.settingsTab===segment;
      btn.classList.toggle("active",active);btn.setAttribute("aria-selected",active?"true":"false");btn.tabIndex=active?0:-1;
      if(active&&focus)btn.focus();
    });
    $$(".jp-settings-segment").forEach(panel=>{
      const active=panel.dataset.segment===segment;
      panel.classList.toggle("active",active);panel.hidden=!active;panel.setAttribute("role","tabpanel");panel.setAttribute("aria-hidden",active?"false":"true");
    });
    const content=$(".jp-settings-content");if(content)content.scrollTop=0;
    const actionBar=$("#jpSettingsActionBar");if(actionBar)actionBar.hidden=!editableSettingsSegment(segment);
    if(!settingsDirty)setSettingsDirty(false);
    return true;
  }
  function bindSettingsTabs(){
    const tabs=$$(".jp-settings-nav-item");if(!tabs.length)return;
    activateSettingsSegment(localStorage.getItem(SETTINGS_TAB_KEY)||"profile",{force:true});
    tabs.forEach((btn,index)=>{
      btn.addEventListener("click",()=>activateSettingsSegment(btn.dataset.settingsTab));
      btn.addEventListener("keydown",e=>{
        if(!["ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Home","End","Enter"," "].includes(e.key))return;
        e.preventDefault();
        if(e.key==="Enter"||e.key===" "){activateSettingsSegment(btn.dataset.settingsTab,{focus:true});return;}
        let next=index;
        if(e.key==="Home")next=0;else if(e.key==="End")next=tabs.length-1;else if(e.key==="ArrowDown"||e.key==="ArrowRight")next=(index+1)%tabs.length;else next=(index-1+tabs.length)%tabs.length;
        activateSettingsSegment(tabs[next].dataset.settingsTab,{focus:true});
      });
    });
  }
  async function saveActiveSettings(){
    const panel=$(".jp-settings-segment.active");if(!panel||!settingsDirty)return;
    const segment=panel.dataset.segment,prefs={};
    $$(".jp-setting-local",panel).forEach(el=>{
      const key=el.dataset.key;if(!key)return;
      prefs[key]=el.type==="checkbox"?el.checked:(el.type==="number"?Number(el.value):el.value);
    });
    if(segment==="appearance"){
      const theme=$("[data-theme].active",panel)?.dataset.theme||stored().theme||"system";
      const accent=$(".jp-accent-dots [data-accent].active",panel)?.dataset.accent||stored().accent||"mint";
      prefs.theme=theme;prefs.accent=accent;
      const resolved=theme==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;
      window.app.setThemeMode(resolved);
    }
    if(Object.keys(prefs).length)savePrefs(prefs);
    if(segment==="profile"){
      await Promise.resolve(window.app.updateOwnerName($("#jpOwnerName")?.value||""));
      await Promise.resolve(window.app.updateOwnerEmail($("#jpOwnerEmail")?.value||""));
      await Promise.resolve(window.app.updateOwnerPhone($("#jpOwnerPhone")?.value||""));
      await Promise.resolve(window.app.updateOwnerAddress($("#jpOwnerAddress")?.value||""));
    }
    if(segment==="workspace"){
      const name=$("#jpWorkspaceName")?.value.trim()||"",business=$("#jpBusinessName")?.value.trim()||"";
      if(name||business)savePrefs({workspaceName:name||stored().workspaceName,businessName:business||stored().businessName});
      await Promise.resolve(window.app.updateOwnerEmail($("#jpBusinessEmail")?.value||""));
      await Promise.resolve(window.app.updateOwnerPhone($("#jpBusinessPhone")?.value||""));
      await Promise.resolve(window.app.updateOwnerAddress($("#jpBusinessAddress")?.value||""));
    }
    if(segment==="notifications"&&prefs.browserNotifications&&"Notification" in window){
      try{if(Notification.permission==="default")await Notification.requestPermission();installBrowserNotifications();}catch(_){}
    }
    setSettingsDirty(false);toast("Settings saved.");
  }
  function discardActiveSettings(){
    const segment=$(".jp-settings-segment.active")?.dataset.segment||"profile";
    applyInterfacePrefs(stored());settingsBuilt=false;settingsDirty=false;buildSettings();activateSettingsSegment(segment,{force:true});toast("Unsaved Settings changes discarded.");
  }

  function debounce(key,fn,delay=550){
    clearTimeout(saveTimers.get(key));setSettingsStatus("Saving…");
    saveTimers.set(key,setTimeout(async()=>{try{await fn();setSettingsStatus("Saved");}catch(e){setSettingsStatus("Save failed");toast(e.message||"Could not save setting.");}},delay));
  }
  function bindSettings(){
    const p=stored();
    $$(".jp-setting-local").forEach(el=>{
      const key=el.dataset.key;if(!key)return;
      if(el.type==="checkbox")el.checked=!!p[key];
      else if(p[key]!=null)el.value=String(p[key]);
      el.addEventListener("change",()=>setSettingsDirty(true));
      if(el.matches("input,textarea"))el.addEventListener("input",()=>setSettingsDirty(true));
    });
    ["jpOwnerName","jpOwnerEmail","jpOwnerPhone","jpOwnerAddress","jpWorkspaceName","jpBusinessName","jpBusinessEmail","jpBusinessPhone","jpBusinessAddress"].forEach(id=>{
      const el=$("#"+id);if(!el)return;el.addEventListener("input",()=>setSettingsDirty(true));el.addEventListener("change",()=>setSettingsDirty(true));
    });
    $("#jpChangePhoto")?.addEventListener("click",()=>window.app.editExistingProfilePhoto());
    $("#jpRemovePhoto")?.addEventListener("click",()=>window.app.removeProfilePhoto());
    $$("#settings-appearance [data-theme]").forEach(b=>b.addEventListener("click",()=>{
      $$("#settings-appearance [data-theme]").forEach(x=>x.classList.toggle("active",x===b));setSettingsDirty(true);
    }));
    $$(".jp-accent-dots [data-accent]").forEach(b=>b.addEventListener("click",()=>{
      $$(".jp-accent-dots button").forEach(x=>x.classList.remove("active"));b.classList.add("active");setSettingsDirty(true);
    }));
    $("#jpSettingsSave")?.addEventListener("click",()=>saveActiveSettings().catch(e=>{toast(e.message||"Settings could not be saved.");}));
    $("#jpSettingsDiscard")?.addEventListener("click",discardActiveSettings);
    $("#jpTestDb")?.addEventListener("click",()=>window.app.testDatabaseConnection());
    $("#jpSyncNow")?.addEventListener("click",async()=>{try{await window.app.refreshSharedTest();toast("Workspace synchronized.");}catch(e){toast(e.message);}});
    $("#jpReconnectDb")?.addEventListener("click",()=>window.app.connectDatabaseManually());
    $("#jpDisconnectDb")?.addEventListener("click",()=>dangerConfirm("DISCONNECT DATABASE","Database connection will end for this browser.",()=>window.app.disconnectDatabase()));
    $("#jpExportBackup")?.addEventListener("click",()=>{window.app.exportDataBackup();localStorage.setItem("JUAN_LAST_BACKUP_AT",new Date().toISOString());updateDataMeta();});
    $("#jpRestoreBackup")?.addEventListener("click",()=>$("#jpBackupInput").click());
    $("#jpBackupInput")?.addEventListener("change",e=>window.app.importDataBackup(e));
    $("#jpImportCsv")?.addEventListener("click",()=>$("#jpHistoricalInput").click());
    $("#jpChooseHistorical")?.addEventListener("click",()=>$("#jpHistoricalInput").click());
    $("#jpHistoricalInput")?.addEventListener("change",e=>previewFile(e.target.files?.[0]));
    $("#jpPreviewImport")?.addEventListener("click",()=>previewPasted());
    $("#jpTemplate")?.addEventListener("click",downloadTemplate);
    $$("[data-export]").forEach(b=>b.addEventListener("click",()=>exportCsv(b.dataset.export)));
    $("#jpSendTestNotification")?.addEventListener("click",async()=>{if(!("Notification" in window)){toast("Browser notifications are not supported here.");return;}if(Notification.permission==="default")await Notification.requestPermission();if(Notification.permission==="granted"){new Notification("JUAN PROJECT Workspace",{body:"Browser notifications are working on this device."});toast("Test notification sent.");}else toast("Browser notification permission is not enabled.");});
    $("#jpChangePassword")?.addEventListener("click",changePasswordDialog);
    $("#jpSignInHistory")?.addEventListener("click",()=>{$("#jpSecurityInfo").textContent="Sign-in history is available through Supabase authentication logs.";});
    $("#jpLogoutOthers")?.addEventListener("click",async()=>{const db=window.app.getDatabaseClient();if(!db)return;try{await db.auth.signOut({scope:"others"});toast("Other sessions signed out.");}catch(e){toast(e.message);}});
    $("#jpCheckUpdates")?.addEventListener("click",()=>toast("Update status is determined by the current Vercel production deployment."));
    $("#jpSystemInfo")?.addEventListener("click",()=>{$("#jpBuildInfo").textContent=(navigator.userAgentData?.platform||navigator.platform||"Device")+" · "+navigator.userAgent.split(" ").slice(-2).join(" ");});
    $$("[data-danger]").forEach(b=>b.addEventListener("click",()=>runDanger(b.dataset.danger)));
    bindSettingsSearch();updateDataMeta();setSettingsDirty(false);
  }

  let browserNotificationChannel=null;
  function notifyOnce(key,title,body,prefKey){
    const p=stored();if(!p.browserNotifications||(prefKey&&!p[prefKey])||!("Notification" in window)||Notification.permission!=="granted")return;
    const storageKey="JUAN_BROWSER_NOTICE_"+key;if(localStorage.getItem(storageKey))return;
    localStorage.setItem(storageKey,new Date().toISOString());
    try{new Notification(title,{body,tag:"juan-"+key});}catch(_){}
  }
  function scanDeadlineNotifications(){
    const p=stored(),st=window.app?.getWorkspaceState?.();if(!st?.projects)return;
    const now=new Date();now.setHours(0,0,0,0);const remind=Math.max(1,Number(p.deadlineReminderDays||3));
    st.projects.filter(x=>!x.deleted&&x.deadline_date).forEach(project=>{
      const due=new Date(project.deadline_date+"T00:00:00");if(Number.isNaN(due.getTime()))return;
      const days=Math.ceil((due-now)/86400000),code=project.project_code||project.id||"project";
      if(days<0)notifyOnce("overdue-"+code+"-"+project.deadline_date,"Project overdue",(project.title||code)+" passed its deadline.","notifOverdue");
      else if(days<=remind)notifyOnce("deadline-"+code+"-"+project.deadline_date,"Project deadline approaching",(project.title||code)+" is due "+(days===0?"today":days+" day"+(days===1?"":"s")+" from now")+".","notifDeadline");
    });
  }
  function installBrowserNotifications(){
    if(!stored().browserNotifications||!("Notification" in window)||Notification.permission!=="granted")return;
    scanDeadlineNotifications();
    const db=window.app?.getDatabaseClient?.();if(!db?.channel||browserNotificationChannel)return;
    browserNotificationChannel=db.channel("juan-workspace-browser-alerts")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"juan_sync_events"},payload=>{
        const row=payload.new||{},entity=String(row.entity||""),action=String(row.action||"").toUpperCase(),eventKey=String(row.id||row.occurred_at||Date.now());
        if(entity==="incoming_orders"&&action==="INSERT")notifyOnce("order-"+eventKey,"New JUAN PROJECT order","A new Order Request has been received.","notifNewOrder");
        if(entity==="payment_submissions"&&action==="INSERT")notifyOnce("payment-submit-"+eventKey,"Payment submitted","A client payment is waiting for review.","notifPaymentSubmitted");
        if(entity==="payment_submissions"&&action==="UPDATE"){
          const status=String(row.status||"").toLowerCase();
          if(["rejected","declined"].includes(status))notifyOnce("payment-rejected-"+eventKey,"Payment rejected","A submitted payment was rejected.","notifPaymentRejected");
          else if(["accepted","approved","paid"].includes(status))notifyOnce("payment-approved-"+eventKey,"Payment approved","A submitted payment was approved.","notifPaymentApproved");
        }
      })
      .subscribe();
    setInterval(scanDeadlineNotifications,300000);
  }

  function updateDataMeta(){
    const b=$("#jpLastBackup"),i=$("#jpLastImport");
    const last=localStorage.getItem("JUAN_LAST_BACKUP_AT");if(b)b.textContent=last?new Date(last).toLocaleString("en-PH"):"Not recorded";
    if(i)i.textContent=localStorage.getItem("JUAN_LAST_IMPORT_RESULT")||"No recent import";
  }
  function bindSettingsSearch(){
    const input=$("#jpSettingsSearch"),box=$("#jpSettingsSearchResults");if(!input||!box)return;
    const entries=[];
    $$(".jp-settings-segment").forEach(section=>{
      const segment=section.dataset.segment;
      $$("label,.jp-danger-row,.jp-settings-button-row button,.jp-data-actions button",section).forEach(el=>{
        const text=String(el.innerText||el.textContent||"").trim().replace(/\s+/g," ");if(text)entries.push({segment,text,el});
      });
    });
    input.addEventListener("input",()=>{
      const q=input.value.trim().toLowerCase();$$(".jp-settings-search-hit").forEach(x=>x.classList.remove("jp-settings-search-hit"));
      if(!q){box.classList.remove("open");box.innerHTML="";return;}
      const hits=entries.filter(x=>x.text.toLowerCase().includes(q)).slice(0,10);
      box.innerHTML=hits.length?hits.map((x,i)=>'<button data-search-index="'+i+'"><span>'+esc(x.text)+'</span><small>'+esc(x.segment[0].toUpperCase()+x.segment.slice(1))+'</small></button>').join(""):'<div class="jp-settings-no-results">No settings found</div>';
      box.classList.add("open");
      $$("[data-search-index]",box).forEach(b=>b.onclick=()=>{const hit=hits[Number(b.dataset.searchIndex)];box.classList.remove("open");activateSettingsSegment(hit.segment);requestAnimationFrame(()=>{hit.el.classList.add("jp-settings-search-hit");hit.el.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>hit.el.classList.remove("jp-settings-search-hit"),2200);});});
    });
  }
  function previewFile(file){
    if(!file)return;const r=new FileReader();r.onload=()=>showImportPreview(String(r.result||""),file);r.readAsText(file);
  }
  function previewPasted(){showImportPreview($("#legacyPasteData")?.value||"",null);}
  function showImportPreview(text,file){
    const host=$("#jpImportPreview");if(!host)return;
    const lines=String(text||"").replace(/\r/g,"").split("\n").filter(x=>x.trim());
    if(lines.length<2){host.innerHTML='<div class="jp-import-invalid">No valid records found.</div>';return;}
    const headers=lines[0].split(",").map(x=>x.trim());const sample=lines.slice(1,4);
    host.innerHTML='<div class="jp-import-preview-card"><div><b>'+Math.max(0,lines.length-1)+' records ready for validation</b><small>'+esc(headers.join(" · "))+'</small></div><div class="jp-import-sample">'+sample.map(x=>'<code>'+esc(x.slice(0,180))+'</code>').join("")+'</div><button class="btn btn-primary" id="jpConfirmImport">Import Validated Records</button></div>';
    $("#jpConfirmImport").onclick=async()=>{
      try{
        if(file){
          await window.app.handleLegacyCSVImport({target:{files:[file],value:""}});
        }else await window.app.importPastedSheetData();
        const result="Import completed "+new Date().toLocaleString("en-PH");localStorage.setItem("JUAN_LAST_IMPORT_RESULT",result);updateDataMeta();host.innerHTML='<div class="jp-import-valid">Import completed. Review Projects and Clients before continuing.</div>';
      }catch(e){host.innerHTML='<div class="jp-import-invalid">'+esc(e.message||"Import failed")+'</div>';}
    };
  }
  function downloadTemplate(){
    const text="project_id,project_name,project_type,client_id,client_email,amount_due,amount_received,start_date,due_date,payment_status,pending_amount\n";
    const a=document.createElement("a"),u=URL.createObjectURL(new Blob([text],{type:"text/csv"}));a.href=u;a.download="JUAN_PROJECT_IMPORT_TEMPLATE.csv";a.click();setTimeout(()=>URL.revokeObjectURL(u),500);
  }
  function exportCsv(kind){
    const st=window.app.getWorkspaceState();let rows=[],name="";
    if(kind==="projects"){name="JUAN_PROJECT_PROJECTS.csv";rows=[["Project ID","Project Name","Client","Email","Total","Start Date","Due Date"],...(st.projects||[]).filter(x=>!x.deleted).map(p=>[p.project_code,p.title,p.client_name,p.client_email,p.total_amount,p.start_date,p.deadline_date])];}
    else if(kind==="clients"){name="JUAN_PROJECT_CLIENTS.csv";rows=[["Client ID","Name","Email","Phone","Address"],...(st.clients||[]).filter(x=>!x.archived_at).map(c=>[c.client_code,c.name,c.email,c.phone,c.address])];}
    else{name="JUAN_PROJECT_FINANCE.csv";rows=[["Project ID","Project Name","Total","Paid","Balance"],...(st.projects||[]).filter(x=>!x.deleted).map(p=>{const paid=(p.payments||[]).filter(x=>!x.deleted_at).reduce((s,x)=>s+Number(x.amount_paid||0),0);return[p.project_code,p.title,p.total_amount,paid,Math.max(0,Number(p.total_amount||0)-paid)];})];}
    const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n"),a=document.createElement("a"),u=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);
  }
  function changePasswordDialog(){
    modalPrompt("Change Password","Enter a new password with at least 8 characters.","New password","Update Password",async value=>{
      if(value.length<8)throw new Error("Password must be at least 8 characters.");
      const db=window.app.getDatabaseClient();if(!db)throw new Error("Database is not connected.");
      const r=await db.auth.updateUser({password:value});if(r.error)throw r.error;toast("Password updated.");
    },"password");
  }
  function modalPrompt(title,message,placeholder,button,onSubmit,type="text"){
    const layer=document.createElement("div");layer.className="jp-settings-modal-layer";
    layer.innerHTML='<section class="jp-settings-modal"><button class="jp-settings-modal-x">×</button><h3>'+esc(title)+'</h3><p>'+esc(message)+'</p><input class="form-control" type="'+type+'" placeholder="'+esc(placeholder)+'"><div class="jp-settings-modal-actions"><button class="btn btn-secondary" data-cancel>Cancel</button><button class="btn btn-primary" data-ok>'+esc(button)+'</button></div><div class="jp-settings-modal-error"></div></section>';
    document.body.appendChild(layer);const input=$("input",layer);input.focus();
    const close=()=>layer.remove();$(".jp-settings-modal-x",layer).onclick=close;$("[data-cancel]",layer).onclick=close;
    $("[data-ok]",layer).onclick=async()=>{try{await onSubmit(input.value);close();}catch(e){$(".jp-settings-modal-error",layer).textContent=e.message||String(e);}};
    layer.addEventListener("keydown",e=>{if(e.key==="Escape")close();if(e.key==="Enter"){e.preventDefault();$("[data-ok]",layer).click();}});
  }
  function dangerConfirm(phrase,message,action){
    modalPrompt("Confirm destructive action",message+' Type "'+phrase+'" to continue.',phrase,"Continue",async value=>{if(value.trim()!==phrase)throw new Error("Confirmation phrase does not match.");await action();});
  }
  function runDanger(kind){
    if(kind==="reset")return dangerConfirm("RESET WORKSPACE","This begins the protected Workspace reset flow.",()=>window.app.openResetDataModal());
    if(kind==="cache")return dangerConfirm("CLEAR CACHE","Browser-only drafts and interface caches will be removed.",()=>new Promise(resolve=>window.app.requestDestructivePin("Clear Cached Data","Clear browser-only Workspace drafts and caches?",()=>{Object.keys(localStorage).filter(k=>k.startsWith("JUAN_")&&(k.includes("DRAFT")||k.includes("CACHE"))).forEach(k=>localStorage.removeItem(k));toast("Cached Workspace data cleared.");resolve();})));
    if(kind==="disconnect")return dangerConfirm("DISCONNECT DATABASE","The live Supabase session will be disconnected.",()=>new Promise(resolve=>window.app.requestDestructivePin("Disconnect Database","Disconnect this Workspace from Supabase?",async()=>{await window.app.disconnectDatabase();resolve();})));
    if(kind==="signout")return dangerConfirm("SIGN OUT","Your current Workspace session will end.",()=>new Promise(resolve=>window.app.requestDestructivePin("Sign Out","Sign out of JUAN PROJECT Workspace?",async()=>{await window.app.disconnectDatabase();resolve();})));
    if(kind==="historical")return dangerConfirm("DELETE HISTORICAL","Imported historical project records will be removed. The canonical preload reference remains.",()=>new Promise(resolve=>window.app.requestDestructivePin("Delete Imported Historical Records","Delete imported historical project rows from the active Workspace?",async()=>{await deleteHistorical();resolve();})));
  }
  async function deleteHistorical(){
    const db=window.app.getDatabaseClient();if(!db)throw new Error("Database is not connected.");
    const q=await db.from("projects").select("id").eq("pricing_version","legacy");if(q.error)throw q.error;
    const ids=(q.data||[]).map(x=>x.id);if(!ids.length){toast("No imported historical records found.");return;}
    for(const table of ["deliverables","project_items","payments"]){const r=await db.from(table).delete().in("project_id",ids);if(r.error)throw r.error;}
    const p=await db.from("projects").delete().in("id",ids);if(p.error)throw p.error;toast(ids.length+" imported historical projects deleted.");await window.app.refreshSharedTest();
  }

  async function saveProjectFilesSilent(projectId){
    const st=window.app.getWorkspaceState(),proj=(st.projects||[]).find(p=>String(p.id)===String(projectId)),db=window.app.getDatabaseClient();if(!proj||!db)return;
    const url=$("#projectFilesDriveUrl")?.value.trim()||"",unlock=$("#projectFilesUnlockAt")?.value||"",expires=$("#projectFilesExpiresAt")?.value||"";
    if(url&&!/^https:\/\/(drive|docs)\.google\.com\//i.test(url))return;
    const unlockIso=unlock?new Date(unlock).toISOString():null,expiresIso=expires?new Date(expires).toISOString():null;
    if(unlockIso&&expiresIso&&new Date(expiresIso)<=new Date(unlockIso))return;
    const updated_at=new Date().toISOString();
    const r=await db.from("projects").update({drive_url:url||null,drive_unlock_at:unlockIso,drive_expires_at:expiresIso,updated_at}).eq("id",proj.id).select("id").single();
    if(r.error)throw r.error;proj.drive_url=url||null;proj.drive_unlock_at=unlockIso;proj.drive_expires_at=expiresIso;proj.updated_at=updated_at;
  }
  async function saveProjectNotesSilent(projectId){
    const st=window.app.getWorkspaceState(),proj=(st.projects||[]).find(p=>String(p.id)===String(projectId)),db=window.app.getDatabaseClient(),field=$("#projectNotesTextarea");if(!proj||!db||!field)return;
    const notes=field.value.trim(),updated_at=new Date().toISOString();const r=await db.from("projects").update({notes,updated_at}).eq("id",proj.id).select("id").single();if(r.error)throw r.error;proj.notes=notes;proj.updated_at=updated_at;
  }
  function bindProjectDrafts(){
    document.addEventListener("input",e=>{
      const el=e.target;if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement)||!el.id)return;
      const view=el.closest(".view");if(!view)return;
      const st=window.app?.getWorkspaceState?.();
      let scope=view.id;
      if(view.id==="view-project-details"&&st?.activeProjectId)scope+=":"+st.activeProjectId;
      if(view.id==="view-client-profile"&&st?.activeClientId)scope+=":"+st.activeClientId;
      const drafts=readDrafts();drafts[scope]??={};drafts[scope][el.id]={value:el.type==="checkbox"?el.checked:el.value,at:Date.now()};localStorage.setItem(FORM_DRAFT_KEY,JSON.stringify(drafts));
      if(view.id==="view-project-details"&&st?.activeProjectId){
        if(el.id.startsWith("projectData"))debounce("project:"+st.activeProjectId,()=>window.app.saveProjectData({silent:true}),700);
        if(["projectFilesDriveUrl","projectFilesUnlockAt","projectFilesExpiresAt"].includes(el.id))debounce("files:"+st.activeProjectId,()=>saveProjectFilesSilent(st.activeProjectId),800);
        if(el.id==="projectNotesTextarea")debounce("notes:"+st.activeProjectId,()=>saveProjectNotesSilent(st.activeProjectId),800);
      }
    },true);
    window.addEventListener("focus",restoreActiveDrafts);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")restoreActiveDrafts();});
  }
  function readDrafts(){try{return JSON.parse(localStorage.getItem(FORM_DRAFT_KEY)||"{}");}catch(_){return {};}}
  function restoreActiveDrafts(){
    const view=$(".view.active");if(!view)return;const st=window.app?.getWorkspaceState?.();let scope=view.id;
    if(view.id==="view-project-details"&&st?.activeProjectId)scope+=":"+st.activeProjectId;
    if(view.id==="view-client-profile"&&st?.activeClientId)scope+=":"+st.activeClientId;
    const d=readDrafts()[scope]||{};Object.entries(d).forEach(([id,row])=>{if(Date.now()-Number(row.at||0)>86400000)return;const el=document.getElementById(id);if(!el||document.activeElement===el)return;if(el.type==="checkbox")el.checked=!!row.value;else if(String(el.value||"")==="")el.value=row.value??"";});
  }

  function fixClientProfileGuard(){
    const original=window.app.openClientProfile?.bind(window.app);if(!original||original.__jpSafe)return;
    const safe=function(id){
      try{original(id);}catch(e){console.warn("Client profile render recovered:",e);}
      requestAnimationFrame(()=>{try{window.JPGeneral?.renderEditableClient?.();}catch(e){console.warn(e);}});
    };safe.__jpSafe=true;window.app.openClientProfile=safe;
  }
  function removeProjectSaveButtons(){
    $("#saveProjectDataBtn")?.remove();
    const fileBtn=$("#projectFilesSaveBtn");if(fileBtn){fileBtn.textContent="Saved automatically";fileBtn.disabled=true;fileBtn.classList.add("jp-autosave-placeholder");}
  }
  function portalPolish(){
    const table=$("#onlinePortalActivityPanel table");if(table)table.classList.add("jp-portal-activity-table");
  }
  function overviewPolish(){
    $$("#overviewCurrentProjects > *").forEach((x,i)=>x.classList.toggle("jp-overview-extra",i>=4));
  }

  function install(){
    cleanRootText();applyInterfacePrefs();buildSettings();if(!$("#view-settings .jp-settings-layout")){settingsBuilt=false;buildSettings();}bindProjectDrafts();fixClientProfileGuard();portalPolish();removeProjectSaveButtons();overviewPolish();installBrowserNotifications();
    const originalNav=window.app.navigateTo.bind(window.app);
    window.app.navigateTo=function(view){
      const r=originalNav(view);
      requestAnimationFrame(()=>{cleanRootText();if(view==="settings"){if(!settingsBuilt||!$("#view-settings .jp-settings-layout"))buildSettings();const main=$(".main-content"),content=$("#view-settings .jp-settings-content"),scroll=$("#view-settings .jp-settings-scroll");if(main)main.scrollTop=0;if(content)content.scrollTop=0;if(scroll)scroll.scrollTop=0;}if(view==="client-profile")fixClientProfileGuard();if(view==="online-portal")portalPolish();if(view==="project-details")removeProjectSaveButtons();if(view==="my-works")overviewPolish();restoreActiveDrafts();});
      return r;
    };
    document.addEventListener("keydown",e=>{
      const mod=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?e.metaKey:e.ctrlKey;
      if(mod&&e.key.toLowerCase()==="s"){
        const active=$(".view.active");if(active?.id==="view-project-details"){e.preventDefault();const st=window.app.getWorkspaceState();Promise.allSettled([window.app.saveProjectData({silent:false}),saveProjectFilesSilent(st.activeProjectId),saveProjectNotesSilent(st.activeProjectId)]);}
      }
    },true);
    window.addEventListener('juan:realtime-sync',()=>requestAnimationFrame(()=>{
      const active=document.querySelector('.view.active')?.id||'';
      if(active==='view-online-portal')portalPolish();
      if(active==='view-my-works')overviewPolish();
    }));
  }
  later(install);
})();
