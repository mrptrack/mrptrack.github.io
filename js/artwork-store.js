import { D, _authed, isFallbackState } from './state.js';
import { _cloudReady, hasPendingCloudChanges, saveAndSync } from './cloud.js';
import { saveLocal } from './storage.js';
import { artworkKey, validArtwork } from './artwork-model.js';

const keys={book:'books',movie:'movies',serie:'series',game:'games'};
const pending=new Map();
let timer,lastSave=0;
function apply(kind,item,art){
  const key=artworkKey(kind,item),matches=(D[keys[kind]]||[]).filter(x=>artworkKey(kind,x)===key);
  if(matches.length!==1)return false;
  const current=matches[0];
  if(current.artwork===false||(current.artwork&&!current.artwork.automatic))return false;
  if(current.artwork?.url===art.url&&current.artwork?.lookupKey===key)return false;
  current.artwork={...art,automatic:true,lookupKey:key};return true;
}
function schedule(){if(!timer)timer=setTimeout(flushArtwork,Math.max(6000,30000-(Date.now()-lastSave)));}
export async function flushArtwork(){
  timer=null;
  if(!pending.size)return;
  if(!_authed||!_cloudReady||isFallbackState()||hasPendingCloudChanges()||document.body.classList.contains('edit-mode')||document.getElementById('ov')?.classList.contains('open')){schedule();return;}
  const batch=[...pending.entries()];
  // A background cloud refresh may have replaced D while covers were loading.
  // Reapply only to the same uniquely identified title, never replace a document.
  for(const [,v]of batch)apply(v.kind,v.item,v.art);
  saveLocal();lastSave=Date.now();
  let ok=false;try{ok=await saveAndSync();}catch{}
  if(ok)for(const [key,v]of batch)if(pending.get(key)===v)pending.delete(key);
  if(pending.size)schedule();
}
export function persistArtwork(kind,item,art){
  // Persist only images which actually loaded, after the authenticated cloud load.
  if(!_authed||!_cloudReady||isFallbackState()||!keys[kind]||!art||!validArtwork(art))return;
  if(!apply(kind,item,art))return;
  const key=artworkKey(kind,item);pending.set(key,{kind,item:{title:item.title,translations:item.translations,year:item.year,years:item.years,releaseYear:item.releaseYear,author:item.author},art});
  saveLocal();schedule();
}
