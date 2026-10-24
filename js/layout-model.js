// The layout is a per-browser preference; it never changes the finance JSON.
export const normalizeLayout = value => value === 'new' ? 'new' : 'classic';
export const editableFields = ['books','movies','series','games','workouts','activities','watchlist'];
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
    next[field]=structuredClone(change.after);
  }
  return {next,fields:[...seen]};
}
