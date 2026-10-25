export const S={data:null,market:null,seed:null,extras:{favorites:[],progress:{},watchNotes:{}},ui:{page:'portfolio',shelf:'movies',mediaFilter:'all',mediaSort:'default',mediaQuery:'',mediaLimit:18,period:'6m',portfolioTab:'positions',broker:'all',privacy:false,theme:'dark',language:'es',layout:'new',weekGoal:3,month:new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit'}).format(new Date()),favoriteOnly:false}};
const undo=[];
const bridge=window.parent!==window?window.parent.TrackDashboardUI:null;
let confirmed=null,pendingState=null;
import {D as translationState} from '../js/state.js';
import {initI18n,translateUI} from '../js/i18n.js';
import {financeRevision,financeIdentity} from '../js/finance-editor-model.js';
export const locale=()=>S.ui.language==='en'?'en-GB':'es-ES';
export const TODAY=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const kinds={books:'Libros',movies:'Películas',series:'Series',games:'Videojuegos'};
export const muscles={chest:'Pecho',back:'Espalda',lowerBack:'Espalda baja',shoulders:'Hombro',abs:'Abdominales',cardio:'Cardio',legs:'Pierna',biceps:'Bíceps',triceps:'Tríceps'};
export const palette=['#76dfb1','#8da7f5','#d6b779','#b097e4','#80c6d0','#e49399','#b3cb7f','#b2b9c6'];
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const num=(n,d=0)=>Number(n||0).toLocaleString(locale(),{minimumFractionDigits:d,maximumFractionDigits:d});
export const money=(v,d=0)=>S.ui.privacy?'•••• €':v==null||!Number.isFinite(v)?'—':num(v,d)+' €';
export const pct=(v,d=1)=>v==null||!Number.isFinite(v)?'—':(v>0?'+':'')+num(v,d)+'%';
export const date=(s,opts={day:'numeric',month:'short'})=>s?new Date(s+'T12:00:00').toLocaleDateString(locale(),opts):'—';
export const title=x=>x.translations?.[S.ui.language]?.title||x.title||x.ticker;
export const key=(kind,x)=>kind+':'+norm(x.title||x.ticker);
export const favorite=(kind,x)=>S.extras.favorites.includes(key(kind,x));
export const progress=(kind,x)=>S.extras.progress[key(kind,x)]||{};
export function minutes(value){if(typeof value==='number')return value;const s=String(value||'').replace(',','.');const h=s.match(/(\d+(?:\.\d+)?)\s*h/i),m=s.match(/(\d+)\s*m/i);return h||m?(h?+h[1]*60:0)+(m?+m[1]:0):/^\d+$/.test(s.trim())?+s:0;}
export function episodeCount(x){const parts=String(x.epsPerSeason||'').split(/[,/;+]/).map(s=>s.trim());if(!parts.length||parts.some(p=>!/^\d+$/.test(p)))return null;const n=parts.map(Number);return n.length===1?n[0]*(x.seasons||1):n.reduce((a,b)=>a+b,0);}
export function status(kind,x){const p=progress(kind,x);if(kind==='games')return {Completed:'done',Playing:'active',Paused:'paused',Dropped:'dropped'}[x.status]||'pending';if(kind==='series'){if(['Entera','Finished'].includes(x.watched))return 'done';if(['Al día','Up to date'].includes(x.watched))return 'uptodate';if(x.watched?.trim())return x.wantFinish==='No'?'dropped':'active';return 'pending';}if(x.libraryStatus)return x.libraryStatus;if(p.status)return p.status;if(kind==='books')return x.myRating!=null?'done':'pending';if(kind==='movies')return x.myRating!=null||x.opinion?.trim()?'done':'pending';if(kind==='games')return {Completed:'done',Playing:'active',Paused:'paused',Dropped:'dropped'}[x.status]||'pending';if(['Entera','Finished'].includes(x.watched))return 'done';if(['Al día','Up to date'].includes(x.watched))return 'uptodate';if(x.watched?.trim())return x.wantFinish==='No'?'dropped':'active';return 'pending';}
export const statusLabel=s=>({done:'Completado',pending:'Pendiente',active:'En curso',uptodate:'Al día',paused:'En pausa',dropped:'Abandonado'}[s]||s);
export function done(kind,x){return ['done','uptodate'].includes(status(kind,x));}
export function cover(x){if(x.artworkOverride)return x.artwork?.localUrl?'../'+x.artwork.localUrl:x.artwork?.url||'';if(S.profile?.brand==='Track MRP'&&norm(x.title)==='hades')return '../icons/covers/hades.jpg';if(S.profile?.brand==='Track CMG'&&norm(x.title).includes('little book of valuation'))return '../icons/covers/the-little-book-of-valuation.jpg';return x.artwork?.localUrl?'../'+x.artwork.localUrl:x.artwork?.url||'';}
export function meta(kind,x){return kind==='books'?[x.author,x.pages?num(x.pages)+' págs.':null]:kind==='movies'?[x.year,x.duration]:kind==='games'?[x.platform,x.releaseYear]:[x.platform,x.years];}
export function completion(kind,x){const p=progress(kind,x);if(done(kind,x))return 100;if(kind==='books'&&x.pages)return Math.min(100,(p.amount||0)/x.pages*100);return 0;}
export function totalValue(){return S.market.total;}

const editable=['books','movies','series','games','workouts','activities','watchlist','gym','dashboardExtras'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
let committing=false;
function hydrate(payload){
 S.data=structuredClone(payload.data);
 for(const k of ['holdings','closedTrades','history','gym','books','movies','series','games','watchlist','brokers','workouts','activities'])S.data[k]??=[];
 S.data.cash??=0;S.data.totalInvested??=0;
 S.seed=structuredClone(S.data);S.market=payload.market;S.rates=payload.rates||{EUR:1};S.capabilities=payload.capabilities||{};
 S.extras={favorites:[],progress:{},watchNotes:{},templates:[],...structuredClone(payload.data.dashboardExtras||{})};
 S.ui.weekGoal=S.extras.weekGoal||3;S.ui.language=S.data.preferences?.language||'es';S.ui.theme=S.data.preferences?.theme||'dark';
 S.sync=payload.sync;S.canEdit=payload.canEdit;S.profile={brand:payload.brand,user:payload.user};
 translationState.preferences={language:S.ui.language,theme:S.ui.theme};
 confirmed=structuredClone(payload.data);document.documentElement.dataset.theme=S.ui.theme;
}
export function saveSettings(){
 try{localStorage.setItem('dashboard_view_privacy',JSON.stringify(S.ui.privacy));}catch{}
 const p=confirmed.preferences||{};
 if(p.theme!==S.ui.theme||p.language!==S.ui.language)bridge.preferences({theme:S.ui.theme,language:S.ui.language});
 if((S.extras.weekGoal||3)!==S.ui.weekGoal)commit('Objetivo actualizado',()=>S.extras.weekGoal=S.ui.weekGoal);
 translationState.preferences={language:S.ui.language,theme:S.ui.theme};document.documentElement.dataset.theme=S.ui.theme;translateUI();
}
function requestFor(next){return {changes:editable.filter(k=>!same(confirmed[k],next[k])).map(field=>({field,before:confirmed[field],after:next[field]}))};}
export function commit(label,fn){
 const before={data:structuredClone(S.data),extras:structuredClone(S.extras)};
 if(!S.canEdit){document.dispatchEvent(new CustomEvent('lab-toast',{detail:'Espera a que termine la sincronización antes de editar.'}));return false;}
 try{
  fn();for(const k of ['books','movies','series','games'])for(const x of S.data[k]){const p=progress(k,x);if(!p.status||same(before.extras.progress[key(k,x)],p))continue;if(k==='games')x.status={done:'Completed',active:'Playing',pending:'Backlog',paused:'Paused',dropped:'Dropped'}[p.status]||x.status;else if(k==='series'){x.watched=p.status==='done'?'Entera':p.status==='pending'?'':p.season?'Temporada '+p.season+' · episodio '+(p.episode||0):x.watched;x.wantFinish=p.status==='dropped'?'No':x.wantFinish;}else{x.libraryStatus=p.status;if(k==='books'&&p.amount!=null)x.currentPage=p.amount;}}const desired={...S.data,dashboardExtras:S.extras},request=requestFor(desired);
  committing=true;const result=bridge.applyEdits(request);committing=false;
  if(!result.ok)throw Error(result.error);
  undo.push({before,changes:structuredClone(request.changes)});if(undo.length>12)undo.shift();
  confirmed=structuredClone(desired);S.canEdit=false;pendingState=null;
  document.dispatchEvent(new CustomEvent('lab-change',{detail:label}));return true;
 }catch(error){committing=false;S.data=before.data;S.extras=before.extras;document.dispatchEvent(new CustomEvent('lab-change',{detail:error.message}));return false;}
}
export function undoLast(){
 const old=undo.at(-1);if(!old){document.dispatchEvent(new CustomEvent('lab-toast',{detail:'No hay cambios que deshacer.'}));return;}
 if(old.financeToken){const result=bridge.undoFinance({token:old.financeToken,expected:financeRevision(S.seed)});if(!result.ok){document.dispatchEvent(new CustomEvent('lab-toast',{detail:result.error}));return;}undo.pop();hydrate(bridge.read());document.dispatchEvent(new CustomEvent('lab-change',{detail:'Último cambio deshecho'}));return;}
 const result=bridge.applyEdits({changes:old.changes.map(c=>({field:c.field,before:c.after,after:c.before}))});
 if(!result.ok){document.dispatchEvent(new CustomEvent('lab-toast',{detail:result.error}));return;}
 undo.pop();hydrate(bridge.read());document.dispatchEvent(new CustomEvent('lab-change',{detail:'Último cambio deshecho'}));
}
export function editFinance(label,operation,values){
 if(!S.canEdit){document.dispatchEvent(new CustomEvent('lab-toast',{detail:'Espera a que termine la sincronización antes de editar.'}));return false;}
 const result=bridge.finance({operation,values,expected:financeRevision(S.seed),expectedIdentity:financeIdentity(S.seed)});
 if(!result.ok){document.dispatchEvent(new CustomEvent('lab-toast',{detail:result.error}));return false;}
 undo.push({financeToken:result.token});if(undo.length>20)undo.shift();hydrate(bridge.read());document.dispatchEvent(new CustomEvent('lab-change',{detail:label}));return true;
}
export function toggleFavorite(kind,index){const x=S.data[kind][index],k=key(kind,x);commit(favorite(kind,x)?'Quitado de favoritos':'Añadido a favoritos',()=>{S.extras.favorites=S.extras.favorites.includes(k)?S.extras.favorites.filter(v=>v!==k):[...S.extras.favorites,k];});}
export function totals(){const d=S.data;return {books:d.books.filter(x=>done('books',x)).length,movies:d.movies.filter(x=>done('movies',x)).length,games:d.games.filter(x=>done('games',x)).length,pages:d.books.reduce((s,x)=>s+(done('books',x)?x.pages||0:progress('books',x).amount||0),0),pagesLeft:d.books.reduce((s,x)=>s+Math.max(0,(x.pages||0)-(done('books',x)?x.pages||0:progress('books',x).amount||0)),0),gameHours:d.games.reduce((s,x)=>s+(x.hours||0),0)};}
export async function init(){
 if(!bridge)throw Error('Abre esta vista desde Ajustes en tu dashboard.');
 hydrate(bridge.read());S.ui.privacy=false;
 initI18n();document.addEventListener('view-rendered',translateUI);
 const flush=()=>setTimeout(()=>{if(pendingState&&!committing&&!document.querySelector('dialog[open], input:focus, textarea:focus, select:focus')){const latest=pendingState;pendingState=null;window.dispatchEvent(new CustomEvent('dashboard-state',{detail:latest}));}},0);
 document.addEventListener('focusout',flush);document.addEventListener('dashboard-edit-closed',flush);
 window.addEventListener('dashboard-state',e=>{
  pendingState=null;S.sync=e.detail.sync;S.canEdit=e.detail.canEdit;
  if(committing||document.querySelector('dialog[open], input:focus, textarea:focus, select:focus')){pendingState=e.detail;return;}
  if(!same(confirmed,e.detail.data)||!same(S.market,e.detail.market)){
   hydrate(e.detail);document.dispatchEvent(new CustomEvent('lab-change',{detail:''}));
  }
  for(const el of document.querySelectorAll('.preview-badge,.preview-status>span')){const text=[...el.childNodes].find(n=>n.nodeType===3);if(text)text.nodeValue=S.sync||'Conectado';}
 });
}
