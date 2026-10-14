/* JUAN PROJECT Online — privacy, route-aware footer and lightweight site essentials */
(function(){
  "use strict";
  function syncFooter(){
    document.querySelectorAll(".jp-site-footer").forEach(function(x){x.remove();});
    const state=window.JPOAppState;
    if(!state||state.route!=="home"||state.portal?.profile)return;
    const page=document.querySelector("main.page");if(!page)return;
    const footer=document.createElement("footer");footer.className="jp-site-footer jp-home-only-footer";
    footer.innerHTML='<nav><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></nav><div>© 2026 JUAN PROJECT · Creative Services for a Brighter Tomorrow.</div>';
    page.appendChild(footer);
  }
  function purgeLegacyOnboarding(){
    document.querySelectorAll(".suite-onboard").forEach(function(el){var overlay=el.closest(".suite-overlay,.overlay");(overlay||el).remove();});
    document.querySelectorAll(".visual-onboard-shell,.visual-onboard-card").forEach(function(el){el.remove();});
    document.querySelectorAll(".suite-overlay,.overlay").forEach(function(el){var text=(el.textContent||"").trim();if(text.includes("Welcome to your client portal")||text.includes("Your projects, together")||text.includes("Payments made clear")||text.includes("Ready when you are"))el.remove();});
  }
  function enhance(){purgeLegacyOnboarding();document.querySelectorAll(".jp-cookie-banner").forEach(function(el){el.remove();});try{localStorage.removeItem("JUAN_PRIVACY_CONSENT_V1");}catch(_){}syncFooter();document.querySelectorAll("img:not([alt])").forEach(function(img){img.alt="JUAN PROJECT visual";});}
  window.addEventListener("juan-online-render",enhance);
  new MutationObserver(function(){purgeLegacyOnboarding();}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(enhance,250);});else setTimeout(enhance,250);
})();