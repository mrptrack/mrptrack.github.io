// Local, isolated UI fixture. Replaces cloud module; never sends real data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const fixture=path.join(__dirname,'training-preview.html');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; img-src 'self' data:");
  if(pathname==='/js/cloud.js'){
    res.setHeader('Content-Type','text/javascript');
    return res.end("import {D} from './state.js'; export function saveAndSync(){sessionStorage.setItem('gym-test',JSON.stringify(D));}");
  }
  const file=pathname==='/'?fixture:path.resolve(root,'.'+pathname);
  if(file!==fixture&&!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
server.listen(0,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+server.address().port));
