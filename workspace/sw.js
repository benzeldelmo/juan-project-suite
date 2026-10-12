// JUAN PROJECT Workspace cache policy — 2026-10-13
// Mutable application code is always network-fresh. Only immutable visual assets are cached.
const CACHE='juan-workspace-2026-10-13-live-v1';
const STATIC_ASSETS=[
  "/assets/brand/j-mark.svg",
  "/assets/brand/juan-project.svg",
  "/assets/brand/juan-project-workspace-master.png",
  "/assets/icon-192.png",
  "/assets/payment-institutions/bdo.png",
  "/assets/payment-institutions/bpi.png",
  "/assets/payment-institutions/gcash.png",
  "/assets/payment-institutions/gotyme.png",
  "/assets/payment-institutions/landbank.png",
  "/assets/payment-institutions/maribank.png",
  "/assets/payment-institutions/maya.png",
  "/assets/payment-institutions/metrobank.png",
  "/assets/payment-institutions/pnb.png",
  "/assets/payment-institutions/unionbank.png"
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(STATIC_ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys
        .filter(key=>key.startsWith('juan-workspace-')&&key!==CACHE)
        .map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  // APIs must never be cached.
  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(req,{cache:'no-store'}));
    return;
  }

  // HTML, CSS, JS and the service worker itself must always come from the
  // current deployment. Never serve an old cached shell/code bundle.
  if(
    req.mode==='navigate' ||
    url.pathname==='/' ||
    url.pathname==='/index.html' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname==='/sw.js'
  ){
    event.respondWith(fetch(req,{cache:'no-store'}));
    return;
  }

  // Immutable visual assets can remain cache-first.
  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(async response=>{
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(req,response.clone());
      }
      return response;
    }))
  );
});
