// The layout is a per-browser preference; it never changes the finance JSON.
export const normalizeLayout = value => value === 'new' ? 'new' : 'classic';
export const editableFields = ['books','movies','series','games','workouts','activities','watchlist','gym'];
export function validMeasurements(rows){
 if(!Array.isArray(rows)||rows.length>10000)return false;const dates=new Set();
 return rows.every(row=>{
  if(!row||typeof row!=='object'||typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))||new Date(row.date).toISOString().slice(0,10)!==row.date||dates.has(row.date))return false;
  dates.add(row.date);
  return (row.weight==null||Number.isFinite(row.weight)&&row.weight>0&&row.weight<=1000)&&(row.bf==null||Number.isFinite(row.bf)&&row.bf>=0&&row.bf<100)&&(row.weight!=null||row.bf!=null);
 });
}
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function viewPatch(current, request) {
  if(!request || !Array.isArray(request.changes) || request.changes.length>8) throw Error('Invalid edit');
  const next={...current},seen=new Set();
  for(const change of request.changes){
    const field=change?.field;
    if(![...editableFields,'dashboardExtras'].includes(field)||seen.has(field))throw Error('Invalid edit field');
    seen.add(field);
    if(!equal(current[field],change.before))throw Error('Los datos han cambiado. Revisa el registro e inténtalo de nuevo.');
    if(field!=='dashboardExtras'&&!Array.isArray(change.after))throw Error('Invalid list');
    if(field==='gym'&&!validMeasurements(change.after))throw Error('Peso o medidas no válidos.');
    next[field]=structuredClone(change.after);
  }
  return {next,fields:[...seen]};
}
