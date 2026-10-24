// Optional artwork metadata. No keys, account identifiers or private API proxy.
export const ARTWORK_PROVIDERS = ['wikipedia', 'openlibrary', 'tvmaze'];
const IMAGE_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org', 'covers.openlibrary.org', 'static.tvmaze.com'];
export function safeArtworkUrl(value, image = true) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
    const allowed = image ? IMAGE_HOSTS.includes(u.hostname) : ['en.wikipedia.org', 'es.wikipedia.org', 'openlibrary.org', 'www.tvmaze.com', 'tvmaze.com'].includes(u.hostname);
    return allowed ? u.href : '';
  } catch { return ''; }
}
export function validArtwork(a) {
  return a == null || a === false || (!!a && typeof a === 'object' && !Array.isArray(a) &&
    ARTWORK_PROVIDERS.includes(a.provider) && !!safeArtworkUrl(a.url) && !!safeArtworkUrl(a.sourceUrl, false) &&
    typeof a.title === 'string' && a.title.length <= 500 &&
    (a.aliases==null||(Array.isArray(a.aliases)&&a.aliases.length<=50&&a.aliases.every(x=>typeof x==='string'&&x.length<=500))) &&
    (a.automatic==null||typeof a.automatic==='boolean') &&
    (a.lookupKey==null||(typeof a.lookupKey==='string'&&a.lookupKey.length<=5000)) &&
    (a.year == null || (Number.isInteger(a.year) && a.year >= -5000 && a.year <= 3000)));
}
export function artworkTitles(item) {
  return [...new Set([item.title, item.translations?.es?.title, item.translations?.en?.title].filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))];
}
export function normalizeTitle(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/nineteen eighty[- ]four/g,'1984')
    .replace(/se7en/g,'seven').replace(/\([^)]*\)/g, '')
    .replace(/\b(ix|viii|vii|vi|iv|iii|ii|i)\b/g,n=>({ix:'9',viii:'8',vii:'7',vi:'6',iv:'4',iii:'3',ii:'2',i:'1'}[n]))
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|uno|dos|tres)\b/g,n=>({one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',uno:'1',dos:'2',tres:'3'}[n]))
    .replace(/\b(part|parte|volume|volumen|vol)\b/g,'')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|a|an|el|la|los|las|un|una) /, '').replace(/ 1$/, '');
}
export function titleSimilarity(a, b) {
  a = normalizeTitle(a); b = normalizeTitle(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if(a.replace(/ /g,'')===b.replace(/ /g,''))return .99;
  const x = new Set(a.split(' ')), y = new Set(b.split(' '));
  const numbers=s=>s.match(/\b\d+\b/g)||[];
  if(numbers(a).length&&numbers(b).length&&numbers(a).join(',')!==numbers(b).join(','))return 0;
  let score=2 * [...x].filter(t => y.has(t)).length / (x.size + y.size);
  const [short,long]=a.length<b.length?[a,b]:[b,a];
  if(short.length>=12&&short.split(' ').length>=2&&long.startsWith(short+' '))score=Math.max(score,.88);
  // Conservative typo tolerance, not a fuzzy first-result selection.
  const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}
  const edit=1-row[b.length]/Math.max(a.length,b.length);
  if(edit>=.88)score=Math.max(score,edit);
  return score;
}
export function artworkYear(kind, item) {
  const y = String(kind === 'game' ? item.releaseYear || '' : item.year || item.years || '').match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return y ? Number(y[1]) : null;
}
export function scoreArtwork(kind, item, candidate) {
  const titles = artworkTitles(item);
  let score = Math.max(0, ...titles.flatMap(t => [candidate.title,candidate.alias,...(candidate.aliases||[])].map(alias=>titleSimilarity(t,alias||''))));
  if(kind==='book')for(const title of titles){const main=title.split(':')[0].trim();if(main.length>=8&&normalizeTitle(main)===normalizeTitle(candidate.title))score=Math.max(score,.9);}
  const year = artworkYear(kind, item);
  // A remake/sequel with the wrong year must not win just because its name matches.
  if (year && candidate.year) score += year === candidate.year ? .15 : kind==='book'?-.06:kind==='serie'&&Math.abs(year-candidate.year)<=1?.02:-.55;
  if (kind === 'book' && item.author && candidate.creator) {
    const author = Math.max(...String(item.author).split(/,| & | and | y /).flatMap(a=>String(candidate.creator).split(/,| & | and | y /).map(b=>titleSimilarity(a,b))));
    score += author >= .6 ? .2 : -.25;
  }
  return score;
}
export function chooseArtwork(kind, item, candidates) {
  const ranked = candidates.filter(validArtwork).map(c => ({c, score: scoreArtwork(kind, item, c)})).sort((a,b) => b.score-a.score);
  const best = ranked[0];
  const sameBook=kind==='book'&&ranked[1]&&normalizeTitle(best?.c.title)===normalizeTitle(ranked[1].c.title)&&titleSimilarity(best?.c.creator,ranked[1].c.creator)>=.95;
  if (!best || best.score < .92 || (ranked[1] && best.score - ranked[1].score < .07 && best.c.url !== ranked[1].c.url&&!sameBook)) return null;
  return best.c;
}
export function artworkKey(kind, item) {
  return JSON.stringify([kind, artworkTitles(item).sort(), artworkYear(kind, item), kind === 'book' ? item.author || '' : '']);
}
