const CACHE='pif-racing-v2-default-20261026';
const ASSETS=['./','./index.html','./v2.html','./database.html','./manifest.webmanifest','./icon.svg'];
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
 // Network-first on pages: never silently revive the retired model from cache.
 if(url.pathname==='/'||/\/(index|v2|database)\.html$/.test(url.pathname)){
   event.respondWith(fetch(req).catch(()=>caches.match(req)));return;
 }
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});