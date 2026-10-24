import {D,setAuthed} from '/js/state.js';
import {loadDataFromObj,buildDataObj} from '/js/storage.js';
import {renderBooks,renderMovies,renderSeries} from '/js/media.js';
import {renderGames,initGames} from '/js/games.js';
import {openMediaModal} from '/js/media-editor.js';
import {openGameModal} from '/js/games.js';
import {initSettings} from '/js/settings.js';
const translations=(es,en)=>({es:{title:es},en:{title:en}});
loadDataFromObj({cash:575,totalInvested:73750,holdings:[],closedTrades:[],history:[],gym:[],watchlist:[],
  books:[{title:'Dune',author:'Frank Herbert',year:'1965',pages:600,myRating:4.5,grRating:4.3,opinion:'Una historia que merece una segunda lectura.\nEsta opinión se conserva exactamente.',translations:translations('Dune','Dune')},{title:'1984',author:'George Orwell',year:'1949',pages:350,myRating:null},{title:'The Little Book of Valuation',author:'Aswath Damodaran',year:2011,pages:256,myRating:0}],
  movies:[{title:'Interstellar',year:2014,director:'Christopher Nolan',duration:'2h 49 min',myRating:9,faRating:8.2,platform:'Example platform',actors:'Matthew McConaughey, Anne Hathaway',opinion:'Una prueba de opinión larga para comprobar que la ficha conserva todo el texto, sin recortarlo ni traducirlo. '.repeat(4)},{title:'Dune',year:2021,director:'Denis Villeneuve',duration:'2h 35 min',myRating:null},{title:'El padrino',year:1972,director:'Francis Ford Coppola',myRating:9.5,translations:translations('El padrino','The Godfather')},{title:'Asesinos de la luna',year:2023,director:'Martin Scorsese',myRating:8},{title:'Scarface',year:1983,myRating:9}],
  series:[{title:'Breaking Bad',years:'2008–2013',seasons:5,epsPerSeason:'13',epLength:'45 min',watched:'Entera',myRating:10,imdbRating:9.5},{title:'El pingüino',years:'2024',seasons:1,watched:'Al día',translations:translations('El pingüino','The Penguin')}],
  games:[{title:'Elden Ring',developer:'FromSoftware',platform:'PS5',releaseYear:2022,playedYear:2026,hours:80,metacritic:96,myRating:9.5,status:'Playing',opinion:'Opinión de prueba.'},{title:'Hollow Knight',developer:'Team Cherry',platform:'PC',releaseYear:2017,status:'Backlog'}],preferences:{language:'es',theme:'dark'}});
setAuthed(true);initSettings();initGames();
const render=()=>{renderBooks();renderMovies();renderSeries();renderGames();};
document.getElementById('loginOv').style.display='none';
document.getElementById('btnAdmin').style.display='';
document.getElementById('btnAdmin').onclick=()=>document.body.classList.toggle('edit-mode');
document.getElementById('btnAddBook').onclick=()=>openMediaModal('book');document.getElementById('btnAddMovie').onclick=()=>openMediaModal('movie');document.getElementById('btnAddSeries').onclick=()=>openMediaModal('serie');
document.getElementById('tabBar').onclick=e=>{if(!e.target.matches('.tab-btn'))return;document.querySelectorAll('.tab-btn,.tab-content').forEach(t=>t.classList.remove('active'));e.target.classList.add('active');document.getElementById('tab-'+e.target.dataset.tab).classList.add('active');};
document.addEventListener('preferences-changed',render);
for(const kind of ['books','movies','series'])for(const suffix of ['Search','Sort','Filter'])document.getElementById(kind+suffix).addEventListener(suffix==='Search'?'input':'change',render);
document.addEventListener('click',e=>{const card=e.target.closest('.m-card[data-edit-type]');if(card&&document.body.classList.contains('edit-mode')){const kind=card.dataset.editType,idx=Number(card.dataset.editIdx);if(kind==='game')openGameModal(idx);else openMediaModal(kind,idx);}});
document.getElementById('ov').onclick=e=>{if(e.target===document.getElementById('ov'))e.target.classList.remove('open');};
document.querySelector('.wrap').insertAdjacentHTML('beforeend','<p id="qaStatus" data-no-i18n>PRUEBA AISLADA · datos ficticios · sin conexión a Drive</p><button id="qaExport" class="btn">Export QA JSON</button>');
document.getElementById('qaExport').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(buildDataObj())],{type:'application/json'}));a.download='library-qa.json';a.click();};
render();document.querySelector('[data-tab="movies"]').click();
