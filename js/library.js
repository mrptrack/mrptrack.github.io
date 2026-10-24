import { D, _authed } from './state.js';
import { esc } from './life-schema.js';
import { t, mediaTitle, language } from './i18n.js';
import { F, ratingColor } from './utils.js';
import { coverMarkup, hydrateArtwork, loadArtwork } from './artwork.js';
import { safeArtworkUrl } from './artwork-model.js';

const keys={book:'books',movie:'movies',serie:'series',game:'games'};
export function libraryStatus(kind,status){
  if(kind==='movie')return language()==='es'?(status==='Watched'?'Vista':'Pendiente'):(status==='Watched'?'Watched':'Pending');
  if(kind==='book')return language()==='es'?(status==='Read'?'Leído':'Pendiente'):(status==='Read'?'Read':'Pending');
  return t(status);
}
export function libraryInfo(kind,item) {
  const max=kind==='book'?5:10, rating=item.myRating;
  let status,creator,subtitle,facts;
  if(kind==='book'){
    status=rating!=null?'Read':'TBR'; creator=item.author;
    subtitle=[item.year,item.pages?`${F(item.pages,0)} ${t('pages')}`:''];
    facts=[['Author',item.author],['Year',item.year],['Pages',item.pages],['Goodreads rating',item.grRating!=null?item.grRating+'/5':null]];
  }else if(kind==='movie'){
    status=rating!=null||item.opinion?.trim()?'Watched':'Watchlist'; creator=item.director;
    subtitle=[item.year,item.duration];
    facts=[['Director',item.director],['Year',item.year],['Duration',item.duration],['Platform',item.platform],['Actors',item.actors],['Filmaffinity rating',item.faRating!=null?item.faRating+'/10':null]];
  }else if(kind==='serie'){
    status=['Entera','Finished'].includes(item.watched)?'Finished':['Al día','Up to date'].includes(item.watched)?'Up to date':['Volver a verla','Rewatch'].includes(item.wantFinish)?'Rewatch':item.wantFinish==='No'?'Dropped':item.watched||(['Sí','Yes'].includes(item.wantFinish)?'In progress':'Watchlist');
    creator=item.platform; subtitle=[item.years,item.seasons?t(item.seasons+' seasons'):''];
    facts=[['Years',item.years],['Platform',item.platform],['Seasons',item.seasons],['Episodes per season',item.epsPerSeason],['Ep length',item.epLength],['Watched',t(item.watched||'Unknown')],['Want to finish?',t(item.wantFinish||'Unknown')],['IMDB rating',item.imdbRating!=null?item.imdbRating+'/10':null]];
  }else{
    status=item.status||'Backlog';creator=item.developer;subtitle=[item.platform,item.releaseYear];
    facts=[['Platform',item.platform],['Developer',item.developer],['Release year',item.releaseYear],['Year played',item.playedYear],['Hours played',item.hours!=null?F(item.hours,1)+'h':null],['Metacritic',item.metacritic!=null?item.metacritic+'/100':null]];
  }
  return {max,rating,status,creator,subtitle:subtitle.filter(v=>v!=null&&v!==''&&v!==0).join(' · '),facts:facts.filter(([,v])=>v!=null&&v!=='')};
}
export function renderLibrary(grid,kind,list) {
  if(!grid)return;
  const items=new Map();grid._libraryItems=items;
  grid.classList.add('library-grid');grid.dataset.kind=kind;
  grid.innerHTML=list.map(item=>{
    const idx=item._i??item.i, info=libraryInfo(kind,item);items.set(idx,item);
    return `<article class="m-card library-card" ${_authed?`data-edit-type="${kind}" data-edit-idx="${idx}"`:''}>
      <button type="button" class="library-poster" data-artwork data-library-kind="${kind}" data-library-index="${idx}" aria-label="${esc(t('View details')+': '+mediaTitle(item))}">
        ${coverMarkup(kind,item)}<span class="library-rating" style="--rating-color:${info.rating==null?'var(--text-dim)':ratingColor(info.rating*10/info.max)}"><small>${t('My rating')}</small><b>${info.rating==null?'—':F(info.rating,1)}${info.rating==null?'':`<small>/${info.max}</small>`}</b></span>
      </button><div class="library-body"><span class="library-status ${['Read','Watched','Finished','Completed'].includes(info.status)?'is-done':['Playing','In progress','Up to date'].includes(info.status)?'is-active':''}">${esc(libraryStatus(kind,info.status))}</span>
      <h3 class="m-card-title">${esc(mediaTitle(item))}</h3>
      ${info.creator?`<p class="library-creator" data-no-i18n>${esc(info.creator)}</p>`:''}<p class="library-meta" data-no-i18n>${esc(info.subtitle)}</p>
      ${item.opinion?`<p class="m-card-opinion library-excerpt">${esc(item.opinion)}</p>`:''}
      <button type="button" class="library-more" data-library-kind="${kind}" data-library-index="${idx}">${t('View details')} <span aria-hidden="true">↗</span></button></div></article>`;
  }).join('')||`<div class="library-empty"><span aria-hidden="true">${kind==='game'?'✥':'◇'}</span><h3>${t((D[keys[kind]]||[]).length?'No results':'Nothing here yet')}</h3><p>${t((D[keys[kind]]||[]).length?'Try a different search or filter.':'Use Edit to add your first title.')}</p></div>`;
  hydrateArtwork(grid,kind,items);
}
export function openLibraryDetail(kind,idx,trigger) {
  const item=D[keys[kind]]?.[idx];if(!item)return;
  const info=libraryInfo(kind,item),mod=document.getElementById('mod'),ov=document.getElementById('ov');
  mod.classList.add('library-detail');
  mod.setAttribute('role','dialog');mod.setAttribute('aria-modal','true');mod.setAttribute('aria-labelledby','libraryDetailTitle');
  mod.innerHTML=`<div class="library-detail-top"><span class="library-status">${esc(libraryStatus(kind,info.status))}</span><button class="btn" type="button" id="libraryClose" aria-label="${t('Close')}">✕</button></div>
    <div class="library-detail-layout"><div><div class="library-poster detail-poster">${coverMarkup(kind,item)}</div><p class="library-source"></p></div><div><h2 id="libraryDetailTitle" class="m-card-title">${esc(mediaTitle(item))}</h2>
    <div class="detail-rating" style="color:${info.rating==null?'var(--text-dim)':ratingColor(info.rating*10/info.max)}">${info.rating==null?'—':F(info.rating,1)}<small>/${info.max} · ${t('My rating')}</small></div>
    <dl class="library-facts">${info.facts.map(([label,value])=>`<div><dt>${esc(t(label))}</dt><dd data-no-i18n>${esc(value)}</dd></div>`).join('')}</dl></div></div>
    ${item.opinion?`<section class="library-review"><h3>${t('My opinion')}</h3><div class="m-card-opinion">${esc(item.opinion)}</div></section>`:''}`;
  const events=new AbortController();
  const close=()=>{ov.classList.remove('open');mod.classList.remove('library-detail');mod.removeAttribute('role');mod.removeAttribute('aria-modal');mod.removeAttribute('aria-labelledby');events.abort();trigger?.focus();};
  const escape=e=>{
    if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){
      const focus=[...mod.querySelectorAll('button,a[href]')],first=focus[0],last=focus[focus.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  };
  document.getElementById('libraryClose').onclick=close;
  document.addEventListener('keydown',escape,{signal:events.signal});
  ov.addEventListener('click',e=>{if(e.target===ov)close();},{signal:events.signal});
  ov.classList.add('open');document.getElementById('libraryClose').focus();
  const poster=mod.querySelector('.detail-poster');
  loadArtwork(poster,kind,item,art=>{
    if(safeArtworkUrl(art.sourceUrl,false))mod.querySelector('.library-source').innerHTML=`<a href="${esc(art.sourceUrl)}" target="_blank" rel="noopener noreferrer">${t('Cover')}: ${{openlibrary:'Open Library',wikipedia:'Wikipedia',tvmaze:'TVmaze'}[art.provider]} ↗</a>`;
  });
}
document.addEventListener('click',e=>{
  if(e.target.closest('.tab-btn')){
    // Hidden shelves can initially intersect with zero area. Re-observe on activation.
    document.querySelectorAll('.tab-content.active .library-grid').forEach(grid=>hydrateArtwork(grid,grid.dataset.kind,grid._libraryItems||new Map()));
  }
  const button=e.target.closest('button[data-library-kind]');
  if(!button||document.body.classList.contains('edit-mode'))return;
  openLibraryDetail(button.dataset.libraryKind,Number(button.dataset.libraryIndex),button);
});
// Existing generic modals replace their contents; remove the wider detail styling too.
new MutationObserver(()=>{
  const mod=document.getElementById('mod');
  if(mod&&!mod.querySelector('#libraryDetailTitle')){mod.classList.remove('library-detail');if(mod.getAttribute('aria-labelledby')==='libraryDetailTitle'){mod.removeAttribute('role');mod.removeAttribute('aria-modal');mod.removeAttribute('aria-labelledby');}}
}).observe(document.getElementById('mod'),{childList:true});
