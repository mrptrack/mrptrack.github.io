// Broker bookkeeping is separate from portfolio contributions/history. All amounts are EUR.
export function brokerName(value) {
  const name = String(value || '').trim();
  const key = name.toLowerCase().replace(/[\s_.-]/g, '');
  const aliases={ibkr:'IBKR', interactivebrokers:'IBKR', trading212:'Trading212', degiro:'Degiro', xtb:'XTB'};
  return Object.hasOwn(aliases,key)?aliases[key]:name;
}
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
const nonNegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const same = (a,b) => Math.abs(a-b) < 1e-7 * Math.max(1,a,b);
export function holdingAllocations(holding) {
  if (Array.isArray(holding.brokerAllocations)) return holding.brokerAllocations.map(a => ({broker:brokerName(a.broker), shares:a.shares}));
  return holding.broker ? [{broker:brokerName(holding.broker), shares:holding.shares}] : [];
}
export function setHoldingAllocations(holding, allocations) {
  const rows = allocations.filter(a=>a.shares>0).map(a=>({broker:brokerName(a.broker),shares:a.shares}));
  return {...holding, broker:rows.length===1?rows[0].broker:'', brokerAllocations:rows};
}
export function validateBrokers(brokers, holdings=[]) {
  const errors=[];
  if (!Array.isArray(brokers)) return ['brokers: expected an array'];
  const names=new Set();
  for (const b of brokers) {
    if (!b || typeof b!=='object' || typeof b.name!=='string' || !b.name.trim() || b.name.length>60) { errors.push('Invalid broker name'); continue; }
    const name=brokerName(b.name).toLowerCase();
    if (names.has(name)) errors.push('Duplicate broker: '+b.name);
    names.add(name);
    if (!['deposits','withdrawals','cash'].every(k=>nonNegative(b[k]))) errors.push('Invalid EUR balances: '+b.name);
  }
  for (const h of holdings) {
    if (h?.brokerAllocations===undefined) continue;
    if (!Array.isArray(h.brokerAllocations)) { errors.push('Invalid broker allocations: '+h.ticker); continue; }
    const seen=new Set();let sum=0;
    for (const a of h.brokerAllocations) {
      if (!a || typeof a.broker!=='string' || !brokerName(a.broker) || !nonNegative(a.shares) || a.shares===0 || a.broker.length>60) { errors.push('Invalid allocation: '+h.ticker); continue; }
      const name=brokerName(a.broker).toLowerCase();
      if (seen.has(name)) errors.push('Duplicate allocation: '+h.ticker);
      seen.add(name);sum+=a.shares;
    }
    if (h.brokerAllocations.length && !same(sum,h.shares)) errors.push('Allocation shares do not match position: '+h.ticker);
  }
  return errors;
}
export function brokerSummary(holdings, brokers, valueFor, globalCash=0) {
  const rows=new Map();
  const get=name=>{name=brokerName(name)||'';if(!rows.has(name))rows.set(name,{name,deposits:null,withdrawals:null,cash:0,stocks:0,positions:[],missing:false});return rows.get(name);};
  for (const b of brokers||[]) Object.assign(get(b.name),{deposits:b.deposits,withdrawals:b.withdrawals,cash:b.cash});
  for (const h of holdings||[]) {
    const allocations=holdingAllocations(h);
    const assigned=allocations.reduce((sum,a)=>sum+a.shares,0);
    if (assigned<h.shares && !same(assigned,h.shares)) allocations.push({broker:'',shares:h.shares-assigned});
    const total=valueFor(h);
    for(const a of allocations) {
      const row=get(a.broker);
      if (!Number.isFinite(total)) row.missing=true;
      else row.stocks+=total*a.shares/h.shares;
      row.positions.push({ticker:h.ticker,shares:a.shares});
    }
  }
  const allocatedCash=(brokers||[]).reduce((sum,b)=>sum+b.cash,0);
  if (globalCash>allocatedCash+0.005) get('').cash=money(globalCash-allocatedCash);
  return [...rows.values()].map(row=>({...row,current:row.missing?null:money(row.stocks+row.cash),
    profit:row.missing || row.deposits===null?null:money(row.stocks+row.cash+row.withdrawals-row.deposits)}));
}
export function editBrokerPosition(holding, shares, name) {
  const allocations=holdingAllocations(holding);
  if (allocations.length>1) {
    if (!same(holding.shares,shares)) throw new Error('Edit the share split in Analytics → Brokers.');
    if (name && brokerName(name)!==brokerName(holding.broker)) throw new Error('Edit the broker split in Analytics → Brokers.');
    return holding;
  }
  return setHoldingAllocations(holding,brokerName(name)?[{broker:brokerName(name),shares}]:[]);
}
export function buyAtBroker(state, holding, shares, priceEur, name, useCash) {
  if(!Number.isFinite(shares)||shares<=0 || !nonNegative(priceEur)) throw new Error('Invalid purchase');
  name=brokerName(name);
  const account=(state.brokers||[]).find(b=>brokerName(b.name)===name);
  if(name && (state.brokers||[]).length && !account) throw new Error('Configure this broker in Analytics first.');
  if(useCash && (!account || account.cash+0.005<priceEur || state.cash+0.005<priceEur)) throw new Error('Not enough broker cash. Record the deposit or untick Pay from broker cash for a position correction.');
  const allocations=holdingAllocations(holding);
  if(name){const lot=allocations.find(a=>a.broker===name);if(lot)lot.shares+=shares;else allocations.push({broker:name,shares});}
  // Preserve an entirely unassigned legacy position without inventing its broker.
  const allocated=allocations.reduce((sum,a)=>sum+a.shares,0);
  const updated={...holding,shares:holding.shares+shares};
  if(allocations.length && !same(allocated,updated.shares)) throw new Error('Assign the existing position to brokers in Analytics first.');
  if(useCash){account.cash=money(account.cash-priceEur);state.cash=money(state.cash-priceEur);}
  return setHoldingAllocations(updated,allocations);
}
export function sellAtBroker(state, holding, shares, name, proceedsEur) {
  if(!Number.isFinite(shares)||shares<=0||shares>holding.shares || !nonNegative(proceedsEur)) throw new Error('Invalid sale');
  const allocations=holdingAllocations(holding);name=brokerName(name);
  let account;
  if(allocations.length){
    const lot=allocations.find(a=>a.broker===name);
    if(!lot || shares>lot.shares+1e-7) throw new Error('Select the selling broker and its available shares.');
    lot.shares=Math.max(0,lot.shares-shares);
    account=(state.brokers||[]).find(b=>brokerName(b.name)===name);
    if((state.brokers||[]).length && !account) throw new Error('Configure this broker in Analytics first.');
  }
  if(account)account.cash=money(account.cash+proceedsEur);
  state.cash=money((state.cash||0)+proceedsEur);
  return setHoldingAllocations({...holding,shares:holding.shares-shares},allocations);
}
export function prepareBrokerSetup(state, setup) {
  if(!setup || setup.format!=='trackcmg-brokers' || !Array.isArray(setup.positions)) throw new Error('Invalid broker setup file');
  const brokers=structuredClone(setup.brokers),holdings=structuredClone(state.holdings),seen=new Set();
  for(const position of setup.positions){
    if(!position || typeof position.ticker!=='string' || seen.has(position.ticker)) throw new Error('Invalid or duplicate ticker');
    seen.add(position.ticker);
    const matches=holdings.filter(h=>h.ticker===position.ticker);
    if(matches.length!==1 || !nonNegative(position.shares) || position.shares===0 || !Array.isArray(position.brokerAllocations) || !position.brokerAllocations.length) throw new Error('Position not found or invalid: '+position.ticker);
    Object.assign(matches[0],setHoldingAllocations({...matches[0],shares:position.shares},position.brokerAllocations));
  }
  const errors=validateBrokers(brokers,holdings);
  if(errors.length)throw new Error(errors.join('\n'));
  const names=new Set(brokers.map(b=>brokerName(b.name)));
  if(holdings.some(h=>holdingAllocations(h).some(a=>!names.has(a.broker)))) throw new Error('Unknown broker in position split');
  const sum=brokers.reduce((n,b)=>n+b.cash,0);
  if(sum>(state.cash||0)+0.01) throw new Error('Broker cash exceeds portfolio cash. This file never changes your total cash.');
  return {brokers,holdings};
}

