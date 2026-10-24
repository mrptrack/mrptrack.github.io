import { esc } from './life-schema.js';
import { t } from './i18n.js';
import { safeArtworkUrl, validArtwork, artworkTitles, artworkYear, artworkKey, chooseArtwork, scoreArtwork, titleSimilarity } from './artwork-model.js';
import { persistArtwork } from './artwork-store.js';

const CACHE_KEY = 'track_artwork_v3';
const DAY = 86400000;
let cache;
const pending = new Map();
const networkQueues=new Map();
function readCache() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { cache = {}; }
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) cache = {};
  return cache;
}
function remember(key, value) {
  const c = readCache(); c[key] = {at: Date.now(), value};
  const entries = Object.entries(c).filter(([,v]) => v && Date.now() - v.at < 30 * DAY).sort((a,b) => b[1].at-a[1].at).slice(0,500);
  cache = Object.fromEntries(entries);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* Artwork is disposable; never evict dashboard data. */ }
}
export function cachedArtwork(kind, item) {
  if (item.artwork === false) return null;
  if (item.artwork && validArtwork(item.artwork) && (!item.artwork.automatic || item.artwork.lookupKey===artworkKey(kind,item))) return item.artwork;
  const entry = readCache()[artworkKey(kind,item)];
  return entry && Date.now()-entry.at < (entry.value ? 30 : 1)*DAY && validArtwork(entry.value) ? entry.value : undefined;
}
// Serialize each provider independently: a slow book lookup cannot block a film.
function getJSON(url) {
  const host=new URL(url).hostname,key=host.endsWith('wikipedia.org')?'wikipedia':host;
  const lane=networkQueues.get(key)||{tail:Promise.resolve(),last:0};networkQueues.set(key,lane);
  const interval=host==='openlibrary.org'?1100:host==='api.tvmaze.com'?500:300;
  const job = lane.tail.catch(() => {}).then(async () => {
    const delay = Math.max(0, interval-(Date.now()-lane.last));
    if (delay) await new Promise(r => setTimeout(r, delay));
    lane.last = Date.now();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(url, {signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer'});
      if (!res.ok) throw new Error('Artwork HTTP ' + res.status);
      const json = await res.json();
      if (json.error) throw new Error('Artwork API unavailable');
      return json;
    } finally { clearTimeout(timeout); }
  });
  lane.tail = job;
  return job;
}
function wikiURL(lang, params) {
  const u = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  u.search = new URLSearchParams({action:'query', format:'json', formatversion:'2', origin:'*',
    prop:'pageimages|description|info|langlinks|pageterms', wbptterms:'label|alias', piprop:'thumbnail', pithumbsize:'420', pilicense:'any',
    inprop:'url', lllang:'en', lllimit:'max', ...params});
  return u.href;
}
const kindPattern = {book:/\bbook\b|novel|novela|libro|ensayo|treatise/i, movie:/\bfilm\b|pel[ií]cula/i, serie:/television|TV series|miniseries|serie de|serie televisiva/i, game:/video ?game|videojuego/i};
function wikiCandidate(page, aliases = []) {
  if (!safeArtworkUrl(page.thumbnail?.source)) return null;
  // Prefer a genuine poster/box over cast photographs and wide banners.
  if (page.thumbnail.width / page.thumbnail.height > 1.12) return null;
  const url = new URL(page.thumbnail.source); url.search = '';
  if(typeof aliases==='string')aliases=[aliases];
  return {provider:'wikipedia', title:page.title, aliases:[...new Set([...aliases,...(page.terms?.label||[]),...(page.terms?.alias||[])])].slice(0,30), url:url.href, sourceUrl:page.fullurl,
    year:Number(page.description?.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1] || page.title?.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1]) || null};
}
async function searchWiki(kind, item, query, lang) {
  const hint = {en:{book:'book',movie:'film',serie:'television series',game:'video game'},es:{book:'libro',movie:'película',serie:'serie de televisión',game:'videojuego'}}[lang][kind];
  const year = artworkYear(kind,item);
  const json = await getJSON(wikiURL(lang, {generator:'search', gsrsearch:`${query} ${year || ''} ${hint}`, gsrnamespace:'0', gsrlimit:'5'}));
  const pages = (json.query?.pages || []).filter(p => !/^(List of|Anexo:|Lista de)/i.test(p.title) && !/soundtrack|banda sonora|\(.*(?:album|song|canción|tema)\)|\b(?:actor|actress|actriz|compositor)\b/i.test(p.title+' '+p.description) && (kindPattern[kind].test(p.description || '') || kindPattern[kind].test(p.title || '')));
  if (lang === 'en') return pages.map(p => wikiCandidate(p)).filter(Boolean);
  // Spanish Wikipedia often has no poster. Follow its English interwiki, not a cast photo.
  const linked = pages.map(p => ({p, en:p.langlinks?.find(l => l.lang==='en')?.title})).filter(x => x.en);
  if (!linked.length) return [];
  if(kind==='serie'){
    const asCandidate=p=>({title:p.title,aliases:[...(p.terms?.label||[]),...(p.terms?.alias||[])]});
    const best=linked.sort((a,b)=>scoreArtwork(kind,item,asCandidate(b.p))-scoreArtwork(kind,item,asCandidate(a.p)))[0];
    if(scoreArtwork(kind,item,asCandidate(best.p))>=.65){
      const posters=await searchTV(best.en.replace(/\s*\([^)]*\)/g,''));
      if(posters.length)return posters.map(p=>({...p,aliases:titleSimilarity(p.title,best.en)>=.8?[best.p.title,...(best.p.terms?.label||[]),...(best.p.terms?.alias||[])]:[]}));
    }
  }
  const en = await getJSON(wikiURL('en', {titles:linked.map(x => x.en).join('|'), redirects:'1'}));
  const canonical=title=>{for(let i=0;i<4;i++){const next=[...(en.query?.normalized||[]),...(en.query?.redirects||[])].find(r=>r.from===title)?.to;if(!next)break;title=next;}return title;};
  return (en.query?.pages || []).map(p => {
    const source=linked.find(x=>canonical(x.en)===p.title)?.p;
    const aliases=source?[source.title,...(source.terms?.label||[]),...(source.terms?.alias||[])]:[];
    // Original-language article titles can hide the Spanish release title.
    // Only accept the search term as an alias when year AND creator verify it.
    if(source&&kind==='movie'&&source.index===1&&year&&String(source.description).includes(String(year))&&item.director){
      const desc=String(source.description).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const names=String(item.director).split(',').map(n=>n.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/\s+/).pop()).filter(n=>n.length>=4);
      if(names.some(n=>new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(desc)))aliases.push(query);
    }
    return wikiCandidate(p,aliases);
  }).filter(Boolean);
}
async function searchTV(query) {
  const json=await getJSON('https://api.tvmaze.com/search/shows?'+new URLSearchParams({q:query}));
  return (Array.isArray(json)?json:[]).map(x=>x.show).filter(s=>safeArtworkUrl(s?.image?.medium)).slice(0,6).map(s=>({provider:'tvmaze',title:s.name,url:s.image.medium,sourceUrl:s.url,year:Number(s.premiered?.slice(0,4))||null}));
}
async function searchBooks(item, query) {
  const u = new URL('https://openlibrary.org/search.json');
  u.search = new URLSearchParams({title:query.split(':')[0].trim(), ...(item.author ? {author:item.author.split(/,| & | and | y /)[0].trim()} : {}),
    fields:'key,title,author_name,cover_i,first_publish_year', limit:'8'});
  const json = await getJSON(u.href);
  return (json.docs || []).filter(b => Number.isInteger(b.cover_i) && b.cover_i > 0).map(b => ({provider:'openlibrary', title:b.title,
    creator:(b.author_name || []).join(', '), year:b.first_publish_year || null,
    url:`https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg?default=false`, sourceUrl:'https://openlibrary.org' + (b.key.startsWith('/') ? b.key : '/works/'+b.key)}));
}
export async function searchArtwork(kind, item, query = '', manual = false) {
  const titles = query.trim() ? [query.trim().slice(0,300)] : artworkTitles(item);
  if (!titles.length) return [];
  let results = [],failed=false;
  const attempt=async fn=>{try{return await fn();}catch{failed=true;return [];}};
  if (kind === 'book') {
    results = await attempt(()=>searchBooks(item,titles[0]));
    if (!chooseArtwork(kind,item,results) && titles[1]) results.push(...await attempt(()=>searchBooks(item,titles[1])));
    if (!chooseArtwork(kind,item,results)) results.push(...await attempt(()=>searchWiki(kind,item,titles[0],'es')));
    if (!chooseArtwork(kind,item,results)) results.push(...await attempt(()=>searchWiki(kind,item,titles.find(x=>x!==titles[0])||titles[0],'en')));
  } else {
    // English has box art; Spanish resolves localized titles through official interwiki links.
    results = await attempt(()=>kind==='serie'?searchTV(titles[0]):searchWiki(kind,item,titles[0],'en'));
    if (manual || !chooseArtwork(kind,item,results)) results.push(...await attempt(()=>searchWiki(kind,item,titles[0],'es')));
    if (!chooseArtwork(kind,item,results) && titles[1]) results.push(...await attempt(()=>searchWiki(kind,item,titles[1],'en')));
  }
  const unique=new Map();
  for(const candidate of results.filter(validArtwork)){
    const previous=unique.get(candidate.url);
    unique.set(candidate.url,previous?{...candidate,aliases:[...new Set([...(previous.aliases||[]),previous.alias,...(candidate.aliases||[]),candidate.alias].filter(Boolean))].slice(0,30)}:candidate);
  }
  const found=[...unique.values()].sort((a,b) => scoreArtwork(kind,item,b)-scoreArtwork(kind,item,a));
  if(!found.length&&failed)throw new Error('Cover service unavailable');
  found.incomplete=failed;
  return found;
}
export function resolveArtwork(kind,item) {
  const stored = cachedArtwork(kind,item);
  if (stored !== undefined) return Promise.resolve(stored);
  const key = artworkKey(kind,item);
  if (!pending.has(key)) pending.set(key, searchArtwork(kind,item).then(results => {
    const chosen = chooseArtwork(kind,item,results);
    if(!chosen&&results.incomplete)throw new Error('Cover service unavailable');
    remember(key,chosen); return chosen;
  }).finally(() => pending.delete(key)));
  return pending.get(key);
}
export function coverMarkup(kind, item) {
  const art = cachedArtwork(kind,item);
  const initials = artworkTitles(item)[0]?.split(/\s+/).slice(0,2).map(x => x[0]).join('') || '—';
  return `<span class="cover-placeholder" aria-hidden="true"><span>${esc(initials)}</span><small>${esc(t(art===null?'No cover':'Cover'))}</small></span>${art ? `<img class="library-cover" src="${esc(art.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}`;
}
const imageFallbacks=new Map();
function imageFallback(kind,item) {
  if(kind!=='book'||(item.artwork!=null&&!item.artwork.automatic))return Promise.resolve(null);
  const key=artworkKey(kind,item);
  if(!imageFallbacks.has(key))imageFallbacks.set(key,searchWiki(kind,item,artworkTitles(item)[0],'es').then(found=>{
    const art=chooseArtwork(kind,item,found);if(art)remember(key,art);return art;
  }).catch(()=>null).finally(()=>imageFallbacks.delete(key)));
  return imageFallbacks.get(key);
}
function paintArtwork(node,kind,item,art,onChange) {
  if(!node.isConnected)return;
  let img=node.querySelector('img');
  const added=!img;
  if(!img){img=document.createElement('img');img.className='library-cover';img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';}
  const failed=async()=>{
    img.remove();node.dataset.coverState='image-error';
    if(node._fallbackTried)return;
    node._fallbackTried=true;
    const alternative=await imageFallback(kind,item);
    if(alternative&&node.isConnected)paintArtwork(node,kind,item,alternative,onChange);
  };
  const loaded=()=>{node.dataset.coverState='ready';persistArtwork(kind,item,art);};
  img.onerror=failed;img.onload=loaded;
  if(added){img.src=art.url;node.append(img);}
  else if(img.complete&&img.naturalWidth)loaded();
  onChange?.(art);
}
export function loadArtwork(node,kind,item,onChange) {
  return resolveArtwork(kind,item).then(art=>{
    if(art)paintArtwork(node,kind,item,art,onChange);
    else {node.dataset.coverState='no-match';const label=node.querySelector('.cover-placeholder small');if(label)label.textContent=t('No cover');}
  }).catch(()=>{if(node.isConnected){node.dataset.coverState='unavailable';node.classList.add('cover-unavailable');}});
}
export function hydrateArtwork(root, kind, items) {
  root._artObserver?.disconnect();
  const generation=(root._artGeneration||0)+1;root._artGeneration=generation;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.dataset.coverState=entry.isIntersecting?'visible':'waiting';
      if (!entry.isIntersecting || !entry.target.closest('.tab-content.active, .library-detail')) continue;
      observer.unobserve(entry.target);
      const node = entry.target, item = items.get(Number(node.dataset.libraryIndex));
      if (!item) continue;
      node.dataset.coverState='loading';
      loadArtwork(node,kind,item);
    }
  }, {rootMargin:'1200px',threshold:.01});
  root._artObserver=observer;
  root.querySelectorAll('[data-artwork]').forEach(node => {
    if(node.querySelector('img')){
      const item=items.get(Number(node.dataset.libraryIndex)),art=item&&cachedArtwork(kind,item);
      if(art)paintArtwork(node,kind,item,art);
    }else observer.observe(node);
  });
  // Warm metadata for the rest of the open shelf, not the image files.
  // First viewport wins; stop when hidden, rerendered or data saver is enabled.
  setTimeout(async()=>{
    for(const item of items.values()){
      if(!root.isConnected||root._artGeneration!==generation||!root.closest('.tab-content.active')||document.visibilityState==='hidden'||navigator.connection?.saveData)return;
      if(cachedArtwork(kind,item)===undefined)try{await resolveArtwork(kind,item);}catch{}
      await new Promise(r=>setTimeout(r,150));
    }
  },1800);
}
// Changes are only committed by the surrounding form's Save button.
export function artworkEditor(form, kind, old, getItem) {
  let selection = old.artwork, request = 0, reset = false;
  const section = document.createElement('section'); section.className='artwork-editor'; section.dataset.noI18n='';
  section.innerHTML=`<div class="artwork-editor-head"><strong>${t('Cover')}</strong><div><button class="btn btn-sm" type="button" data-art-auto>${t('Automatic')}</button><button class="btn btn-sm" type="button" data-art-none>${t('No cover')}</button></div></div><div class="artwork-search"><input type="search" aria-label="${t('Search cover')}" placeholder="${t('Search cover')}" maxlength="300"><button class="btn" type="button" data-art-search>${t('Search')}</button></div><p class="artwork-message" role="status"></p><div class="artwork-results"></div>`;
  form.querySelector('.game-fields').after(section);
  const message=section.querySelector('.artwork-message'), results=section.querySelector('.artwork-results'), input=section.querySelector('input');
  const showSelection=()=>{
    message.textContent=selection===false?t('No cover'):selection?t('Selected cover')+': '+selection.title:t('Automatic cover lookup');
    const preview=selection===undefined&&!reset?cachedArtwork(kind,old):selection;
    results.innerHTML=preview && validArtwork(preview)?`<img class="artwork-selected" src="${esc(preview.url)}" alt="${esc(preview.title)}" referrerpolicy="no-referrer">`:'';
  };
  showSelection();
  section.querySelector('[data-art-auto]').onclick=()=>{request++;selection=undefined;reset=true;showSelection();};
  section.querySelector('[data-art-none]').onclick=()=>{request++;selection=false;showSelection();};
  async function search() {
    const id=++request, item=getItem();
    message.textContent=t('Searching covers…');results.replaceChildren();
    try {
      const found=await searchArtwork(kind,item,input.value,true);
      if(id!==request || !section.isConnected)return;
      message.textContent=t(found.length?'Choose a cover':'No matching cover. Try another title.');
      results.innerHTML=found.map((a,i)=>`<button type="button" class="artwork-option" data-cover-result="${i}"><img src="${esc(a.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${esc(a.title)}${a.year?' · '+a.year:''}</span></button>`).join('');
      results.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{selection={...found[Number(btn.dataset.coverResult)]};delete selection.automatic;delete selection.lookupKey;showSelection();});
    } catch {if(id===request && section.isConnected)message.textContent=t('Cover service unavailable. Your data is safe; try again later.');}
  }
  section.querySelector('[data-art-search]').onclick=search;
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};
  return next=>{
    if(selection===undefined) delete next.artwork; else next.artwork=selection;
    // A manual Automatic reset should also retry a previously missing match.
    if(selection===undefined&&reset){delete readCache()[artworkKey(kind,next)];try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache));}catch{}}
  };
}
