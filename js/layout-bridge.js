import * as sharedStorage from './storage.js';
import {financeEdit,financeRevision,financeIdentity,FINANCE_FIELDS} from './finance-editor-model.js';
import {validateData} from './data-validation.js';
import {brokerSnapshotPatch} from './broker-model.js';
import {renderBenchmark} from './analytics.js';
import {signOut} from './auth.js';
import {D,_authed,_currentUser} from './state.js';
import {buildDataObj,saveLocal,_migrateDivs} from './storage.js';
import {_cloudReady,saveAndSync,hasPendingCloudChanges,getCloudStatus} from './cloud.js';
import {getPriceData,valEur,fxR} from './portfolio.js';
import {refreshWatchlist,getWatchlistSnapshot} from './watchlist.js';
import {validateLife} from './life-schema.js';
import {normalizeLayout,viewPatch} from './layout-model.js';

const brand=document.title.includes('MRP')?'Track MRP':'Track CMG';
const storageKey=(brand==='Track MRP'?'trackmrp':'trackcmg')+'_layout_v1';
let layout='classic',frame,queue=Promise.resolve(),writes=0;
try{layout=normalizeLayout(localStorage.getItem(storageKey));if(new URLSearchParams(location.search).get('layout')==='new'){layout='new';localStorage.setItem(storageKey,layout);}}catch{}
export const getLayout=()=>layout;
const stamp=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function snapshot(){
 if(!_authed)throw Error('Inicia sesión para ver tus datos.');
 const quotes={},dates=[];let known=0;
 for(const h of D.holdings||[]){const q=getPriceData(h.ticker),valid=Number.isFinite(q?.price);quotes[h.ticker]={price:valid?q.price:null,value:valid?valEur(h):null,day:valid&&q.prev?(q.price/q.prev-1)*100:null,prev:Number.isFinite(q?.prev)?q.prev:null,low:Number.isFinite(q?.low)?q.low:null,high:Number.isFinite(q?.high)?q.high:null,wk52Low:Number.isFinite(q?.wk52Low)?q.wk52Low:null,wk52High:Number.isFinite(q?.wk52High)?q.wk52High:null,pe:Number.isFinite(q?.pe)?q.pe:null,divYield:Number.isFinite(q?.divYield)?q.divYield:null,stale:!!q?._stale};if(valid)known++;const ts=q?.ts?.at(-1);if(ts&&Number.isFinite(new Date(ts).getTime()))dates.push(new Date(ts).toISOString().slice(0,10));}
 const history=[...(D.history||[])].sort((a,b)=>a.date.localeCompare(b.date));
 const complete=known===(D.holdings||[]).length,total=complete?Object.values(quotes).reduce((n,q)=>n+q.value,Number(D.cash)||0):history.at(-1)?.totalValue??null;
 const data=structuredClone(buildDataObj());data.history=history;
 const cloud=getCloudStatus(),status=document.getElementById('syncStatus'),raw=status?.textContent||'',syncCode=status?.dataset?.syncState,offline=typeof navigator!=='undefined'&&navigator.onLine===false;
 const syncInfo={state:offline?'offline':cloud.loading?'loading':cloud.saving||writes>0?'syncing':syncCode==='err'||/error/i.test(raw)?'error':/local/i.test(raw)?'local':cloud.pending?'pending':!cloud.ready?'local':syncCode==='ok'||/synced|sincr\./i.test(raw)?'synced':'local',syncedAt:status?.dataset?.syncedAt||null};
 return {data,capabilities:{brokers:brand==='Track CMG'},rates:Object.fromEntries(['EUR','USD','CAD','GBP','JPY'].map(c=>[c,c==='EUR'?1:fxR(c)])),market:{quotes,total,watchlist:getWatchlistSnapshot(),ready:complete,captured:dates.sort().at(-1)||history.at(-1)?.date||stamp()},brand,user:_currentUser?.name||brand,syncInfo,sync:document.getElementById('syncStatus')?.textContent||'',canEdit:_cloudReady&&!hasPendingCloudChanges()&&writes===0};
}
function notify(){if(!frame||!_authed)return;try{frame.contentWindow.dispatchEvent(new CustomEvent('dashboard-state',{detail:snapshot()}));}catch{}}
function updateVisibility(){
 const show=_authed&&layout==='new';document.body.classList.toggle('new-layout-active',show);
 if(show&&!frame){frame=document.createElement('iframe');frame.id='dashboardNewView';frame.title=brand;frame.src='new/index.html';document.body.append(frame);}
 if(frame)frame.hidden=!show;
 if(show)notify();
}
export function setLayout(value){layout=normalizeLayout(value);try{localStorage.setItem(storageKey,layout);}catch{}document.getElementById('ov')?.classList.remove('open');updateVisibility();document.dispatchEvent(new CustomEvent('layout-changed',{detail:layout}));if(layout==='classic')document.getElementById('btnSettings')?.focus();}
export function authLayoutChanged(){if(!_authed){frame?.remove();frame=null;}updateVisibility();}
const transactions=new Map(),imports=new Map();
const ready=()=>_authed&&_cloudReady&&!hasPendingCloudChanges()&&writes===0;
function remember(data){localStorage.setItem('dashboard_editor_backup_v1',JSON.stringify({at:new Date().toISOString(),data}));}
function commitData(next,fields){
 for(const field of fields)D[field]=structuredClone(next[field]);saveLocal();writes++;
 queue=queue.catch(()=>{}).then(async()=>{try{return await saveAndSync();}finally{writes--;notify();}});
 document.dispatchEvent(new Event('dashboard-data-updated'));document.dispatchEvent(new Event('dashboard-finance-updated'));
}
export function initLayout(){
 window.TrackDashboardUI=Object.freeze({
  read:snapshot,setLayout,signOut,
  finance(request){
   if(!ready())return {ok:false,error:'Espera a que termine la sincronización.'};
   try{
    const before=buildDataObj(),sameRevision=request?.expected===financeRevision(before),onlyHistoryChanged=!String(request?.operation||'').startsWith('history-')&&request?.expectedIdentity===financeIdentity(before);if(!sameRevision&&!onlyHistoryChanged)throw Error('Los datos han cambiado. Vuelve a abrir el editor.');
    const {next}=financeEdit(before,request.operation,request.values,Object.fromEntries(['EUR','USD','CAD','GBP','JPY'].map(c=>[c,c==='EUR'?1:fxR(c)])));
    if(!request.operation.startsWith('history-'))Object.assign(next,brokerSnapshotPatch(next,h=>Number.isFinite(getPriceData(h.ticker)?.price)?valEur(h):null,stamp()));
    const token=crypto.randomUUID();remember(before);transactions.set(token,{before:structuredClone(before),after:financeIdentity(next),strictHistory:request.operation.startsWith('history-'),revision:financeRevision(next),history:JSON.stringify(next.history)});if(transactions.size>20)transactions.delete(transactions.keys().next().value);
    commitData(next,FINANCE_FIELDS);return {ok:true,token};
   }catch(error){return {ok:false,error:error.message};}
  },
  undoFinance(request){
   if(!ready())return {ok:false,error:'Espera a que termine la sincronización.'};
   try{const saved=transactions.get(request?.token),current=buildDataObj();if(!saved||request.expected!==financeRevision(current)||saved.after!==financeIdentity(current)||saved.strictHistory&&saved.revision!==financeRevision(current))throw Error('Los datos han cambiado: no se puede deshacer esta acción.');const restored=structuredClone(saved.before);if(!saved.strictHistory&&saved.history!==JSON.stringify(current.history)){restored.history=current.history;Object.assign(restored,brokerSnapshotPatch(restored,h=>Number.isFinite(getPriceData(h.ticker)?.price)?valEur(h):null,stamp()));}remember(current);commitData(restored,FINANCE_FIELDS);transactions.delete(request.token);return {ok:true};}catch(error){return {ok:false,error:error.message};}
  },
  analyzeImport(raw){
   if(!_authed)return {ok:false,errors:['Inicia sesión.']};
   try{const parsed=JSON.parse(raw),checked=validateData(parsed,D);if(!checked.ok)return checked;const token=crypto.randomUUID(),before=buildDataObj();imports.clear();imports.set(token,{data:checked.data,before:JSON.stringify(before)});return {ok:true,token,warnings:checked.warnings,summary:['holdings','closedTrades','history','books','movies','series','games','gym','workouts','watchlist'].map(k=>({key:k,before:(before[k]||[]).length,after:(checked.data[k]||[]).length})),cash:checked.data.cash,totalInvested:checked.data.totalInvested};}catch(error){return {ok:false,errors:[error.message]};}
  },
  importData(request){
   if(!ready())return {ok:false,error:'Espera a que termine la sincronización.'};
   try{const staged=imports.get(request?.token),before=buildDataObj();if(!request?.confirmed||!staged||staged.before!==JSON.stringify(before))throw Error('Vuelve a analizar el archivo antes de importar.');const next=structuredClone(staged.data);_migrateDivs(next.holdings);_migrateDivs(next.closedTrades);if(sharedStorage.repairHistory)next.history=sharedStorage.repairHistory(next.history);if(request.mergeHistory){next.history=[...new Map([...(before.history||[]),...(next.history||[])].map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));}remember(before);commitData(next,Object.keys(next));imports.clear();return {ok:true};}catch(error){return {ok:false,error:error.message};}
  },
  backup(){if(!_authed)return null;try{return JSON.parse(localStorage.getItem('dashboard_editor_backup_v1')||'null');}catch{return null;}},
  async renderBenchmarks(target){if(!_authed)return {available:false};await renderBenchmark(target);return {available:(window.Chart?.getChart(target.getElementById('cBenchmark'))?.data?.datasets?.length||0)>1};},
  get busy(){return writes>0;},
  applyEdits(request){
   if(!_authed||!_cloudReady||hasPendingCloudChanges()||writes>0)return {ok:false,error:'Espera a que termine la sincronización antes de editar.'};
   try{
    const current=buildDataObj(),{next,fields}=viewPatch(current,request);
    if(!fields.length)return {ok:true};
    const checked=validateData(next,{});if(!checked.ok)throw Error(checked.errors[0]);remember(current);
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

  refreshWatchlist(options){if(_authed)return refreshWatchlist({force:options?.force===true});}
 });
 for(const event of ['data-loaded','portfolio-updated','preferences-changed','dashboard-data-updated','watchlist-prices-updated','sync-state-changed'])document.addEventListener(event,notify);
 window.addEventListener?.('online',notify);window.addEventListener?.('offline',notify);
 const status=document.getElementById('syncStatus');if(status)new MutationObserver(notify).observe(status,{childList:true,characterData:true,subtree:true});
 updateVisibility();
}
