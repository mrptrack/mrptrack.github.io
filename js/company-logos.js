import {D} from './state.js';
import {COMPANY_LOGOS} from './company-logo-catalog.js';

const normalName=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const byTicker=new Map(),byName=new Map();
for(const company of COMPANY_LOGOS){for(const ticker of company.tickers||[])byTicker.set(ticker.toUpperCase(),company);for(const name of [company.name,...company.names||[]])byName.set(normalName(name),company);}
export function companyLogo(ticker,name){return byTicker.get(String(ticker||'').trim().toUpperCase())||byName.get(normalName(name))||null;}
// Keep decoded image nodes when a quote refresh replaces the surrounding cards.
const logoImages=new Map();
function imageFor(company){
 let images=logoImages.get(company.file);if(!images)logoImages.set(company.file,images=new Set());
 for(const img of images)if(!img.isConnected)return img;
 const img=document.createElement('img');img.alt='';img.width=40;img.height=40;img.decoding='sync';img.loading='eager';
 img.addEventListener('load',()=>img.parentElement?.classList.add('logo-loaded'),{once:true});
 img.addEventListener('error',()=>{images.delete(img);img.remove();},{once:true});
 images.add(img);img.src=new URL('../icons/companies/'+company.file,import.meta.url).href;return img;
}
function badge(ticker,name,size=''){
 const company=companyLogo(ticker,name),mark=document.createElement('span');mark.className='company-logo '+size;mark.dataset.companyLogo='';mark.setAttribute('aria-hidden','true');mark.setAttribute('data-no-i18n','');
 const fallback=document.createElement('span');fallback.className='company-initials';fallback.textContent=String(ticker||name||'?').split('.')[0].replace(/[^\p{L}\p{N}]/gu,'').slice(0,3).toUpperCase();mark.append(fallback);
 if(company?.file){const img=imageFor(company);mark.style.setProperty('--logo-bg',company.background||'#fff');mark.append(img);if(img.complete&&img.naturalWidth>0)mark.classList.add('logo-loaded');}
 return mark;
}
function label(cell,ticker,name){const wrap=document.createElement('span'),text=document.createElement('span');wrap.className='company-label';text.className='company-label-text';while(cell.firstChild)text.append(cell.firstChild);wrap.append(badge(ticker,name,'company-logo-small'),text);cell.append(wrap);cell.dataset.companyDecorated='';}
export function hydrateCompanyLogos(){
 for(const stock of document.querySelectorAll('.stock:not([data-company-decorated])')){
  stock.dataset.companyDecorated='';const tk=stock.querySelector('.s-tk'),nm=stock.querySelector('.s-nm');if(!tk||!nm)continue;
  const ticker=[...tk.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(['CASH','EFECTIVO'].includes(ticker)||stock.dataset.editType==='cash')continue;
  const heading=document.createElement('div'),text=document.createElement('div');heading.className='company-heading';text.className='company-heading-text';tk.before(heading);heading.append(badge(ticker,nm.textContent));text.append(tk,nm);heading.append(text);
 }
 for(const row of document.querySelectorAll('#wlBody tr:not([data-company-decorated])')){row.dataset.companyDecorated='';const item=D.watchlist?.[+row.dataset.wlIdx],cell=row.cells[0];if(cell)label(cell,item?.ticker,item?.name||cell.firstChild?.textContent?.trim());}
 for(const row of document.querySelectorAll('#tradesTable tr[data-trade-idx]:not([data-company-decorated])')){row.dataset.companyDecorated='';const item=D.closedTrades?.[+row.dataset.tradeIdx];if(row.cells[1])label(row.cells[1],item?.ticker||row.cells[0].textContent,item?.name||row.cells[1].textContent);}
 for(const marker of document.querySelectorAll('.ticker-mark:not([data-company-logo])')){
  const host=marker.closest('[data-ticker]'),ticker=host?.dataset.ticker||marker.textContent,name=host?.querySelector('.company-cell b,b')?.textContent;
  const mark=badge(ticker,name);mark.classList.add('ticker-mark');marker.replaceWith(mark);
 }
 for(const card of document.querySelectorAll('.watch-card:not([data-company-decorated])')){card.dataset.companyDecorated='';const pill=card.querySelector('.ticker-pill');if(!pill)continue;const wrap=document.createElement('span');wrap.className='company-watch-identity';pill.before(wrap);wrap.append(badge(pill.textContent,card.querySelector('h3')?.textContent,'company-logo-small'),pill);}
 for(const row of document.querySelectorAll('tr[data-action="trade"]:not([data-company-decorated])')){row.dataset.companyDecorated='';const cell=row.cells[0];if(cell)label(cell,cell.querySelector('small')?.textContent.split(' · ')[0],cell.querySelector('b')?.textContent);}
 for(const dialog of document.querySelectorAll('dialog:not([data-company-decorated])')){if(!dialog.querySelector('.position-price'))continue;dialog.dataset.companyDecorated='';const h=dialog.querySelector('h2');if(h){h.classList.add('company-detail-title');h.prepend(badge(dialog.querySelector('.eyebrow')?.textContent.split(' · ')[0],h.textContent));}}
}
// MutationObserver runs before paint: avoid a frame of bare tickers after each render.
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrateCompanyLogos,{once:true});else hydrateCompanyLogos();
new MutationObserver(hydrateCompanyLogos).observe(document.documentElement,{childList:true,subtree:true});
