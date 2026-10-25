import {brokerName,holdingAllocations,setHoldingAllocations,buyAtBroker,sellAtBroker,prepareBrokerMovement,prepareBrokerCashEdit,validateBrokers} from './broker-model.js';
import {validateData} from './data-validation.js';
export const FINANCE_FIELDS=['holdings','cash','totalInvested','closedTrades','brokers','history'];
export const financeRevision=state=>JSON.stringify(FINANCE_FIELDS.map(k=>k==='history'?[...(state.history||[])].sort((a,b)=>a.date.localeCompare(b.date)):state[k]));
export const financeIdentity=state=>JSON.stringify(FINANCE_FIELDS.filter(k=>k!=='history').map(k=>state[k]));
const finite=(v,min=0)=>typeof v==='number'&&Number.isFinite(v)&&v>=min;
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const fail=message=>{throw Error(message);};
export function financeEdit(current,operation,v={},fx={EUR:1}){
 const next=structuredClone(current);for(const k of ['holdings','closedTrades','brokers','history'])next[k]??=[];
 const index=()=>{const i=next.holdings.findIndex(h=>h.ticker===v.ticker);if(i<0)fail('La posición ha cambiado. Vuelve a abrirla.');return i;};
 if(operation==='position-save'){
  const old=v.originalTicker?next.holdings.find(h=>h.ticker===v.originalTicker):null;
  if(v.originalTicker&&!old)fail('La posición ha cambiado.');
  const h={...(old||{}),...v.position};h.ticker=String(h.ticker||'').trim().toUpperCase();
  if(next.holdings.some(x=>x!==old&&x.ticker===h.ticker))fail('Ese ticker ya existe. Registra una compra para ampliar la posición.');
  if(h.buyDate&&!iso(h.buyDate))fail('Fecha de compra no válida.');
  if(Array.isArray(v.allocations))Object.assign(h,setHoldingAllocations(h,v.allocations));
  if(old)next.holdings[next.holdings.indexOf(old)]=h;else next.holdings.push(h);
 }else if(operation==='position-buy'){
  const p=v.position||{},ticker=String(p.ticker||'').trim().toUpperCase(),old=next.holdings.find(h=>h.ticker===ticker),shares=p.shares,price=p.entryPrice;
  if(!finite(shares,Number.MIN_VALUE)||!finite(price,Number.MIN_VALUE)||!finite(fx[p.currency],Number.MIN_VALUE))fail('Cantidad, precio o divisa no válidos.');
  if(old&&old.currency!==p.currency)fail('La compra debe usar la divisa de la posición.');
  const cost=shares*price*fx[p.currency];let brokerCash=!!v.useCash;
  if(brokerCash&&!next.brokers.length){if(next.cash+.005<cost)fail('No hay suficiente efectivo.');next.cash=Math.round((next.cash-cost)*100)/100;brokerCash=false;}
  const base=old||{...p,ticker,shares:0,brokerAllocations:[]},h=buyAtBroker(next,base,shares,cost,v.broker,brokerCash);
  h.entryPrice=old?(old.shares*old.entryPrice+shares*price)/h.shares:price;
  if(old)next.holdings[next.holdings.indexOf(old)]=h;else next.holdings.push({...p,...h,ticker});
 }else if(operation==='position-sell'){
  const i=index(),h=next.holdings[i];if(!finite(v.price,Number.MIN_VALUE)||!iso(v.date)||!finite(fx[h.currency],Number.MIN_VALUE))fail('Precio, fecha o divisa no válidos.');
  const proceeds=v.proceedsEUR??v.price*v.shares*fx[h.currency];
  const remaining=sellAtBroker(next,h,v.shares,v.broker,proceeds);
  next.closedTrades.push({ticker:h.ticker,name:h.name,currency:h.currency,color:h.color,totalShares:v.shares,avgBuy:h.entryPrice,buyDate:h.buyDate||'',sellPrice:v.price,sellDate:v.date,dividends:v.shares===h.shares?h.dividends||0:0,lots:v.lots||'',sector:h.sector||'',broker:brokerName(v.broker),proceedsEUR:proceeds});
  if(remaining.shares>0)next.holdings[i]=remaining;else next.holdings.splice(i,1);
 }else if(operation==='position-delete')next.holdings.splice(index(),1);
 else if(operation==='cash-save'){
  if(next.brokers.length)Object.assign(next,prepareBrokerCashEdit(next,v));
  else{if(!finite(v.cash)||!finite(v.totalInvested))fail('Efectivo o aportaciones no válidos.');next.cash=v.cash;next.totalInvested=v.totalInvested;}
 }else if(operation==='broker-movement')Object.assign(next,prepareBrokerMovement(next,v));
 else if(operation==='brokers-save'){
  if(!Array.isArray(v.brokers))fail('Brokers no válidos.');const errors=validateBrokers(v.brokers,next.holdings);if(errors.length)fail(errors[0]);
  const renames=new Map(v.brokers.filter(b=>b.originalName&&brokerName(b.originalName)!==brokerName(b.name)).map(b=>[brokerName(b.originalName),brokerName(b.name)]));
  next.holdings=next.holdings.map(h=>{const allocations=holdingAllocations(h);return allocations.some(a=>renames.has(a.broker))?setHoldingAllocations(h,allocations.map(a=>({...a,broker:renames.get(a.broker)||a.broker}))):h;});
  next.closedTrades=next.closedTrades.map(t=>renames.has(brokerName(t.broker))?{...t,broker:renames.get(brokerName(t.broker))}:t);
  if(v.brokers.reduce((s,b)=>s+b.cash,0)>next.cash+.01)fail('El efectivo asignado supera el efectivo total. Ajusta el efectivo desde Cartera.');
  const names=new Set(v.brokers.map(b=>brokerName(b.name)));if(next.holdings.some(h=>holdingAllocations(h).some(a=>!names.has(a.broker))))fail('Hay posiciones asignadas a un broker eliminado. Corrige primero su reparto.');
  next.brokers=v.brokers.map(b=>{const prior=current.brokers?.find(x=>brokerName(x.name)===brokerName(b.originalName||b.name))||{},item={...prior,...b,name:brokerName(b.name)};delete item.originalName;return item;});
 }else if(operation==='trade-save'){
  const trade={...(v.index==null?{}:next.closedTrades[v.index]),...v.trade};if(v.index!=null&&!next.closedTrades[v.index])fail('La operación ha cambiado.');
  trade.ticker=String(trade.ticker||'').trim().toUpperCase();if(!finite(trade.dividends??0))fail('Dividendos no válidos.');
  for(const k of ['buyDate','sellDate'])if(trade[k]&&!iso(trade[k]))fail('Fecha no válida.');if(trade.buyDate&&trade.sellDate&&trade.buyDate>trade.sellDate)fail('La compra no puede ser posterior a la venta.');
  if(v.index==null)next.closedTrades.push(trade);else next.closedTrades[v.index]=trade;
 }else if(operation==='trade-delete'){if(!next.closedTrades[v.index])fail('La operación ha cambiado.');next.closedTrades.splice(v.index,1);}
 else if(operation==='history-save'){
  if(!iso(v.entry?.date)||!finite(v.entry.totalValue)||!finite(v.entry.totalInvested))fail('Registro histórico no válido.');
  if(v.entry.date!==v.originalDate&&next.history.some(h=>h.date===v.entry.date))fail('Ya hay un cierre en esa fecha. Abre ese registro para editarlo.');
  next.history=next.history.filter(h=>h.date!==v.originalDate&&h.date!==v.entry.date);next.history.push(v.entry);next.history.sort((a,b)=>a.date.localeCompare(b.date));
 }else if(operation==='history-delete')next.history=next.history.filter(h=>h.date!==v.date);
 else fail('Acción no disponible.');
 const checked=validateData(next,{});if(!checked.ok)fail(checked.errors[0]);
 for(const h of next.holdings){if(h.buyDate&&!iso(h.buyDate))fail('Fecha de compra no válida.');if(!finite(h.dividends??0))fail('Dividendos no válidos.');}
 return {next,fields:FINANCE_FIELDS.filter(k=>JSON.stringify(current[k])!==JSON.stringify(next[k]))};
}
