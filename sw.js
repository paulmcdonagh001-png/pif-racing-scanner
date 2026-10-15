const CACHE='pif-racing-v13-shortlist-first';
const ASSETS=['./','./index.html','./v1.js','./advanced.html','./live.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  .then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==location.origin)return;
 // The shell remains usable offline, but the private racing API is NEVER cached.
 if(url.pathname==='/'||/\/(index|v1|advanced|live)\.(html|js)$/.test(url.pathname)){
   event.respondWith(fetch(req).catch(()=>caches.match(req)));return;
 }
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});