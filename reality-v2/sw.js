const VERSION='reality-v2-20261103-one-guest-browser-v20';
const ASSETS=['./','./index.html','./reality_v2.js','./graph.html','./graph.js','./jev.js','./jev.css','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('reality-v2-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url),root=new URL(self.registration.scope);
 if(req.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
 event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(VERSION).then(c=>c.put(req,copy));}return res;}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
});