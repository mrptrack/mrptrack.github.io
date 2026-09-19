// Central catalogue for static UI and legacy templates. Opinions and form values are excluded.
import { D } from './state.js';
const PAIRS = [
['Settings','Ajustes'],['Language','Idioma'],['Theme','Tema'],['Dark','Oscuro'],['Light','Claro'],['Close','Cerrar'],
['Portfolio','Cartera'],['Watchlist','Seguimiento'],['Closed Trades','Operaciones cerradas'],['Analytics','Análisis'],['Gym','Gimnasio'],['Books','Libros'],['Movies','Películas'],['Series','Series'],['Games','Videojuegos'],
['Private Portfolio','Cartera personal'],['Loading...','Cargando...'],['Synced','Sincronizado'],['Sync error','Error de sincronización'],['Edit','Editar'],['Editing','Editando'],['Refresh prices','Actualizar precios'],['Download JSON backup','Descargar copia JSON'],['Import JSON backup','Importar copia JSON'],['Toggle edit mode','Activar edición'],['Dashboard sections','Secciones'],['Skip to content','Ir al contenido'],
['Portfolio Value','Valor de la cartera'],['Allocation','Distribución'],['Value Breakdown (EUR)','Desglose de valor (EUR)'],['Invested vs Portfolio Value','Invertido vs valor de cartera'],['Monthly Returns','Rentabilidad mensual'],['Closed Positions','Posiciones cerradas'],['Net P&L by Position','Beneficio neto por posición'],['Capital Deployed vs Returned','Capital invertido vs recuperado'],['Sector Allocation','Distribución por sector'],['Currency Exposure (EUR)','Exposición por divisa (EUR)'],['Portfolio vs Benchmarks','Cartera vs índices'],['Risk & Performance','Riesgo y rentabilidad'],['Monthly Returns Heatmap','Mapa de rentabilidad mensual'],['Road to €1M','Camino al millón'],['Compound Interest Calculator','Calculadora de interés compuesto'],
['Initial capital (€)','Capital inicial (€)'],['Monthly contribution (€)','Aportación mensual (€)'],['Annual return (%)','Rentabilidad anual (%)'],['Years','Años'],['Calculate','Calcular'],['Total invested','Total invertido'],['Invested','Invertido'],['Return','Rentabilidad'],['Returns','Rentabilidad'],['Cash','Efectivo'],['Dividends','Dividendos'],['Net P&L','Beneficio neto'],['Capital','Capital'],['Position','Posición'],['Positions','Posiciones'],['Current value','Valor actual'],['Market value','Valor de mercado'],['Total value','Valor total'],['Unrealized P&L','Beneficio latente'],['Realized P&L','Beneficio realizado'],['Total P&L','Beneficio total'],['Total Return','Rentabilidad total'],['Net Return','Rentabilidad neta'],['Total Return (%)','Rentabilidad total (%)'],
['Name','Nombre'],['Name (optional)','Nombre (opcional)'],['Target price','Precio objetivo'],['Current price','Precio actual'],['Currency','Divisa'],['vs Target','vs objetivo'],['Stocks on Watch','Valores en seguimiento'],['Add to Watchlist','Añadir a seguimiento'],['Shares','Acciones'],['Price','Precio'],['Entry','Compra'],['Exit','Venta'],['Buy date','Fecha de compra'],['Sell date','Fecha de venta'],['Date','Fecha'],['Month','Mes'],['Start','Inicio'],['End','Final'],['Profit','Beneficio'],['Loss','Pérdida'],['Cost','Coste'],['Weight','Peso'],['Weight (kg)','Peso (kg)'],['Body Fat (%)','Grasa corporal (%)'],['Body Fat','Grasa corporal'],['Current Weight','Peso actual'],['Last 30 Days','Últimos 30 días'],['Since Start','Desde el inicio'],['BF Change','Cambio de grasa'],['Lean Mass','Masa magra'],['Weight & Body Fat Progress','Evolución del peso y la grasa'],['Body measurements','Peso y medidas'],
['Total','Total'],['Read','Leídos'],['Pages read','Páginas leídas'],['Watched','Vistos'],['Hours watched','Horas vistas'],['Avg mine','Mi nota media'],['Hours played','Horas jugadas'],['Completed','Completado'],['Playing','Jugando'],['Paused','En pausa'],['Dropped','Abandonado'],['Backlog','Pendiente'],['Finished','Terminada'],['Up to date','Al día'],['Rewatch','Volver a verla'],['In progress','En curso'],['Unknown','Sin especificar'],['TBR','Pendiente'],
['Original order','Orden original'],['My rating (high)','Mi nota (mayor)'],['Goodreads (high)','Goodreads (mayor)'],['Pages (most)','Páginas (más)'],['Pages (fewest)','Páginas (menos)'],['Title A-Z','Título A-Z'],['Filmaffinity (high)','Filmaffinity (mayor)'],['Year (newest)','Año (recientes)'],['Year (oldest)','Año (antiguos)'],['Duration (longest)','Duración (mayor)'],['Duration (shortest)','Duración (menor)'],['IMDB (high)','IMDB (mayor)'],['Metacritic (high)','Metacritic (mayor)'],['Played (newest)','Jugado (recientes)'],['Release (newest)','Lanzamiento (recientes)'],['Hours (most)','Horas (más)'],['All','Todos'],['ALL','TODO'],['1Y','1A'],['Rated','Con nota'],['Not rated','Sin nota'],['Want to finish','Quiero terminar'],['Not started','Sin empezar'],['Game status','Estado del juego'],
['Search title, author...','Buscar título, autor...'],['Search title, director, actor...','Buscar título, director, actor...'],['Search title, platform...','Buscar título, plataforma...'],['Search title, developer, platform...','Buscar título, estudio, plataforma...'],['Search games','Buscar videojuegos'],['Sort games','Ordenar videojuegos'],
['Taste Profile','Mis gustos'],['My ratings (/5)','Mis notas (/5)'],['My ratings (/10)','Mis notas (/10)'],['Most read authors','Autores más leídos'],['Top directors','Directores más vistos'],['Favourite decades','Décadas favoritas'],['Top platforms','Plataformas más vistas'],
['Add','Añadir'],['+ Add','+ Añadir'],['+ Add Position','+ Añadir posición'],['+ Add Trade','+ Añadir operación'],['Save','Guardar'],['Saving…','Guardando…'],['Cancel','Cancelar'],['Delete','Eliminar'],['Yes','Sí'],['No','No'],['Title','Título'],['Title · Español','Título · Español'],['Title · English','Título · English'],['Author','Autor'],['Director','Director'],['Developer','Desarrolladora'],['Platform','Plataforma'],['Release year','Año de lanzamiento'],['Year played','Año en que jugué'],['Year','Año'],['Pages','Páginas'],['Duration','Duración'],['Actors','Reparto'],['Opinion','Opinión'],['Seasons','Temporadas'],['Episodes per season','Episodios por temporada'],['Ep length','Duración por episodio'],['Want to finish?','¿Quiero terminar?'],['My rating (0-5)','Mi nota (0-5)'],['My rating (0-10)','Mi nota (0-10)'],['Goodreads rating','Nota Goodreads'],['Filmaffinity rating','Nota Filmaffinity'],['IMDB rating','Nota IMDB'],['My rating (0–10)','Mi nota (0–10)'],['Metacritic (0–100)','Metacritic (0–100)'],['Hours played','Horas jugadas'],['Status','Estado'],
['Edit Book','Editar libro'],['Edit Movie','Editar película'],['Edit Series','Editar serie'],['Edit Game','Editar videojuego'],['Add Book','Añadir libro'],['Add Movie','Añadir película'],['Add Series','Añadir serie'],['Add Game','Añadir videojuego'],['Edit Cash & Totals','Editar efectivo y aportaciones'],['Cash (EUR)','Efectivo (EUR)'],['Total invested (EUR)','Total invertido (EUR)'],['Edit Position','Editar posición'],['Edit Trade','Editar operación'],['Add Position','Añadir posición'],['Add Trade','Añadir operación'],['Close Position','Cerrar posición'],['Exchange','Mercado'],['Sector','Sector'],['Color','Color'],['Other','Otro'],['Technology','Tecnología'],['Financials','Finanzas'],['Healthcare','Salud'],['Energy','Energía'],['Consumer','Consumo'],['Industrials','Industria'],['Materials','Materiales'],['Utilities','Servicios públicos'],['Real Estate','Inmobiliario'],['ETF/Index','ETF/Índice'],['Construction','Construcción'],['optional','opcional'],['Select or type…','Selecciona o escribe…'],['Fetching…','Buscando…'],
['CAGR (annualized)','CAGR (anualizado)'],['Volatility (ann.)','Volatilidad (anual)'],['Best Month','Mejor mes'],['Worst Month','Peor mes'],['No entries yet.','Todavía no hay registros.'],['Select a date first','Selecciona una fecha'],['Enter weight or body fat %','Introduce el peso o el % de grasa'],['Backup downloaded','Copia descargada'],['Back online','Conexión recuperada'],
['No games match your filters.','Ningún juego coincide con los filtros.'],['Your games, all in one place. Use Edit to add your first game.','Tus videojuegos en un solo lugar. Pulsa Editar para añadir el primero.'],
['Not enough history yet — returns appear after two months of snapshots.','Aún no hay suficiente histórico: hacen falta dos meses de registros.'],['Portfolio value pending — milestones light up once prices load.','Valor de cartera pendiente: los objetivos aparecerán al cargar los precios.'],
['Your watchlist is empty. Add a ticker and a target price above — it will light up green when the market comes to you.','Tu seguimiento está vacío. Añade un símbolo y un precio objetivo: se marcará en verde al alcanzarlo.'],
['Institutional Access Portal','Acceso privado'],['Authorized Personnel Only','Solo usuarios autorizados'],['ACCESS RESTRICTED · NO PUBLIC REGISTRATION','ACCESO RESTRINGIDO · SIN REGISTRO PÚBLICO'],
['Training','Entrenamientos'],['Log session','Registrar sesión'],['Edit session','Editar sesión'],['Session type','Tipo de sesión'],['Activity','Actividad'],['Muscle groups','Grupos musculares'],['chest','Pecho'],['back','Espalda'],['lowerBack','Espalda baja'],['shoulders','Hombro'],['abs','Abdominales'],['cardio','Cardio'],['legs','Pierna'],['biceps','Bíceps'],['triceps','Tríceps'],['Sessions','Sesiones'],['Active days','Días activos'],['This week','Esta semana'],['Active weeks · last 12','Semanas activas · últimas 12'],['Weekly frequency','Frecuencia semanal'],['Muscle balance','Reparto por músculos'],['Last 12 weeks','Últimas 12 semanas'],['Training calendar','Calendario de entrenamientos'],['Session log','Registro de sesiones'],['No sessions yet. Start with today or choose an earlier date.','Aún no hay sesiones. Empieza hoy o elige una fecha anterior.'],['New activity','Nueva actividad'],['Activity name · Español','Actividad · Español'],['Activity name · English','Actividad · English'],['Activity name','Nombre de actividad'],['Add activity','Añadir actividad'],['Choose at least one muscle group.','Elige al menos un grupo muscular.'],['Choose an activity.','Elige una actividad.'],['Choose a valid date, today or earlier.','Elige una fecha válida, de hoy o anterior.'],['Delete this session?','¿Eliminar esta sesión?'],['Delete this item?','¿Eliminar este elemento?'],['Previous month','Mes anterior'],['Next month','Mes siguiente'],['Rest / unlogged','Descanso / sin registro'],['All sessions','Todas las sesiones'],['No sessions this month.','Sin sesiones este mes.'],['Gym sessions','Sesiones de gimnasio'],['Activity sessions','Sesiones de actividad'],
['Estimated hours: incomplete episode counts or viewing progress.','Horas estimadas: faltan datos de episodios o progreso.'],['Unknown duration','Duración desconocida'],['remaining','pendientes'],['Remaining','Pendientes'],
['Invalid preferences','Ajustes no válidos'],['Unsupported schema version','Versión de datos no compatible'],['Invalid or duplicate workout','Entrenamiento no válido o duplicado'],['Invalid or duplicate activity','Actividad no válida o duplicada'],
['Import Data (JSON)','Importar datos (JSON)'],['Analyze','Analizar'],['Current','Actual'],['Imported','Importado'],['Import and sync','Importar y sincronizar'],['Importing…','Importando…'],['JSON file','Archivo .json'],['… or paste JSON here','… o pega el JSON aquí'],['Cannot import:','No se puede importar:'],
['Restore an exported backup. A copy of your current data is downloaded before applying changes.','Restaura un backup exportado desde la app (mismo formato que el botón de export). Antes de aplicar se descarga automáticamente un backup del estado actual.'],
['Merge history: keep local dates missing from this file (recommended)','Fusionar histórico: conservar también los puntos locales que no estén en el archivo (recomendado)'],
['I understand this replaces the current data','Entiendo que esto sustituye los datos actuales'],['(a backup is downloaded first and another copy stays in this browser)','(se descarga un backup antes y queda otra copia en este navegador)'],
['Data imported and synced','Datos importados y sincronizados'],['Imported locally — sync pending','Importado en local — sync pendiente'],['Sign in to import','Inicia sesión para importar'],['Choose a file or paste JSON','Elige un archivo o pega el JSON']
];
const dictionary=new Map();
PAIRS.push(...[["Fetch","Buscar"],["Total shares","Acciones totales"],["Avg buy price","Precio medio de compra"],["Sell price","Precio de venta"],["Lots","Lotes"],["Edit Entry","Editar registro"],["Add Closed Trade","Añadir operación cerrada"],["Entry price","Precio de entrada"],["Shares to sell","Acciones a vender"],["Estimated P&L (sold shares)","Beneficio estimado (acciones vendidas)"],["Back","Volver"],["Confirm Close","Confirmar cierre"],["Intraday","Intradía"],["Full close","Cierre completo"],["Dividends received (total, in selected currency)","Dividendos recibidos (total, en la divisa seleccionada)"],["Ticker is required","El símbolo es obligatorio"],["Shares must be a positive whole number","El número de acciones debe ser positivo"],["Avg buy price must be a positive number","El precio medio de compra debe ser positivo"],["Sell price must be a positive number","El precio de venta debe ser positivo"],["Entry price must be a positive number","El precio de entrada debe ser positivo"],["Sell price is required and must be greater than 0","El precio de venta es obligatorio y debe ser mayor que 0"],["Shares to sell must be greater than 0","Las acciones a vender deben ser mayores que 0"],["Delete?","¿Eliminar?"],["Delete this book?","¿Eliminar este libro?"],["Delete this movie?","¿Eliminar esta película?"],["Delete this series?","¿Eliminar esta serie?"],["Delete this trade?","¿Eliminar esta operación?"],["Delete this position?","¿Eliminar esta posición?"],["Delete this entry?","¿Eliminar este registro?"],["Data fetched successfully","Datos obtenidos correctamente"],["Current Value","Valor actual"],["Avg entry price","Precio medio de entrada"],["Dividends received","Dividendos recibidos"],["No notes yet","Sin notas"],["vs avg entry","vs precio de entrada"],["reached","alcanzado"],["millionaire","millonario"],["Optional","Opcional"]]);
PAIRS.push(...[["Capital deployed","Capital invertido"],["Dividends (net)","Dividendos netos"],["Net result","Resultado neto"],["Return %","Rentabilidad %"],["Avg Buy","Compra media"],["Sell","Venta"],["Buy Date","Fecha de compra"],["Sell Date","Fecha de venta"],["Gross P&L","Beneficio bruto"],["Net","Neto"],["TOTAL","TOTAL"],["Returned","Recuperado"],["Dividends (EUR)","Dividendos (EUR)"],["Dividend Yield","Rentabilidad por dividendo"],["Sectors","Sectores"],["Gold","Oro"],["My Portfolio","Mi cartera"],["Final value","Valor final"],["Total gains","Ganancia total"],["Annual rate","Tasa anual"],["Capital Invested","Capital invertido"],["STALE","ANTIGUO"],["NO DATA","SIN DATOS"],["Daily","Diario"],["Value (EUR)","Valor (EUR)"],["% of Portfolio","% de cartera"],["Avg Price","Precio medio"],["CASH","EFECTIVO"],["No history yet. Data is recorded daily on each page load.","Sin histórico todavía. Se guarda un punto diario al abrir la página."],["Start Value","Valor inicial"],["End Value","Valor final"],["Market P&L","Beneficio de mercado"],["Monthly %","Mensual %"],["All-Time %","Acumulado %"],["No closed trades for this ticker","Sin operaciones cerradas para este valor"],["Avg Entry","Compra media"],["Performance — last 30 days","Evolución — últimos 30 días"],["TARGET","OBJETIVO"],["Edit Watchlist Item","Editar seguimiento"],["Notes / opinion","Notas / opinión"],["Metacritic /100","Metacritic /100"],["My rating /10","Mi nota /10"],["Sync failed","Error al sincronizar"],["Session expired","Sesión caducada"],["Empty cloud — keeping local data","Cloud vacío — manteniendo datos locales"],["Offline — showing cached data","Sin conexión — mostrando datos en caché"],["Title is required","El título es obligatorio"],["1 season and a bit","1 Temporada y poco"],["Finished","Entera"],["Max with VPN","Max con vpn"],["No platform","Ninguna"]]);
for(const [en,es] of PAIRS) {dictionary.set(en,{en,es});dictionary.set(es,{en,es});}
const insensitive=new Map([...dictionary].map(([k,v])=>[k.toLowerCase(),v]));
export const language=()=>D.preferences?.language==='en'?'en':'es';
const FORMAT_PAIRS = [
 ['ETA at current pace: {rate}%/mo (12m TWR) + {cash} €/mo contributed','Previsión al ritmo actual: {rate}%/mes (TWR 12m) + {cash} €/mes aportados'],
 ['vs Goodreads: you rate higher by {n} pts (GR scale)','vs Goodreads: puntúas {n} puntos por encima (escala GR)'],
 ['vs Goodreads: you rate tougher by {n} pts (GR scale)','vs Goodreads: puntúas {n} puntos por debajo (escala GR)'],
 ['/ next stop {n} €','/ siguiente objetivo {n} €'],
 ['Partial close: {a} of {b} shares — {c} remain','Cierre parcial: {a} de {b} acciones — quedan {c}'],
 ['Avg entry price ({c})','Precio medio de entrada ({c})'],
 ['Dividends received (total, {c})','Dividendos recibidos (total, {c})'],
 ['Sell price ({c})','Precio de venta ({c})'],
 ['Max: {n}','Máximo: {n}'],
 ['Fetch failed: {error}','Fetch fallido: {error}'],
 ['Backup failed: {error}','Error al descargar la copia: {error}'],
 ['Invalid JSON: {error}','JSON inválido: {error}'],
 ['Could not read file: {error}','No se pudo leer el archivo: {error}'],
 ['{key}: missing in backup; current data will be preserved','{key}: no está en el backup; se conservan los datos actuales'],
 ['"{key}" must be an array','"{key}" debe ser un array'],
 ['"{key}" is missing → imported empty','"{key}" no existe en el archivo → se importa vacío'],
 ['Unknown key "{key}" → ignored when saving','clave desconocida "{key}" → se ignorará al guardar'],
 ['"{key}" must be a number ≥ 0','"{key}" debe ser un número ≥ 0']
];
const FORMAT_RULES=FORMAT_PAIRS.flatMap(pair=>[0,1].map(direction=>{
  const source=pair[direction];
  const keys=[];
  const parts=source.split(/(\{\w+\})/g).map(part=>{
    if(/^\{\w+\}$/.test(part)){keys.push(part.slice(1,-1));return '(.+?)';}
    return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  });
  return {pair,keys,re:new RegExp('^'+parts.join('')+'
export const locale=()=>language()==='en'?'en-GB':'es-ES';
export function t(value) {
  const muscleNames={chest:'Chest',back:'Back',lowerBack:'Lower back',shoulders:'Shoulder',abs:'Abs',cardio:'Cardio',legs:'Legs',biceps:'Biceps',triceps:'Triceps'};
  if(language()==='en' && muscleNames[value])return muscleNames[value];
  const s=String(value??''), key=s.trim().replace(/\s+/g,' '), pair=dictionary.get(key);
  if(pair) return s.replace(s.trim(),pair[language()]);
  if(!/[A-Za-zÀ-ÿ]/.test(key))return s;
  const formatted=formatTranslation(key); if(formatted!=null)return formatted;
  const loose=insensitive.get(key.toLowerCase());
  if(loose)return loose[language()];
  const required=key.match(/^(.+?)\s*\*$/);if(required)return t(required[1])+' *';
  const bracket=key.match(/^(.+?) \(optional\)$/);if(bracket)return t(bracket[1])+' ('+t('optional')+')';
  const punct=key.match(/^(.+?)(:|\s+·|\s+—)\s*$/);if(punct&&dictionary.has(punct[1]))return t(punct[1])+punct[2]+' ';
  // Templates keep numbers and data unchanged.
  const patterns=[
    [/^(\d+) seasons?$/i, n=>language()==='es'?n+' temporadas':n+' seasons'],
    [/^(\d+) temporadas?$/i, n=>language()==='es'?n+' temporadas':n+' seasons'],
    [/^Temporada (\d+)$/i,n=>language()==='es'?'Temporada '+n:'Season '+n],
    [/^Released (\d+)$/,n=>language()==='es'?'Lanzamiento '+n:'Released '+n],
    [/^Played (\d+)$/,n=>language()==='es'?'Jugado '+n:'Played '+n],
    [/^(.+) remaining$/,n=>language()==='es'?n+' pendientes':n+' remaining'],
    [/^(.+) pendientes$/,n=>language()==='es'?n+' pendientes':n+' remaining'],
    [/^(.+)× · avg$/,n=>language()==='es'?n+'× · media':n+'× · avg']
  ];
  for(const [re,fn] of patterns){const m=key.match(re);if(m)return fn(m[1]);}
  if (key.includes(' · ')) return key.split(' · ').map(t).join(' · ');
  const decorated=key.match(/^([✏︎✎✓+⚠🔍↻→←]+\s*)(.+)$/u);
  if(decorated && dictionary.has(decorated[2])) return decorated[1]+t(decorated[2]);
  return s;
}
export function mediaTitle(item, lang=language()) {return item.translations?.[lang]?.title || item.title || '';}
export function localizedName(item) {return item?.translations?.[language()]?.name || item?.name || '';}
const originals=new WeakMap();
const excluded='script,style,textarea,.m-card-opinion,.m-card-title,[data-no-i18n],#gsiButton';
function translateNode(node) {
  if(node.nodeType===3) {
    if(!node.parentElement || node.parentElement.closest(excluded)) return;
    const old=originals.get(node), source=old && old.rendered===node.nodeValue?old.source:node.nodeValue;
    const rendered=t(source);
    originals.set(node,{source,rendered});
    if(node.nodeValue!==rendered)node.nodeValue=rendered;
  } else if(node.nodeType===1 && !node.matches(excluded)) {
    // Option text must never change the stored enum value.
    if(node.tagName==='OPTION' && !node.hasAttribute('value')) node.value=node.textContent;
    for(const attr of ['placeholder','title','aria-label']) {
      if(!node.hasAttribute(attr))continue;
      const key='i18n-'+attr, original=node.getAttribute('data-'+key) || node.getAttribute(attr);
      node.setAttribute('data-'+key,original);
      node.setAttribute(attr,t(original));
    }
    for(const child of node.childNodes)translateNode(child);
  }
}
let observer, chartInstalled=false;
export function translateUI() {
  observer?.disconnect();
  translateNode(document.body);
  document.documentElement.lang=language();
  observer?.observe(document.body,{subtree:true,childList:true,characterData:true});
}
export function initI18n() {
  observer=new MutationObserver(records=>{
    observer.disconnect();
    for(const r of records) {
      if(r.type==='characterData' && r.target.isConnected) translateNode(r.target);
      else for(const n of r.addedNodes)if(n.isConnected)translateNode(n);
    }
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  });
  translateUI();
  if(window.Chart?.register && !chartInstalled) {
    Chart.register({id:'dashboardLanguage',beforeUpdate(chart){
      if(chart.data.labels)chart.data.labels=chart.data.labels.map(v=>typeof v==='string'?t(v):v);
      for(const ds of chart.data.datasets||[]) if(ds.label)ds.label=t(ds.label);
      for(const axis of Object.values(chart.options.scales||{})) if(axis.title?.text)axis.title.text=t(axis.title.text);
      const center=chart.options.plugins?.centerText;if(center?.label)center.label=t(center.label);
    }});
    chartInstalled=true;
  }
})};
}));
function formatTranslation(s){
 for(const {pair,keys,re} of FORMAT_RULES){
  const match=s.match(re);
  if(match){const values=Object.fromEntries(keys.map((k,i)=>[k,match[i+1]]));return pair[language()==='es'?1:0].replace(/\{(\w+)\}/g,(_,k)=>values[k]);}
 }
 return null;
}
export const locale=()=>language()==='en'?'en-GB':'es-ES';
export function t(value) {
  const muscleNames={chest:'Chest',back:'Back',lowerBack:'Lower back',shoulders:'Shoulder',abs:'Abs',cardio:'Cardio',legs:'Legs',biceps:'Biceps',triceps:'Triceps'};
  if(language()==='en' && muscleNames[value])return muscleNames[value];
  const s=String(value??''), key=s.trim().replace(/\s+/g,' '), pair=dictionary.get(key);
  if(pair) return s.replace(s.trim(),pair[language()]);
  const formatted=formatTranslation(key); if(formatted!=null)return formatted;
  const loose=[...dictionary].find(([k])=>k.toLowerCase()===key.toLowerCase())?.[1];
  if(loose)return loose[language()];
  const required=key.match(/^(.+?)\s*\*$/);if(required)return t(required[1])+' *';
  const bracket=key.match(/^(.+?) \(optional\)$/);if(bracket)return t(bracket[1])+' ('+t('optional')+')';
  const punct=key.match(/^(.+?)(:|\s+·|\s+—)\s*$/);if(punct&&dictionary.has(punct[1]))return t(punct[1])+punct[2]+' ';
  // Templates keep numbers and data unchanged.
  const patterns=[
    [/^(\d+) seasons?$/i, n=>language()==='es'?n+' temporadas':n+' seasons'],
    [/^(\d+) temporadas?$/i, n=>language()==='es'?n+' temporadas':n+' seasons'],
    [/^Temporada (\d+)$/i,n=>language()==='es'?'Temporada '+n:'Season '+n],
    [/^Released (\d+)$/,n=>language()==='es'?'Lanzamiento '+n:'Released '+n],
    [/^Played (\d+)$/,n=>language()==='es'?'Jugado '+n:'Played '+n],
    [/^(.+) remaining$/,n=>language()==='es'?n+' pendientes':n+' remaining'],
    [/^(.+) pendientes$/,n=>language()==='es'?n+' pendientes':n+' remaining'],
    [/^(.+)× · avg$/,n=>language()==='es'?n+'× · media':n+'× · avg']
  ];
  for(const [re,fn] of patterns){const m=key.match(re);if(m)return fn(m[1]);}
  if (key.includes(' · ')) return key.split(' · ').map(t).join(' · ');
  const decorated=key.match(/^([✏︎✎✓+⚠🔍↻→←]+\s*)(.+)$/u);
  if(decorated && dictionary.has(decorated[2])) return decorated[1]+t(decorated[2]);
  return s;
}
export function mediaTitle(item, lang=language()) {return item.translations?.[lang]?.title || item.title || '';}
export function localizedName(item) {return item?.translations?.[language()]?.name || item?.name || '';}
const originals=new WeakMap();
const excluded='script,style,textarea,.m-card-opinion,.m-card-title,[data-no-i18n],#gsiButton';
function translateNode(node) {
  if(node.nodeType===3) {
    if(!node.parentElement || node.parentElement.closest(excluded)) return;
    const old=originals.get(node), source=old && old.rendered===node.nodeValue?old.source:node.nodeValue;
    const rendered=t(source);
    originals.set(node,{source,rendered});
    if(node.nodeValue!==rendered)node.nodeValue=rendered;
  } else if(node.nodeType===1 && !node.matches(excluded)) {
    // Option text must never change the stored enum value.
    if(node.tagName==='OPTION' && !node.hasAttribute('value')) node.value=node.textContent;
    for(const attr of ['placeholder','title','aria-label']) {
      if(!node.hasAttribute(attr))continue;
      const key='i18n-'+attr, original=node.getAttribute('data-'+key) || node.getAttribute(attr);
      node.setAttribute('data-'+key,original);
      node.setAttribute(attr,t(original));
    }
    for(const child of node.childNodes)translateNode(child);
  }
}
let observer, chartInstalled=false;
export function translateUI() {
  observer?.disconnect();
  translateNode(document.body);
  document.documentElement.lang=language();
  observer?.observe(document.body,{subtree:true,childList:true,characterData:true});
}
export function initI18n() {
  observer=new MutationObserver(records=>{
    observer.disconnect();
    for(const r of records) {
      if(r.type==='characterData') translateNode(r.target);
      else for(const n of r.addedNodes)translateNode(n);
    }
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  });
  translateUI();
  if(window.Chart?.register && !chartInstalled) {
    Chart.register({id:'dashboardLanguage',beforeUpdate(chart){
      if(chart.data.labels)chart.data.labels=chart.data.labels.map(v=>typeof v==='string'?t(v):v);
      for(const ds of chart.data.datasets||[]) if(ds.label)ds.label=t(ds.label);
      for(const axis of Object.values(chart.options.scales||{})) if(axis.title?.text)axis.title.text=t(axis.title.text);
      const center=chart.options.plugins?.centerText;if(center?.label)center.label=t(center.label);
    }});
    chartInstalled=true;
  }
}
