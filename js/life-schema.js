// Versioned, additive schema. Financial data and original media fields are never rewritten.
export const MUSCLES = ['chest','back','lowerBack','shoulders','abs','cardio','legs','biceps','triceps'];
export const DEFAULT_ACTIVITIES = [
  {id:'boxing',name:'Boxeo',translations:{es:{name:'Boxeo'},en:{name:'Boxing'}}},
  {id:'football',name:'Fútbol',translations:{es:{name:'Fútbol'},en:{name:'Football'}}},
  {id:'treadmill',name:'Cinta de correr',translations:{es:{name:'Cinta de correr'},en:{name:'Treadmill'}}}
];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
}
export function validateLife(obj) {
  const errors=[];
  if(obj.trainingInitialized != null && typeof obj.trainingInitialized !== 'boolean') errors.push('Invalid training state');
  const record=v=>v && typeof v==='object' && !Array.isArray(v);
  if(obj.schemaVersion!=null && (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion>2 || obj.schemaVersion<1)) errors.push('Unsupported schema version');
  if(obj.preferences!=null && (!record(obj.preferences) || !['es','en'].includes(obj.preferences.language) || !['dark','light'].includes(obj.preferences.theme))) errors.push('Invalid preferences');
  for(const k of ['workouts','activities']) if(obj[k]!=null && !Array.isArray(obj[k])) errors.push('Invalid '+k);
  const activities = Array.isArray(obj.activities) ? obj.activities : DEFAULT_ACTIVITIES;
  const ids=new Set();
  activities.forEach(a=>{
    if(!record(a) || typeof a.id!=='string' || !a.id || ids.has(a.id) || typeof a.name!=='string' || !a.name.trim()) errors.push('Invalid or duplicate activity');
    if(a) ids.add(a.id);
  });
  const seen=new Set();
  (Array.isArray(obj.workouts)?obj.workouts:[]).forEach(w=>{
    if(!record(w) || typeof w.id!=='string' || !w.id || seen.has(w.id) || !validDate(w.date) || w.date>today() || !['gym','activity'].includes(w.mode) || !Array.isArray(w.muscles) || w.muscles.some(m=>!MUSCLES.includes(m)) || new Set(w.muscles).size!==w.muscles.length || (w.mode==='gym' && !w.muscles.length) || (w.mode==='activity' && !ids.has(w.activityId))) errors.push('Invalid or duplicate workout');
    if(w) seen.add(w.id);
  });
  for(const k of ['books','movies','series','games','activities']) {
    (Array.isArray(obj[k])?obj[k]:[]).forEach(x=>{
      if(!record(x)) {errors.push('Invalid '+k+' item'); return;}
      if(x.translations!=null && (!record(x.translations) || ['es','en'].some(l=>!record(x.translations[l]) || Object.values(x.translations[l]).some(v=>typeof v!=='string')))) errors.push('Invalid translations: '+k);
    });
  }
  return errors;
}
export function lifeDefaults(obj, previous={}) {
  return {schemaVersion:2,
    trainingInitialized:obj.trainingInitialized ?? previous.trainingInitialized ?? false,
    preferences:obj.preferences ?? previous.preferences ?? {language:'es',theme:'dark'},
    workouts:obj.workouts ?? previous.workouts ?? [],
    activities:obj.activities ?? previous.activities ?? structuredClone(DEFAULT_ACTIVITIES)};
}
export function seriesProgress(s) {
  const seasons=Math.min(500,Math.max(0,Math.floor(Number(s.seasons)||0))), text=String(s.watched||'').toLowerCase();
  let watched=0, uncertain=false;
  if(/^(entera|finished|al día|up to date)$/.test(text)) watched=seasons;
  else {
    const m=text.match(/(\d+)\s*(?:temporada|season)/) || text.match(/(?:temporada|season)\s*(\d+)/);
    if(m) watched=Math.min(seasons,Number(m[1]));
    else if(text || s.myRating!=null) uncertain=true;
  }
  let eps=Array(seasons).fill(10), estimated=true;
  const ep=String(s.epsPerSeason||'').trim();
  if(/^\d+$/.test(ep) && Number(ep)>0) {eps.fill(Number(ep));estimated=false;}
  else {
    const ranges=[...ep.matchAll(/(\d+)\s*\((\d+)-(\d+)\)/g)];
    if(ranges.length) {const covered=new Set();ranges.forEach(([,n,a,b])=>{for(let i=+a;i<=+b && i<=seasons;i++){eps[i-1]=+n;covered.add(i);}});estimated=covered.size!==seasons;}
    else if(parseInt(ep)>0) eps.fill(parseInt(ep));
  }
  const duration=durationMinutes(s.epLength);
  const total=eps.reduce((a,b)=>a+b,0)*duration;
  const done=eps.slice(0,watched).reduce((a,b)=>a+b,0)*duration;
  return {done,remaining:Math.max(0,total-done),estimated:estimated||uncertain||!duration,uncertain};
}
export function durationMinutes(s) {
  const str=String(s||'');
  return +(str.match(/(\d+)\s*h/)?.[1]||0)*60 + +(str.match(/(\d+)\s*min/)?.[1]||0);
}
