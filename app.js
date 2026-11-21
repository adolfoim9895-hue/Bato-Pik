/* Radar Local · interfaz estática para GitHub Pages. Sin secretos ni llamadas privadas. */
(() => {
'use strict';
const $ = (sel) => document.querySelector(sel);
const TZ = 'America/Tijuana';
const state = {data:null, date:null, filter:'todos', query:'', favorites:new Set(), demo:false};
try { state.favorites = new Set(JSON.parse(localStorage.getItem('radar_local_favoritos') || '[]')); } catch {}

const DEMO_MATCHES = [
  {id:99101,offset:0,local:'Atlético del Valle',visita:'Unión del Este',liga:'Liga de demostración',pais:'Ficticio',probabilidades:{local:81,empate:12,visita:7},confianza:'alta',marcador:'3-0',goles_esperados:{local:2.7,visita:0.5},muestra:{liga:98,local_casa:8,visita_fuera:7,local_total:16,visita_total:15}},
  {id:99102,offset:0,local:'Deportivo Bahía',visita:'Real Noroeste',liga:'Liga de demostración',pais:'Ficticio',probabilidades:{local:68,empate:20,visita:12},confianza:'media',marcador:'2-0',goles_esperados:{local:1.9,visita:0.7},muestra:{liga:83,local_casa:7,visita_fuera:6,local_total:14,visita_total:13}},
  {id:99103,offset:1,local:'Cumbres FC',visita:'Costa Atlántica',liga:'Liga de demostración',pais:'Ficticio',probabilidades:{local:77,empate:15,visita:8},confianza:'alta',marcador:'2-0',goles_esperados:{local:2.3,visita:0.5},muestra:{liga:71,local_casa:6,visita_fuera:6,local_total:13,visita_total:13}},
  {id:99104,offset:2,local:'Puerto del Sol',visita:'Académicos',liga:'Liga de demostración',pais:'Ficticio',probabilidades:{local:64,empate:23,visita:13},confianza:'media',marcador:'1-0',goles_esperados:{local:1.6,visita:0.7},muestra:{liga:55,local_casa:6,visita_fuera:5,local_total:12,visita_total:12}}
];
const fmt = new Intl.DateTimeFormat('es-MX', {timeZone:TZ, weekday:'short', day:'numeric', month:'short'});
const clockFmt = new Intl.DateTimeFormat('es-MX',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false});
const esc = (v) => String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const dateKey = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const o = Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${o.year}-${o.month}-${o.day}`;
};
const addDays = (date, delta) => {
  const dt = new Date(`${date}T12:00:00Z`); dt.setUTCDate(dt.getUTCDate()+delta); return dt.toISOString().slice(0,10);
};
const dateView = (d) => fmt.format(new Date(`${d}T18:00:00Z`));
const dates = () => state.data ? Array.from({length:7},(_,i)=>addDays(state.data.inicio,i)) : [];
const imageSrc = (raw) => /^https:\/\/(media\.api-sports\.io|media\.api-football\.com|media\.api-sports\.io|.*\.api-sports\.io)\//i.test(raw||'') ? raw : '';
const teamLogo = (name,src) => imageSrc(src) ? `<img class="team-logo" src="${esc(src)}" loading="lazy" alt="" onerror="this.style.display='none'">` : `<div class="team-logo-fallback" aria-hidden="true">${esc((name||'?')[0].toUpperCase())}</div>`;
const fixtureCount = (d) => state.data.partidos.filter(m=>dateKey(m.fecha)===d).length;
function makeDemo() {
 const today = dateKey(new Date());
 return {version:1,estado:'demo',actualizado:new Date().toISOString(),inicio:today,fin:addDays(today,6),cobertura:{},partidos:DEMO_MATCHES.map(m=>({
  ...m,fecha:`${addDays(today,m.offset)}T16:00:00-08:00`,local_logo:null,visita_logo:null,liga_logo:null,
  forma:{local:[],visita:[]},h2h:[],marcadores:[{marcador:m.marcador,porcentaje:14}],
  rivales:{ppg_local:2.2,ppg_visita:0.9},advertencias:['Datos ficticios para probar el diseño; no son pronósticos reales.']
 }))};
}
function setData(data) {
 state.data=data;
 const today=dateKey(new Date());
 state.date=dates().includes(today)?today:dates()[0];
 render();
}
function render() {
 if(!state.data)return;
 const matches=state.data.partidos;
 $('#totalCount').textContent=matches.length;
 $('#highCount').textContent=matches.filter(m=>m.confianza==='alta').length;
 $('#mediumCount').textContent=matches.filter(m=>m.confianza==='media').length;
 const updated = new Date(state.data.actualizado);
 $('#updatedShort').textContent=state.demo?'DEMO':Number.isFinite(updated.getTime())?`Actualizado ${clockFmt.format(updated)}`:'Sin actualizar';
 const datesList=dates();
 $('#weekRange').textContent=`${dateView(datesList[0])} — ${dateView(datesList[6])}`;
 const today=dateKey(new Date());
 $('#days').innerHTML=datesList.map(d=>{
  const n=Number(d.slice(8,10)); const w=dateView(d).split(' ')[0].replace('.','');
  const label=d===today?'Hoy':d===addDays(today,1)?'Mañana':w;
  return `<button class="day ${d===state.date?'active':''}" type="button" data-date="${d}" aria-pressed="${d===state.date}"><span class="name">${esc(label)}</span><span class="number">${n}</span><span class="count">${fixtureCount(d)} picks</span></button>`;
 }).join('');
 const at=datesList.indexOf(state.date);
 $('#dayPrev').disabled=at<=0; $('#dayNext').disabled=at>=6;
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===state.filter);b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter));});
 const query=state.query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
 const selected=matches.filter(m=>dateKey(m.fecha)===state.date)
  .filter(m=>state.filter==='todos'||(state.filter==='favoritos'?state.favorites.has(String(m.id)):state.filter===m.confianza))
  .filter(m=>[m.local,m.visita,m.liga,m.pais].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))
  .sort((a,b)=>b.probabilidades.local-a.probabilidades.local);
 $('#dayCount').textContent=`${selected.length} partidos`;
 const cover=state.data.cobertura || {};
 const note=$('#sourceNote'); note.classList.remove('warning');
 if(state.demo){note.textContent='MODO DEMOSTRACIÓN: partidos inventados para mostrar el funcionamiento. No usar para apostar.';note.classList.add('warning');}
 else if(state.data.estado==='sin_configurar'){note.innerHTML='La API todavía no está conectada. <button class="inline-demo" id="showDemo">Ver demostración</button> · Agrega APISPORTS_KEY en GitHub Secrets.';note.classList.add('warning');}
 else if(state.data.estado==='error'||state.data.estado==='sin_datos'){note.innerHTML=`${esc(state.data.mensaje||'No hay datos disponibles.')} <button class="inline-demo" id="showDemo">Ver demostración</button>`;note.classList.add('warning');}
 else {note.textContent=`Fuente: API-Football · ${cover.ligas_consultadas??0} ligas consultadas de ${cover.ligas_detectadas??'?'} detectadas · ${cover.partidos_programados_en_api??'?'} encuentros en el calendario · No incluye juegos sin datos suficientes.`; if(cover.ligas_omitidas_por_limite>0)note.classList.add('warning');}
 // Estilo de enlace del botón interno de demo, no se necesitan dependencias.
 document.querySelectorAll('.inline-demo').forEach(btn=>{btn.style.cssText='color:#22db99;background:transparent;border:0;text-decoration:underline;font-weight:800;padding:2px';btn.addEventListener('click',()=>{state.demo=true;setData(makeDemo());});});
 $('#fixtures').innerHTML=selected.map(matchMarkup).join('');
 $('#empty').classList.toggle('hidden',selected.length>0);
 $('#emptyText').textContent=state.data.estado!=='ok'&&!state.demo?'No hay pronósticos reales hasta conectar la API.':'No hay locales con al menos 60% estimado y datos suficientes para este filtro. Prueba otro día o categoría.';
 // Los botones de favoritos deben sobrevivir al rerender.
 document.querySelectorAll('.star').forEach(btn=>btn.addEventListener('click',()=>{
   const id=String(btn.dataset.id); if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);
   try{localStorage.setItem('radar_local_favoritos',JSON.stringify([...state.favorites]));}catch{}
   render();
 }));
}
function matchMarkup(m) {
 const ps=m.probabilidades||{local:0,empate:0,visita:0};
 const high=m.confianza==='alta';
 const isFav=state.favorites.has(String(m.id));
 const lg=imageSrc(m.liga_logo)?`<img class="league-logo" src="${esc(m.liga_logo)}" alt="">`:'';
 const hrec=(m.form?.local||[]).slice(0,5);
 const arec=(m.form?.visita||[]).slice(0,5);
 const recent=(records)=>records.length?`<div class="form-row">${records.map(r=>`<span class="form-tag ${String(r.resultado||'').toLowerCase()}" title="${esc((r.lugar||'')+' contra '+(r.rival||''))}">${esc(r.resultado)} ${esc(r.marcador)} · ${esc(r.rival)}</span>`).join('')}</div>`:'<p>Sin historial suficiente.</p>';
 const warnings=(m.advertencias||[]).map(w=>`<p class="warningline">⚠ ADVERTENCIA: ${esc(w)}</p>`).join('');
 const h2h=(m.h2h||[]).length?`<p>${m.h2h.slice(0,5).map(x=>`${esc(x.fecha)}: ${esc(x.local)} ${esc(x.marcador)} ${esc(x.visita)}`).join('<br>')}</p>`:'<p>Sin H2H confirmado: no se inventan enfrentamientos anteriores.</p>';
 const scoreOptions=(m.marcadores||[]).length ? `<div class="mini-score">${m.marcadores.map(x=>`<span>${esc(x.marcador)} · ${Number(x.porcentaje).toFixed(1)}%</span>`).join('')}</div>` : '';
 return `<article class="fixture">
  <div class="fixture-top"><div class="league">${lg}<div><span>${esc(m.liga)}</span> <div class="country">${esc(m.pais)}</div></div></div><div class="top-actions"><span class="game-time">${esc(clockFmt.format(new Date(m.fecha)))} h</span><button class="star ${isFav?'active':''}" data-id="${esc(m.id)}" aria-label="${isFav?'Quitar favorito':'Guardar favorito'}" aria-pressed="${isFav}">${isFav?'★':'☆'}</button></div></div>
  <div class="teams"><div class="team-info">${teamLogo(m.local,m.local_logo)}<div><div class="team-role">Local</div><div class="team-name">${esc(m.local)}</div></div></div><div class="teams-vs">VS</div><div class="team-info team-away"><div><div class="team-role">Visita</div><div class="team-name">${esc(m.visita)}</div></div>${teamLogo(m.visita,m.visita_logo)}</div></div>
  <div class="prob-bars" role="img" aria-label="Local ${ps.local}%, empate ${ps.empate}%, visita ${ps.visita}%"><div class="prob-bar-home" style="width:${Number(ps.local)}%"></div><div class="prob-bar-draw" style="width:${Number(ps.empate)}%"></div><div class="prob-bar-away" style="width:${Number(ps.visita)}%"></div></div>
  <div class="probs"><span>Local ${ps.local}%</span><span>Empate ${ps.empate}%</span><span>Visita ${ps.visita}%</span></div>
  <div class="game-bottom"><div><div class="pickline">Gana ${esc(m.local)} · <strong>${ps.local}%</strong></div><div class="score">Marcador más probable: <b>${esc(m.marcador)}</b> · Goles estimados: ${esc(m.goles_esperados?.local??'?')}–${esc(m.goles_esperados?.visita??'?')}</div></div><div class="confidence ${high?'alta':'media'}">${high?'✦ CONFIANZA ALTA':'◈ CONFIANZA MEDIA'}</div></div>
  <details class="details"><summary>Ver análisis · Forma, rivales, H2H y advertencias</summary><div class="details-body">
  <div class="details-grid"><div class="item"><span>Historial del local en casa</span><strong>${Number(m.muestra?.local_casa||0)} partidos</strong></div><div class="item"><span>Historial del visitante fuera</span><strong>${Number(m.muestra?.visita_fuera||0)} partidos</strong></div><div class="item"><span>Puntos/partido del local</span><strong>${esc(m.rivales?.ppg_local??'—')}</strong></div><div class="item"><span>Puntos/partido visitante</span><strong>${esc(m.rivales?.ppg_visita??'—')}</strong></div></div>
  <h3>Últimos partidos del local, con identificación del rival</h3>${recent(hrec)}
  <h3>Últimos partidos del visitante</h3>${recent(arec)}
  <h3>Enfrentamientos directos (H2H)</h3>${h2h}
  <h3>Marcadores exactos estimados</h3>${scoreOptions}
  <h3>Riesgos del análisis</h3>${warnings}
  <p style="font-size:10px;color:#6f849a;margin-top:11px">Modelo estadístico sin cuotas. Las etiquetas no garantizan resultados; comprueba alineaciones, bajas y noticias actuales.</p>
  </div></details>
 </article>`;
}

$('#days').addEventListener('click',(ev)=>{const btn=ev.target.closest('[data-date]');if(!btn)return;state.date=btn.dataset.date;render();});
$('#dayPrev').addEventListener('click',()=>{const i=dates().indexOf(state.date);if(i>0){state.date=dates()[i-1];render();}});
$('#dayNext').addEventListener('click',()=>{const i=dates().indexOf(state.date);if(i>=0&&i<6){state.date=dates()[i+1];render();}});
$('#filterPills').addEventListener('click',(ev)=>{const btn=ev.target.closest('[data-filter]');if(!btn)return;state.filter=btn.dataset.filter;render();});
$('#search').addEventListener('input',(ev)=>{state.query=ev.target.value;render();});
$('#aboutBtn').addEventListener('click',()=>$('#aboutDialog').showModal());
$('#closeDialog').addEventListener('click',()=>$('#aboutDialog').close());
$('#aboutDialog').addEventListener('click',(ev)=>{if(ev.target.id==='aboutDialog')ev.target.close();});

async function init() {
 if (window.RADAR_DEMO === true) { state.demo = true; setData(makeDemo()); return; }
 try {
  const response=await fetch('./data/predictions.json?t='+Date.now(), {cache:'no-store'});
  if(!response.ok)throw new Error('Datos no publicados');
  const data=await response.json();
  if(!data || !Array.isArray(data.partidos)|| !/^\d{4}-\d{2}-\d{2}$/.test(data.inicio||'')) throw new Error('JSON inválido');
  setData(data);
 }catch(ex){setData({estado:'error',mensaje:'Sin conexión a datos. Publica esta carpeta en GitHub Pages o ejecuta un servidor local.',inicio:dateKey(new Date()),actualizado:new Date().toISOString(),cobertura:{},partidos:[]});}
 if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
})();
