import {D,_authed,isFallbackState} from './state.js';
import {saveAndSync} from './cloud.js';
import {language,t,initI18n,translateUI} from './i18n.js';
const key=location.hostname==='mrptrack.github.io'||document.title.includes('MRP')?'trackmrp_preferences':'trackcmg_preferences';
export function applyPreferences(){
  const p=D.preferences||{language:'es',theme:'dark'};
  try{localStorage.setItem(key,JSON.stringify(p));}catch{}
  document.documentElement.classList.toggle('theme-light',p.theme==='light');
  document.documentElement.classList.toggle('theme-dark',p.theme!=='light');
  translateUI();
}
export function initSettings(){
  // Local preference overrides are only for this browser; JSON retains the same pair.
  try{const saved=JSON.parse(localStorage.getItem(key));if(isFallbackState()&&saved&&['es','en'].includes(saved.language)&&['dark','light'].includes(saved.theme))D.preferences=saved;}catch{}
  initI18n();applyPreferences();
  document.getElementById('btnSettings').onclick=openSettings;
  document.addEventListener('data-loaded',applyPreferences);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('ov').classList.remove('open');});
}
function openSettings(){
  const m=document.getElementById('mod');
  m.innerHTML=`<h2>${t('Settings')}</h2><div class="game-fields"><div class="fg"><label for="settingTheme">${t('Theme')}</label><select id="settingTheme"><option value="dark">${t('Dark')}</option><option value="light">${t('Light')}</option></select></div><div class="fg"><label for="settingLanguage">${t('Language')}</label><select id="settingLanguage"><option value="es">Español</option><option value="en">English</option></select></div></div><div class="m-btns"><button class="btn btn-g" id="closeSettings">${t('Close')}</button></div>`;
  document.getElementById('ov').classList.add('open');
  document.getElementById('settingTheme').value=D.preferences.theme;
  document.getElementById('settingLanguage').value=language();
  for(const id of ['settingTheme','settingLanguage'])document.getElementById(id).onchange=()=>{
    D.preferences={...D.preferences,theme:document.getElementById('settingTheme').value,language:document.getElementById('settingLanguage').value};
    try{localStorage.setItem(key,JSON.stringify(D.preferences));}catch{}
    applyPreferences();document.dispatchEvent(new Event('preferences-changed'));
    if(_authed)saveAndSync();
    const focus=id;openSettings();document.getElementById(focus).focus();
  };
  document.getElementById('closeSettings').onclick=()=>{document.getElementById('ov').classList.remove('open');document.getElementById('btnSettings').focus();};
  document.getElementById('settingTheme').focus();
}
