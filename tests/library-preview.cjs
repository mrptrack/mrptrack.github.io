// Browser QA is performed through Codex's browser tools, never launched here.
// Synthetic data + no-network cloud double. API artwork can be tested independently.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://en.wikipedia.org https://es.wikipedia.org https://openlibrary.org https://api.tvmaze.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://upload.wikimedia.org https://thumb.wikimedia.org https://covers.openlibrary.org https://static.tvmaze.com https://*.archive.org");
  if(pathname==='/js/cloud.js'){res.setHeader('Content-Type','text/javascript');return res.end("export const _cloudReady=true; export function saveAndSync(){document.getElementById('qaStatus').textContent='Saved (isolated)';return Promise.resolve(true)} export function updateSyncStatus(){} export function hasPendingCloudChanges(){return false}");}
  if(pathname==='/cover-check'){
    res.setHeader('Content-Type','text/html');return res.end('<h1>Public cover provider check</h1><p>Open Library</p><img width="190" src="https://covers.openlibrary.org/b/id/11481354-L.jpg?default=false"><p>Wikipedia</p><img width="190" src="https://upload.wikimedia.org/wikipedia/en/8/8e/Dune_%282021_film%29.jpg">');
  }
  if(pathname==='/'){
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/^---[\s\S]*?---\s*/,'').replace(/<script src="https:\/\/accounts.google.com[^>]*><\/script>/,'').replace('<script type="module" src="js/app-update.js"></script>','').replace('src="js/app.js"','src="tests/library-preview.js"');
    res.setHeader('Content-Type','text/html');return res.end(html);
  }
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
server.listen(51571,'127.0.0.1',()=>console.log('Library preview: http://127.0.0.1:'+server.address().port));