// Pure, atomic cash operations. A transfer is not a new portfolio contribution.
export function prepareBrokerMovement(state, movement) {
  if(!movement || !['deposit','withdrawal','transfer'].includes(movement.kind) || !nonNegative(movement.amount) || movement.amount===0) throw new Error('Invalid broker movement');
  const brokers=structuredClone(state.brokers||[]);
  if(validateBrokers(brokers).length || !nonNegative(state.cash) || !nonNegative(state.totalInvested)) throw new Error('Invalid portfolio balances');
  const amount=money(movement.amount);
  if(amount<=0)throw new Error('Enter at least 0.01 EUR');
  const account=brokers.find(b=>brokerName(b.name)===brokerName(movement.broker));
  if(!account)throw new Error('Select a broker');
  let cash=state.cash,totalInvested=state.totalInvested;
  if(movement.kind==='deposit') {
    account.deposits=money(account.deposits+amount);account.cash=money(account.cash+amount);
    cash=money(cash+amount);totalInvested=money(totalInvested+amount);
  } else {
    if(account.cash+0.005<amount || cash+0.005<amount)throw new Error('Not enough broker cash');
    if(movement.kind==='transfer') {
      const target=brokers.find(b=>brokerName(b.name)===brokerName(movement.toBroker));
      if(!target || target===account)throw new Error('Select a different destination broker');
      target.deposits=money(target.deposits+amount);target.cash=money(target.cash+amount);
    } else {
      if(totalInvested+0.005<amount)throw new Error('Withdrawal exceeds total invested');
      cash=money(cash-amount);totalInvested=money(totalInvested-amount);
    }
    account.withdrawals=money(account.withdrawals+amount);account.cash=money(account.cash-amount);
  }
  return {brokers,cash,totalInvested};
}

