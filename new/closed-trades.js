import {S,esc,num,money,pct,date} from './core.js';
import {btn,sectionHead,empty} from './ui.js';
import {calculateTrade} from '../js/trade-model.js';
import {TRADE_FX} from '../js/config.js';

// Use the same historical EUR conversion and dividend treatment as Classic.
export const tradeResult=t=>calculateTrade(t,t.currency==='JPY'?(S.rates?.JPY||TRADE_FX.JPY||1):(TRADE_FX[t.currency]||1));
const signed=v=>(v>0?'+':'')+money(v,2);
const tone=v=>v<0?'negative':'positive';
const tick=v=>Math.abs(v)>=1000?num(v/1000,0)+'k €':money(v);

function tradeChart(rows,capital=false){
 const W=Math.max(480,rows.length*67+76),H=250,L=65,R=12,T=15,B=35,pw=W-L-R,ph=H-T-B;
 const values=rows.flatMap(r=>capital?[r.result.inv,r.result.ret]:[r.result.net]);
 const max=Math.max(0,...values)*1.08||1,min=Math.min(0,...values)*1.08,span=max-min;
 const y=v=>T+(max-v)/span*ph,zero=y(0),slot=pw/rows.length;
 const grid=Array.from({length:4},(_,i)=>{const v=min+span*i/3;return `<line class="chart-grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-axis" x="${L-9}" y="${y(v)+4}" text-anchor="end">${esc(tick(v))}</text>`;}).join('');
 const bars=rows.map(({trade:t,index,result:r},i)=>{
  const cx=L+slot*(i+.5),width=Math.min(capital?15:29,slot*.36);
  const bar=(value,x,color,label)=>`<rect class="closed-chart-bar" data-action="trade" data-index="${index}" tabindex="0" role="button" aria-label="${esc(t.name||t.ticker)}: ${esc(label)} ${esc(money(value,2))}" x="${x}" y="${Math.min(zero,y(value))}" width="${width}" height="${Math.max(1,Math.abs(y(value)-zero))}" rx="3" fill="${color}"><title>${esc(t.ticker+' · '+label+': '+money(value,2))}</title></rect>`;
  return (capital?bar(r.inv,cx-width-2,'var(--soft)','Invertido')+bar(r.ret,cx+2,'var(--green)','Recuperado'):bar(r.net,cx-width/2,r.net<0?'var(--red)':'var(--green)','Resultado neto'))+`<text class="chart-axis closed-chart-label" x="${cx}" y="${H-12}" text-anchor="middle">${esc(t.ticker)}</text>`;
 }).join('');
 return `<div class="closed-chart-scroll" tabindex="0" aria-label="${capital?'Capital invertido y recuperado':'Resultado neto por operación'}"><svg style="min-width:${W}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="${capital?'Capital invertido frente al recuperado, incluidos dividendos':'Beneficio o pérdida neta por operación en euros'}">${grid}<line x1="${L}" x2="${W-R}" y1="${zero}" y2="${zero}" stroke="var(--muted)" stroke-width="1"/>${bars}</svg></div>`;
}

export function tradesView(){
 const rows=S.data.closedTrades.map((trade,index)=>({trade,index,result:tradeResult(trade)}));
 if(!rows.length)return `<section class="panel">${sectionHead('Operaciones cerradas','',btn('+ Añadir operación','trade-editor'))}${empty('Sin operaciones cerradas','')}</section>`;
 const total=rows.reduce((sum,{result:r})=>({inv:sum.inv+r.inv,grossPL:sum.grossPL+r.grossPL,divN:sum.divN+r.divN,net:sum.net+r.net}),{inv:0,grossPL:0,divN:0,net:0});
 const ranked=[...rows].sort((a,b)=>b.result.net-a.result.net);
 return `<div class="closed-summary"><div><span>Capital invertido</span><b>${money(total.inv,2)}</b></div><div><span>Resultado neto</span><b class="${tone(total.net)}">${signed(total.net)}</b></div><div><span>Rentabilidad neta</span><b class="${tone(total.net)}">${pct(total.inv?total.net/total.inv*100:null,2)}</b></div></div>
 <div class="closed-charts"><section class="panel">${sectionHead('Resultado por operación','')}${tradeChart(ranked)}</section><section class="panel">${sectionHead('Invertido y recuperado','')}${tradeChart(ranked,true)}<div class="chart-legend"><span><i class="dot" style="background:var(--soft)"></i>Invertido</span><span><i class="dot" style="background:var(--green)"></i>Recuperado</span></div></section></div>
 <section class="panel table-panel closed-table-panel">${sectionHead('Operaciones cerradas','',btn('+ Añadir operación','trade-editor'))}<div class="closed-table-scroll" tabindex="0" aria-label="Tabla de operaciones cerradas"><table class="closed-trades-table"><thead><tr><th>Compañía</th><th>Neto</th><th>Rentabilidad</th><th>Acciones</th><th>Compra media</th><th>Venta</th><th>Comprada</th><th>Vendida</th><th>Broker</th><th>Invertido</th><th>Bruto</th><th>Dividendos</th></tr></thead><tbody>${rows.map(({trade:t,index,result:r})=>`<tr data-action="trade" data-index="${index}" tabindex="0"><td><b>${esc(t.name||t.ticker)}</b><small>${esc(t.ticker)} · ${esc(t.currency)}</small></td><td class="${tone(r.net)}"><b>${signed(r.net)}</b></td><td class="${tone(r.net)}">${pct(r.pct,2)}</td><td>${num(t.totalShares,Number.isInteger(t.totalShares)?0:4)}</td><td>${num(t.avgBuy,2)} ${esc(t.currency)}</td><td>${num(t.sellPrice,2)} ${esc(t.currency)}</td><td>${t.buyDate?date(t.buyDate,{day:'numeric',month:'short',year:'2-digit'}):'—'}</td><td>${t.sellDate?date(t.sellDate,{day:'numeric',month:'short',year:'2-digit'}):'—'}</td><td>${esc(t.broker||'—')}</td><td>${money(r.inv,2)}</td><td class="${tone(r.grossPL)}">${signed(r.grossPL)}</td><td>${r.divN?money(r.divN,2):'—'}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="${tone(total.net)}">${signed(total.net)}</td><td class="${tone(total.net)}">${pct(total.inv?total.net/total.inv*100:null,2)}</td><td colspan="6"></td><td>${money(total.inv,2)}</td><td class="${tone(total.grossPL)}">${signed(total.grossPL)}</td><td>${money(total.divN,2)}</td></tr></tfoot></table></div></section>`;
}
