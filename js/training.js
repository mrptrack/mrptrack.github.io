import {D,_authed} from './state.js';
import {saveAndSync} from './cloud.js';
import {MUSCLES,esc,today,validDate} from './life-schema.js';
import {t,locale,localizedName} from './i18n.js';

const el=id=>document.getElementById(id);
let month=today().slice(0,7);
const dayDate=s=>new Date(s+'T12:00:00');
const shift=(s,n)=>{const d=dayDate(s);d.setDate(d.getDate()+n);return localISO(d);};
const localISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function monday(s){return shift(s,-((dayDate(s).getDay()+6)%7));}
function dateLabel(s,opts={day:'numeric',month:'short'}){return dayDate(s).toLocaleDateString(locale(),opts);}
const activity=w=>w.mode==='gym'?t('Gym'):localizedName((D.activities||[]).find(a=>a.id===w.activityId));
export function trainingStats(workouts,now=today()){
  const start=monday(now), weeks=Array.from({length:12},(_,i)=>shift(start,(i-11)*7));
  const recent=workouts.filter(w=>w.date>=weeks[0] && w.date<=now);
  const counts=weeks.map(w=>new Set(recent.filter(s=>monday(s.date)===w).map(s=>s.date)).size);
  return {weeks,counts,activeWeeks:counts.filter(Boolean).length,
    days:new Set(workouts.map(w=>w.date)).size,
    thisWeek:new Set(workouts.filter(w=>w.date>=start&&w.date<=now).map(w=>w.date)).size,
    muscles:MUSCLES.map(m=>({id:m,n:recent.filter(w=>w.muscles.includes(m)).length}))};
}
export function renderTraining(){
  const host=el('trainingDashboard');if(!host)return;
  const workouts=[...(D.workouts||[])].sort((a,b)=>b.date.localeCompare(a.date));
  const stats=trainingStats(workouts), max=Math.max(...stats.counts,1), maxMuscle=Math.max(...stats.muscles.map(m=>m.n),1);
  const sessions=workouts.filter(w=>w.date.startsWith(month));
  const first=month+'-01', offset=(dayDate(first).getDay()+6)%7, days=new Date(+month.slice(0,4),+month.slice(5),0).getDate();
  const cells=Array.from({length:offset},()=>'<span></span>');
  for(let n=1;n<=days;n++){
    const date=month+'-'+String(n).padStart(2,'0');
    const items=workouts.filter(w=>w.date===date),future=date>today();
    cells.push('<button class="training-day '+(items.length?'has-session ':'')+(date===today()?'is-today':'')+'" data-date="'+date+'" '+(!_authed||future?'disabled':'')+' aria-label="'+esc(dateLabel(date,{day:'numeric',month:'long',year:'numeric'})+' · '+items.length+' '+t('Sessions'))+'" title="'+esc(items.map(w=>activity(w)+' · '+w.muscles.map(t).join(', ')).join(' / ')||t('Rest / unlogged'))+'"><span>'+n+'</span><small>'+ (items.length?'●'.repeat(Math.min(items.length,3)):'') +'</small></button>');
  }
  const weekDays=Array.from({length:7},(_,i)=>dateLabel(shift('2026-01-05',i),{weekday:'short'}));
  host.innerHTML=`<div class="training-heading"><div><h2>${t('Training')}</h2><p class="sum-sub">${t('Log session')}</p></div><button class="btn btn-g" id="newWorkout" ${!_authed?'disabled':''}>+ ${t('Log session')}</button></div>
  <div class="sum-grid">${[[t('Sessions'),workouts.length],[t('Active days'),stats.days],[t('This week'),stats.thisWeek+'/7'],[t('Active weeks · last 12'),stats.activeWeeks+'/12']].map(([l,v])=>`<div class="sum-card"><div class="sum-lbl">${l}</div><div class="sum-val">${v}</div></div>`).join('')}</div>
  <div class="training-grid">
    <section class="card"><h2>${t('Weekly frequency')}</h2><p class="sum-sub">${t('Active days')} · ${t('Last 12 weeks')}</p>
    <div class="training-bars" role="img" aria-label="${esc(stats.weeks.map((w,i)=>dateLabel(w)+': '+stats.counts[i]).join('; '))}">${stats.weeks.map((w,i)=>`<div class="training-bar"><strong>${stats.counts[i]}</strong><div style="height:${Math.max(2,stats.counts[i]/max*110)}px" title="${esc(dateLabel(w)+': '+stats.counts[i]+' '+t('Active days'))}"></div><small>${i%3===0||i===11?dateLabel(w):''}</small></div>`).join('')}</div></section>
    <section class="card"><h2>${t('Muscle balance')}</h2><p class="sum-sub">${t('Sessions')} · ${t('Last 12 weeks')}</p><div class="muscle-bars">${stats.muscles.map(m=>`<div><span>${t(m.id)}</span><div class="muscle-track"><div style="width:${m.n/maxMuscle*100}%"></div></div><b>${m.n}</b></div>`).join('')}</div></section>
    <section class="card"><div class="training-heading"><h2>${t('Training calendar')}</h2><div class="month-nav"><button class="btn btn-sm" id="prevTrainingMonth" aria-label="${t('Previous month')}">‹</button><input type="month" id="trainingMonth" value="${month}" max="${today().slice(0,7)}" aria-label="${t('Month')}"><button class="btn btn-sm" id="nextTrainingMonth" aria-label="${t('Next month')}" ${month>=today().slice(0,7)?'disabled':''}>›</button></div></div>
      <div class="training-calendar">${weekDays.map(d=>'<span class="weekday">'+esc(d)+'</span>').join('')}${cells.join('')}</div></section>
    <section class="card"><h2>${t('Session log')} · ${esc(dateLabel(first,{month:'long',year:'numeric'}))}</h2>
      <div class="session-list">${sessions.map(w=>`<button class="session-row" data-workout="${esc(w.id)}" ${!_authed?'disabled':''}><span><b>${esc(dateLabel(w.date))}</b><small>${esc(activity(w))}</small></span><span class="session-muscles">${esc(w.muscles.map(t).join(' · '))}</span><span aria-hidden="true">↗</span></button>`).join('')||'<p class="empty-state">'+t(workouts.length?'No sessions this month.':'No sessions yet. Start with today or choose an earlier date.')+'</p>'}</div></section>
  </div>`;
  el('newWorkout').onclick=()=>openWorkout();
  host.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>openWorkout(null,b.dataset.date));
  host.querySelectorAll('[data-workout]').forEach(b=>b.onclick=()=>openWorkout(b.dataset.workout));
  el('trainingMonth').onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)&&e.target.value<=today().slice(0,7)){month=e.target.value;renderTraining();}};
  const move=n=>{const d=dayDate(first);d.setMonth(d.getMonth()+n);month=localISO(d).slice(0,7);renderTraining();};
  el('prevTrainingMonth').onclick=()=>move(-1);el('nextTrainingMonth').onclick=()=>move(1);
}
export function openWorkout(id=null,date=today()){
  if(!_authed)return;
  const w=id?(D.workouts||[]).find(x=>x.id===id):{date,mode:'gym',muscles:[]};
  if(!w)return;
  const activities=D.activities||[];
  el('mod').innerHTML=`<h2>${t(id?'Edit session':'Log session')}</h2><form id="workoutForm">
    <div class="game-fields"><div class="fg"><label for="workoutDate">${t('Date')}</label><input id="workoutDate" type="date" value="${esc(w.date)}" max="${today()}" required></div>
    <div class="fg"><label for="workoutMode">${t('Session type')}</label><select id="workoutMode"><option value="gym">${t('Gym')}</option><option value="activity">${t('Activity')}</option></select></div></div>
    <div id="activityFields" hidden><div class="fg"><label for="workoutActivity">${t('Activity')}</label><select id="workoutActivity"><option value="">—</option>${activities.map(a=>'<option value="'+esc(a.id)+'">'+esc(localizedName(a))+'</option>').join('')}<option value="__new">+ ${t('New activity')}</option></select></div>
    <div id="newActivityFields" class="game-fields" hidden><div class="fg"><label for="activityEs">${t('Activity name · Español')}</label><input id="activityEs" maxlength="80"></div><div class="fg"><label for="activityEn">${t('Activity name · English')}</label><input id="activityEn" maxlength="80"></div></div></div>
    <fieldset class="muscle-picker"><legend>${t('Muscle groups')}</legend>${MUSCLES.map(m=>'<label><input type="checkbox" name="muscle" value="'+m+'" '+(w.muscles.includes(m)?'checked':'')+'><span>'+t(m)+'</span></label>').join('')}</fieldset>
    <p id="workoutError" class="form-err" role="alert"></p><div class="m-btns">${id?'<button type="button" class="btn btn-r" id="deleteWorkout">'+t('Delete')+'</button>':''}<button type="button" class="btn" id="cancelWorkout">${t('Cancel')}</button><button type="submit" class="btn btn-g">${t('Save')}</button></div></form>`;
  el('ov').classList.add('open');
  el('workoutMode').value=w.mode;el('workoutActivity').value=w.activityId||'';
  const toggle=()=>{el('activityFields').hidden=el('workoutMode').value!=='activity';el('newActivityFields').hidden=el('workoutActivity').value!=='__new';};
  toggle();el('workoutMode').onchange=toggle;el('workoutActivity').onchange=toggle;
  const close=()=>el('ov').classList.remove('open');el('cancelWorkout').onclick=close;
  if(id)el('deleteWorkout').onclick=()=>{if(_authed&&confirm(t('Delete this session?'))){D.trainingInitialized=true;D.workouts=D.workouts.filter(x=>x.id!==id);close();renderTraining();saveAndSync();}};
  el('workoutForm').onsubmit=e=>{
    e.preventDefault();if(!_authed)return;
    const error=msg=>{el('workoutError').textContent=t(msg);el('workoutError').style.display='block';};
    const date=el('workoutDate').value,mode=el('workoutMode').value,muscles=[...el('workoutForm').querySelectorAll('[name=muscle]:checked')].map(i=>i.value);
    if(!validDate(date)||date>today())return error('Choose a valid date, today or earlier.');
    if(mode==='gym'&&!muscles.length)return error('Choose at least one muscle group.');
    let activityId=mode==='activity'?el('workoutActivity').value:null,newActivity;
    if(mode==='activity'){
      if(!activityId)return error('Choose an activity.');
      if(activityId==='__new'){
        const es=el('activityEs').value.trim(),en=el('activityEn').value.trim();
        if(!es||!en)return error('Activity name');
        const existing=(D.activities||[]).find(a=>[a.name,a.translations?.es?.name,a.translations?.en?.name].some(n=>n?.toLowerCase()===es.toLowerCase()||n?.toLowerCase()===en.toLowerCase()));
        activityId=existing?.id||crypto.randomUUID();
        if(!existing)newActivity={id:activityId,name:es,translations:{es:{name:es},en:{name:en}}};
      }
    }
    if(newActivity)D.activities.push(newActivity);
    D.trainingInitialized=true;
    const entry={...w,id:id||crypto.randomUUID(),date,mode,muscles,activityId};
    if(id)D.workouts=D.workouts.map(x=>x.id===id?entry:x);else(D.workouts??=[]).push(entry);
    month=date.slice(0,7);close();renderTraining();saveAndSync();
  };
  el('workoutDate').focus();
}
