export const WATCH_PRICE_TTL=10*60*1000;
export function normalizeWatchQuote(result,updatedAt){
 const m=result?.meta;if(!m)return null;
 const pence=['GBp','GBX','GBx'].includes(m.currency),scale=pence?100:1;
 const price=m.regularMarketPrice/scale,prev=(m.chartPreviousClose||m.previousClose)/scale;
 if(!Number.isFinite(price)||price<=0)return null;
 return {price,prev:Number.isFinite(prev)?prev:null,currency:pence?'GBP':m.currency,updatedAt};
}
export function watchRows(items,quotes){
 return items.map((x,i)=>{
  const q=quotes[x.ticker],hasPrice=Number.isFinite(q?.price)&&q.price>0,compatible=!q?.currency||q.currency===x.currency;
  const price=hasPrice?q.price:null,distPct=hasPrice&&compatible&&Number.isFinite(x.targetPrice)&&x.targetPrice>0?(price/x.targetPrice-1)*100:null;
  return {x,i,price,currency:q?.currency||x.currency,distPct,hit:distPct!=null&&distPct<=0,pinned:/berkshire/i.test(x.name||'')||/^BRK[-.][AB]$/i.test(x.ticker),updatedAt:q?.updatedAt||null};
 }).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(a.distPct??Infinity)-(b.distPct??Infinity)||a.i-b.i);
}
