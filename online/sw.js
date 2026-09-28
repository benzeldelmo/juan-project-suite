// JUAN PROJECT Online offline cache — 20260920-1900
const CACHE='juan-online-20260928-desktop-cleanup-v1';
const SHELL=["/","/index.html","/css/app.css","/css/suite.css","/css/table-system.css","/js/app.js","/js/suite-prod.js","/js/table-system.js","/js/auth.js","/js/config.js","/js/data.js","/js/payments.js","/js/utils.js","/js/payment-institutions.js","/manifest.webmanifest","/assets/brand/j-mark.svg","/assets/brand/juan-project-online.svg","/assets/brand/juan-project.svg","/assets/brand/juan-project-online-master.png","/assets/icon-192.png","/assets/payment-institutions/bdo.png","/assets/payment-institutions/bpi.png","/assets/payment-institutions/gcash.png","/assets/payment-institutions/gotyme.png","/assets/payment-institutions/landbank.png","/assets/payment-institutions/maribank.png","/assets/payment-institutions/maya.png","/assets/payment-institutions/metrobank.png","/assets/payment-institutions/pnb.png","/assets/payment-institutions/unionbank.png","/css/mobile-commerce.css","/css/ads.css","/css/mobile-redesign.css","/css/mobile-v2-optimizations.css","/css/desktop.css","/js/mobile-commerce.js","/js/ads.js","/js/site-basics.js","/js/mobile-v2-optimizations.js","/terms.html","/privacy.html","/404.html"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function networkFirst(req){const cache=await caches.open(CACHE);try{const response=await fetch(req,{cache:'no-store'});if(response&&response.ok)await cache.put(req,response.clone());return response}catch(error){const cached=await caches.match(req);if(cached)return cached;throw error}}
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;if(u.pathname.startsWith('/api/')){e.respondWith(fetch(r));return}if(r.mode==='navigate'||u.pathname.endsWith('.js')||u.pathname.endsWith('.css')||u.pathname==='/sw.js'){e.respondWith(networkFirst(r));return}e.respondWith(caches.match(r).then(c=>c||fetch(r).then(async resp=>{if(resp&&resp.ok){const cache=await caches.open(CACHE);await cache.put(r,resp.clone())}return resp})))});

self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{}}catch(_){data={body:event.data?event.data.text():'There is a new JUAN PROJECT update.'}}
  const title=data.title||'JUAN PROJECT Online';
  const options={
    body:data.body||'There is a new update in your client portal.',
    icon:data.icon||'/assets/apple-touch-icon.png',
    badge:data.badge||'/assets/favicon-32.png',
    tag:data.tag||'juan-project-online',
    renotify:Boolean(data.renotify),
    data:{url:data.url||'/'}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/',self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if(client.url.startsWith(self.location.origin)){client.navigate(target).catch(()=>{});return client.focus();}}
    return self.clients.openWindow?self.clients.openWindow(target):undefined;
  }));
});
