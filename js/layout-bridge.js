import {signOut} from './auth.js';
import {D,_authed,_currentUser} from './state.js';
import {buildDataObj,saveLocal} from './storage.js';
import {_cloudReady,saveAndSync,hasPendingCloudChanges} from './cloud.js';
import {getPriceData,valEur} from './portfolio.js';
import {refreshWatchlist,getWatchlistSnapshot} from './watchlist.js';
import {validateLife} from './life-schema.js';
import {normalizeLayout,viewPatch} from './layout-model.js';

const brand=document.title.includes('MRP')?'Track MRP':'Track CMG';
const storageKey=(brand==='Track MRP'?'trackmrp':'trackcmg')+'_layout_v1';
let layout='classic',frame,queue=Promise.resolve(),writes=0,originalPanel=null;
try{layout=normalizeLayout(localStorage.getItem(storageKey));}catch{}
export const getLayout=()=>layout;
const stamp=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function snapshot(){
 if(!_authed)throw Error('Inicia sesión para ver tus datos.');
 const quotes={},dates=[];let known=0;
 for(const h of D.holdings||[]){const q=getPriceData(h.ticker),valid=Number.isFinite(q?.price);quotes[h.ticker]={price:valid?q.price:null,value:valid?valEur(h):null,day:valid&&q.prev?(q.price/q.prev-1)*100:null};if(valid)known++;const ts=q?.ts?.at(-1);if(ts&&Number.isFinite(new Date(ts).getTime()))dates.push(new Date(ts).toISOString().slice(0,10));}
 const history=[...(D.history||[])].sort((a,b)=>a.date.localeCompare(b.date));
 const complete=known===(D.holdings||[]).length,total=complete?Object.values(quotes).reduce((n,q)=>n+q.value,Number(D.cash)||0):history.at(-1)?.totalValue??null;
 const data=structuredClone(buildDataObj());data.history=history;
 return {data,market:{quotes,total,watchlist:getWatchlistSnapshot(),ready:complete,captured:dates.sort().at(-1)||history.at(-1)?.date||stamp()},brand,user:_currentUser?.name||brand,sync:document.getElementById('syncStatus')?.textContent||'',canEdit:_cloudReady&&!hasPendingCloudChanges()&&writes===0};
}
function notify(){if(!frame||!_authed||originalPanel)return;try{frame.contentWindow.dispatchEvent(new CustomEvent('dashboard-state',{detail:snapshot()}));}catch{}}
function updateVisibility(){
 const show=_authed&&layout==='new';document.body.classList.toggle('new-layout-active',show);
 if(show&&!frame){frame=document.createElement('iframe');frame.id='dashboardNewView';frame.title=brand;frame.src='new/index.html';document.body.append(frame);}
 if(frame)frame.hidden=!show;
 if(show)notify();
}
export function setLayout(value){closeOriginal();layout=normalizeLayout(value);try{localStorage.setItem(storageKey,layout);}catch{}document.getElementById('ov')?.classList.remove('open');updateVisibility();document.dispatchEvent(new CustomEvent('layout-changed',{detail:layout}));if(layout==='classic')document.getElementById('btnSettings')?.focus();}
export function authLayoutChanged(){if(!_authed){closeOriginal();frame?.remove();frame=null;}updateVisibility();}
function closeOriginal(){
 if(!originalPanel)return;const {panel,placeholder,node}=originalPanel;placeholder.replaceWith(node);panel.remove();originalPanel=null;
 document.getElementById('ov')?.classList.remove('open');if(document.body.classList.contains('edit-mode'))document.getElementById('btnAdmin')?.click();
 if(frame)frame.hidden=layout!=='new'||!_authed;notify();
}
function showOriginal(section){
 if(!_authed)return;closeOriginal();const node=document.getElementById('tab-'+section);if(!node)return;
 const panel=document.createElement('section'),placeholder=document.createComment('Original section');panel.id='dashboardOriginalPanel';
 const bar=document.createElement('div');bar.className='native-panel-toolbar';
 const back=document.createElement('button');back.className='btn';back.textContent=D.preferences?.language==='en'?'← Back':'← Volver';back.onclick=closeOriginal;bar.append(back);
 if(section==='portfolio'||section==='trades'){const edit=document.createElement('button');edit.className='btn';edit.textContent=D.preferences?.language==='en'?'Edit':'Editar';edit.onclick=()=>document.getElementById('btnAdmin')?.click();bar.append(edit);}
 panel.append(bar);node.before(placeholder);panel.append(node);originalPanel={panel,placeholder,node};document.body.append(panel);if(frame)frame.hidden=true;
 document.querySelector(`.tab-btn[data-tab="${section}"]`)?.click();document.dispatchEvent(new Event('dashboard-native-panel'));
}
export function initLayout(){
 window.TrackDashboardUI=Object.freeze({
  read:snapshot,setLayout,signOut,
  get busy(){return writes>0||!!originalPanel;},
  applyEdits(request){
   if(!_authed||!_cloudReady||hasPendingCloudChanges()||writes>0)return {ok:false,error:'Espera a que termine la sincronización antes de editar.'};
   try{
    const current=buildDataObj(),{next,fields}=viewPatch(current,request);
    if(!fields.length)return {ok:true};
    const errors=validateLife(next);if(errors.length)throw Error(errors[0]);
    // Apply only validated non-financial fields. No snapshot can replace holdings,
    // contributions, cash, broker balances, trades or history through this bridge.
    for(const field of fields)D[field]=next[field];
    saveLocal();writes++;
    queue=queue.catch(()=>{}).then(async()=>{try{return await saveAndSync();}finally{writes--;notify();}});
    document.dispatchEvent(new Event('dashboard-data-updated'));
    if(fields.includes('gym'))document.dispatchEvent(new Event('measurements-updated'));
    if(fields.includes('watchlist'))refreshWatchlist();
    return {ok:true};
   }catch(error){return {ok:false,error:error.message};}
  },
  preferences(p){
   if(!_authed)return;
   if(['es','en'].includes(p.language)||['dark','light'].includes(p.theme)){
    D.preferences={...D.preferences,...(['es','en'].includes(p.language)?{language:p.language}:{}),...(['dark','light'].includes(p.theme)?{theme:p.theme}:{})};
    document.dispatchEvent(new Event('preferences-changed'));saveAndSync();
   }
  },
  openSection(section){if(!['portfolio','watchlist','trades','analytics','gym','books','movies','series','games'].includes(section))return;showOriginal(section);},
  refreshWatchlist(options){if(_authed)return refreshWatchlist({force:options?.force===true});}
 });
 for(const event of ['data-loaded','portfolio-updated','preferences-changed','dashboard-data-updated','watchlist-prices-updated'])document.addEventListener(event,notify);
 const status=document.getElementById('syncStatus');if(status)new MutationObserver(notify).observe(status,{childList:true,characterData:true,subtree:true});
 updateVisibility();
}
