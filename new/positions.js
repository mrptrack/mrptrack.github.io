import {S,esc,num,money,pct,palette} from './core.js';

export function positionMetrics(h,q,fx,total){
 const valid=Number.isFinite(q?.price),converted=Number.isFinite(fx)&&fx>0;
 const value=valid&&converted?q.price*h.shares*fx:null,cost=converted?h.entryPrice*h.shares*fx:null;
 const profit=valid&&converted?((q.price-h.entryPrice)*h.shares+(h.dividends||0))*fx:null;
 return {value,profit,returnPercent:profit!=null&&cost>0?profit/cost*100:null,weight:value!=null&&total>0?value/total*100:null,
  dayPercent:valid&&q.prev>0?(q.price/q.prev-1)*100:null,dayChange:valid&&Number.isFinite(q.prev)?q.price-q.prev:null,
  weekPosition:valid&&Number.isFinite(q.wk52Low)&&Number.isFinite(q.wk52High)&&q.wk52High>q.wk52Low?Math.max(0,Math.min(100,(q.price-q.wk52Low)/(q.wk52High-q.wk52Low)*100)):null};
}
const tone=v=>v==null?'muted':v<0?'negative':'positive';
const signed=(v,format)=>(v>0?'+':'')+format(v);
const price=(v,c)=>Number.isFinite(v)?`${num(v,2)} <small>${esc(c)}</small>`:'—';
const shares=v=>v.toLocaleString(S.ui.language==='en'?'en-GB':'es-ES');

export function positionCard(h,q,total,index=0){
 const m=positionMetrics(h,q,h.currency==='EUR'?1:S.rates?.[h.currency],total),valid=Number.isFinite(q?.price);
 const range=Number.isFinite(q?.low)&&Number.isFinite(q?.high)?`<span class="position-day-range">${num(q.low,2)} – ${num(q.high,2)}</span>`:'';
 const fundamentals=[q?.pe?`<span>P/E ${num(q.pe,1)}</span>`:'',q?.divYield?`<span>Yield ${num(q.divYield,2)}%</span>`:''].join('');
 const field=(key,label,value,cls='')=>`<div data-position-field="${key}"><dt>${label}</dt><dd class="${cls}">${value}</dd></div>`;
 return `<article class="panel position-card" data-action="position" data-ticker="${esc(h.ticker)}" aria-label="${esc(h.name||h.ticker)}">
  <div class="position-card-top"><div class="position-identity"><button type="button" class="company-cell position-open" data-action="position" data-ticker="${esc(h.ticker)}"><span class="ticker-mark" style="--stock:${h.color||palette[index%palette.length]}">${esc(h.ticker.split('.')[0].slice(0,3))}</span><span class="position-company"><span class="position-symbol">${esc(h.ticker)} ${h.exchange?`<span class="position-exchange">${esc(h.exchange)}</span>`:''}</span><b>${esc(h.name)}</b></span></button><div class="position-quote">${price(q?.price,h.currency)}</div>${q?.stale?'<span class="position-data-status">ANTIGUO</span>':valid?'':'<span class="position-data-status">SIN DATOS</span>'}</div>
  <div class="position-daily" data-label="Cambio diario"><span>Diario</span><b class="${tone(m.dayPercent)}">${pct(m.dayPercent,2)}</b><small class="${tone(m.dayChange)}">${m.dayChange==null?'—':signed(m.dayChange,v=>num(v,2))+' '+esc(h.currency)}</small>${valid?range:''}</div></div>
  ${m.weekPosition==null?'':`<div class="position-week-range" aria-label="Rango de 52 semanas"><span>${num(q.wk52Low,2)}</span><i><b style="width:${m.weekPosition}%"></b></i><span>${num(q.wk52High,2)}</span></div>`}${fundamentals?`<div class="position-fundamentals">${fundamentals}</div>`:''}
  <dl class="position-metrics">${field('shares','Acciones',shares(h.shares))}${field('value','Valor (EUR)',money(m.value,2),valid?'positive':'')}${field('dividends',`Dividendos (${esc(h.currency)})`,h.dividends>0?'+'+price(h.dividends,h.currency):'—',h.dividends>0?'positive':'')}${field('weight','% de cartera',m.weight==null?'—':num(m.weight,1)+'%')}${field('average','Precio medio',price(h.entryPrice,h.currency))}${field('return','Rentabilidad total',m.returnPercent==null?'—':`${pct(m.returnPercent,2)} <small>(${signed(m.profit,v=>money(v,2))})</small>`,tone(m.profit))}</dl>
 </article>`;
}
