// JUAN PROJECT Workspace offline cache — 20260920-1805
const CACHE='juan-workspace-20260928-deliverables-tabs-v3';
const SHELL=[
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
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(req){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(req,{cache:'no-store'});
    if(response&&response.ok)await cache.put(req,response.clone());
    return response;
  }catch(error){
    const cached=await caches.match(req);
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(req));
    return;
  }

  // Mutable app shell/code must always come from the current deployment.
  // Do not fall back to an old cached copy after a successful deploy.
  if(req.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html'||url.pathname.endsWith('.js')||url.pathname.endsWith('.css')||url.pathname==='/sw.js'){
    event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>networkFirst(req)));
    return;
  }

  // Immutable/static visual assets remain cache-first for offline performance.
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