export function prepareBrokerCashEdit(state, edit) {
  if(!edit || !Array.isArray(edit.allocations) || !nonNegative(edit.unassignedCash) || !nonNegative(edit.totalInvested))throw new Error('Invalid cash balances');
  const brokers=structuredClone(state.brokers||[]),seen=new Set();
  if(validateBrokers(brokers).length || !nonNegative(state.totalInvested))throw new Error('Invalid broker balances');
  let cash=edit.unassignedCash;
  for(const row of edit.allocations) {
    const name=brokerName(row.name),account=brokers.find(b=>brokerName(b.name)===name);
    if(!account || seen.has(name) || !nonNegative(row.cash))throw new Error('Invalid broker cash allocation');
    seen.add(name);account.cash=money(row.cash);cash+=account.cash;
  }
  if(seen.size!==brokers.length)throw new Error('Allocate cash for every broker');
  const delta=money(edit.totalInvested-state.totalInvested);
  if(delta!==0) {
    const account=brokers.find(b=>brokerName(b.name)===brokerName(edit.investmentBroker));
    if(!account)throw new Error('Select the broker for the invested-capital change');
    if(delta>0)account.deposits=money(account.deposits+delta);
    else account.withdrawals=money(account.withdrawals-delta);
  }
  return {brokers,cash:money(cash),totalInvested:money(edit.totalInvested)};
}

export function brokerSnapshotPatch(state,valueFor,date) {
  let total=state.cash||0;
  for(const h of state.holdings||[]) {
    const value=valueFor(h);
    if(!Number.isFinite(value))return {};
    total+=value;
  }
  const entry={date,totalValue:money(total),totalInvested:state.totalInvested};
  return {history:[...(state.history||[]).filter(h=>h.date!==date),entry].sort((a,b)=>a.date.localeCompare(b.date))};
}
