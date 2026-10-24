import { t, mediaTitle } from './i18n.js';
import { seriesProgress } from './life-schema.js';
import { D } from './state.js';
import { F } from './utils.js';
import { renderMediaInsights } from './insights.js';
import { renderLibrary } from './library.js';

export function _parseDurMin(s) {
  if (!s) return 0;
  return +(String(s).match(/(\d+)\s*h/)?.[1] || 0)*60 + +(String(s).match(/(\d+)\s*min/)?.[1] || 0);
}
const el=id=>document.getElementById(id);
const titled=items=>items.map((b,i)=>({...b,title:mediaTitle(b),_i:i}));
const titles=item=>Object.values(item.translations||{}).map(x=>x.title).join(' ');
const tile=(label,value,sub='')=>`<div class="sum-card"><div class="sum-lbl">${t(label)}</div><div class="sum-val">${value}</div>${sub?`<div class="sum-sub">${sub}</div>`:''}</div>`;

export function renderBooks() {
  renderMediaInsights('books');
  const q=(el('booksSearch').value||'').toLowerCase(), sort=el('booksSort').value, filter=el('booksFilter').value;
  let list=titled(D.books);
  if(q)list=list.filter(b=>(b.title+' '+b.author+' '+titles(b)).toLowerCase().includes(q));
  if(filter==='rated')list=list.filter(b=>b.myRating!=null);
  if(filter==='unrated')list=list.filter(b=>b.myRating==null);
  const sorts={default:(a,b)=>a._i-b._i,'rating-desc':(a,b)=>(b.myRating||0)-(a.myRating||0),'gr-desc':(a,b)=>(b.grRating||0)-(a.grRating||0),
    'pages-desc':(a,b)=>(b.pages||0)-(a.pages||0),'pages-asc':(a,b)=>(a.pages||9999)-(b.pages||9999),title:(a,b)=>a.title.localeCompare(b.title)};
  list.sort(sorts[sort]||sorts.default);
  const rated=D.books.filter(b=>b.myRating!=null),avg=rated.length?rated.reduce((s,b)=>s+b.myRating,0)/rated.length:0;
  const pending=D.books.filter(b=>b.myRating==null).reduce((s,b)=>s+(b.pages||0),0),read=rated.reduce((s,b)=>s+(b.pages||0),0);
  el('booksSummary').innerHTML=tile('Total',D.books.length)+tile('Read',`${rated.length}/${D.books.length}`)+tile('Pages read',F(read,0),F(pending,0)+' '+t('remaining'))+tile('Avg mine',(rated.length?F(avg,1):'—')+'/5');
  renderLibrary(el('booksGrid'),'book',list);
}
export function renderMovies() {
  renderMediaInsights('movies');
  const q=(el('moviesSearch').value||'').toLowerCase(),sort=el('moviesSort').value,filter=el('moviesFilter').value;
  let list=titled(D.movies);
  if(q)list=list.filter(m=>(m.title+' '+m.director+' '+m.actors+' '+titles(m)).toLowerCase().includes(q));
  if(filter==='rated')list=list.filter(m=>m.myRating!=null);else if(filter==='unrated')list=list.filter(m=>m.myRating==null);
  const sorts={default:(a,b)=>a._i-b._i,'fa-desc':(a,b)=>(b.faRating||0)-(a.faRating||0),'my-desc':(a,b)=>(b.myRating||0)-(a.myRating||0),
    'year-desc':(a,b)=>(b.year||0)-(a.year||0),'year-asc':(a,b)=>(a.year||9999)-(b.year||9999),
    'dur-desc':(a,b)=>_parseDurMin(b.duration)-_parseDurMin(a.duration),'dur-asc':(a,b)=>_parseDurMin(a.duration)-_parseDurMin(b.duration),title:(a,b)=>a.title.localeCompare(b.title)};
  list.sort(sorts[sort]||sorts.default);
  const rated=D.movies.filter(m=>m.myRating!=null),avg=rated.length?rated.reduce((s,m)=>s+m.myRating,0)/rated.length:0;
  const watched=D.movies.filter(m=>m.myRating!=null||!!m.opinion?.trim()),pending=D.movies.filter(m=>!watched.includes(m));
  const hours=Math.round(watched.reduce((s,m)=>s+_parseDurMin(m.duration),0)/60),remaining=pending.reduce((s,m)=>s+_parseDurMin(m.duration),0)/60,missing=pending.filter(m=>!_parseDurMin(m.duration)).length;
  el('moviesSummary').innerHTML=tile('Total',D.movies.length)+tile('Watched',`${watched.length}/${D.movies.length}`)+tile('Hours watched',hours+'h',F(remaining,1)+'h '+t('remaining')+(missing?' · '+missing+' '+t('Unknown duration'):''))+tile('Avg mine',(rated.length?F(avg,1):'—')+'/10');
  renderLibrary(el('moviesGrid'),'movie',list);
}
export function renderSeries() {
  renderMediaInsights('series');
  const q=(el('seriesSearch').value||'').toLowerCase(),sort=el('seriesSort').value,filter=el('seriesFilter').value;
  let list=titled(D.series);
  if(q)list=list.filter(s=>(s.title+' '+s.platform+' '+titles(s)).toLowerCase().includes(q));
  if(filter==='finished')list=list.filter(s=>['Entera','Finished'].includes(s.watched));
  if(filter==='watching')list=list.filter(s=>['Sí','Yes','Volver a verla','Rewatch'].includes(s.wantFinish)||['Al día','Up to date'].includes(s.watched));
  if(filter==='dropped')list=list.filter(s=>s.wantFinish==='No');
  if(filter==='notstarted')list=list.filter(s=>s.myRating==null);
  const sorts={default:(a,b)=>a._i-b._i,'rating-desc':(a,b)=>(b.myRating||0)-(a.myRating||0),'imdb-desc':(a,b)=>(b.imdbRating||0)-(a.imdbRating||0),title:(a,b)=>a.title.localeCompare(b.title)};
  list.sort(sorts[sort]||sorts.default);
  const rated=D.series.filter(s=>s.myRating!=null),avg=rated.length?rated.reduce((s,x)=>s+x.myRating,0)/rated.length:0,progress=D.series.map(seriesProgress),estimated=progress.some(p=>p.estimated);
  const hours=Math.round(progress.reduce((s,p)=>s+p.done,0)/60),remaining=Math.round(progress.reduce((s,p)=>s+p.remaining,0)/60);
  el('seriesSummary').innerHTML=tile('Total',D.series.length)+tile('Watched',`${rated.length}/${D.series.length}`)+tile('Hours watched',(estimated?'≈ ':'')+hours+'h',(estimated?'≈ ':'')+remaining+'h '+t('remaining'))+tile('Avg mine',(rated.length?F(avg,1):'—')+'/10');
  renderLibrary(el('seriesGrid'),'serie',list);
}
