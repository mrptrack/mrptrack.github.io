import {D,_authed} from './state.js';
import {saveAndSync} from './cloud.js';
import {esc} from './life-schema.js';
import {t,mediaTitle} from './i18n.js';
import {renderBooks,renderMovies,renderSeries} from './media.js';
const definitions={
book:{key:'books',label:'Book',render:renderBooks,fields:[['author','Author'],['year','Year','number',0,3000],['pages','Pages','number',0,100000],['grRating','Goodreads rating','number',0,5],['myRating','My rating (0-5)','number',0,5]]},
movie:{key:'movies',label:'Movie',render:renderMovies,fields:[['director','Director'],['year','Year','number',1800,3000],['duration','Duration'],['platform','Platform'],['actors','Actors'],['faRating','Filmaffinity rating','number',0,10],['myRating','My rating (0-10)','number',0,10]]},
serie:{key:'series',label:'Series',render:renderSeries,fields:[['years','Years'],['seasons','Seasons','number',0,500],['epsPerSeason','Episodes per season'],['epLength','Ep length'],['platform','Platform'],['watched','Watched'],['imdbRating','IMDB rating','number',0,10],['myRating','My rating (0-10)','number',0,10]]}
};
export function openMediaModal(type,idx=null){
  if(!_authed)return;
  const def=definitions[type];if(!def)return;
  const old=idx==null?{}:D[def.key][idx];if(!old)return;
  document.getElementById('mod').innerHTML=`<h2>${t((idx==null?'Add ':'Edit ')+def.label)}</h2><form id="mediaForm"><div class="game-fields">
    ${['es','en'].map(l=>'<div class="fg"><label for="mediaTitle-'+l+'">'+t('Title · '+(l==='es'?'Español':'English'))+'</label><input id="mediaTitle-'+l+'" name="title-'+l+'" value="'+esc(mediaTitle(old,l))+'" required maxlength="500"></div>').join('')}
    ${def.fields.map(([key,label,type='text',min,max])=>'<div class="fg"><label for="media-'+key+'">'+t(label)+'</label><input id="media-'+key+'" name="'+key+'" type="'+type+'" '+(type==='number'?'min="'+min+'" max="'+max+'" step="'+(['year','pages','seasons'].includes(key)?'1':'any')+'"':'')+' value="'+esc(old[key]??'')+'"></div>').join('')}</div>
    ${type==='serie'?'<div class="fg"><label for="mediaWant">'+t('Want to finish?')+'</label><select name="wantFinish" id="mediaWant"><option value="">—</option><option value="Yes">'+t('Yes')+'</option><option value="No">'+t('No')+'</option><option value="Rewatch">'+t('Rewatch')+'</option></select></div>':''}
    <div class="fg"><label for="mediaOpinion">${t('Opinion')}</label><textarea id="mediaOpinion" name="opinion">${esc(old.opinion||'')}</textarea></div>
    <div class="m-btns">${idx==null?'':'<button type="button" class="btn btn-r" id="mediaDelete">'+t('Delete')+'</button>'}<button type="button" class="btn" id="mediaCancel">${t('Cancel')}</button><button type="submit" class="btn btn-g">${t('Save')}</button></div></form>`;
  const close=()=>document.getElementById('ov').classList.remove('open');
  document.getElementById('ov').classList.add('open');
  if(type==='serie')document.getElementById('mediaWant').value=old.wantFinish==='Sí'?'Yes':old.wantFinish==='Volver a verla'?'Rewatch':old.wantFinish||'';
  document.getElementById('mediaCancel').onclick=close;
  if(idx!=null)document.getElementById('mediaDelete').onclick=()=>{if(_authed&&confirm(t('Delete this item?'))){D[def.key].splice(idx,1);close();def.render();saveAndSync();}};
  document.getElementById('mediaForm').onsubmit=e=>{
    e.preventDefault();if(!_authed)return;
    const fd=new FormData(e.target),item={...old};
    for(const [key,,type] of def.fields){const v=fd.get(key).trim();item[key]=type==='number'?(v===''?null:Number(v)):v;}
    const es=fd.get('title-es').trim(),en=fd.get('title-en').trim();
    if(!es||!en)return;
    item.title=es;item.translations={...old.translations,es:{...old.translations?.es,title:es},en:{...old.translations?.en,title:en}};
    item.opinion=fd.get('opinion');
    if(type==='serie')item.wantFinish=fd.get('wantFinish');
    if(idx==null)D[def.key].push(item);else D[def.key][idx]=item;
    close();def.render();saveAndSync();
  };
}

