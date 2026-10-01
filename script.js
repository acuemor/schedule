const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const clothingLabels = { tracksuit: { icon: '🏃', label: 'Chándal' }, uniform: { icon: '🧥', label: 'Uniforme de calle' } };
const activityLabels = { taekwondo: { icon: '🥋', label: 'Taekwondo' }, music: { icon: '🎵', label: 'Música' } };
let weekOffset = 0;
const $ = selector => document.querySelector(selector);
const WEEKEND_STORAGE_KEY = 'familyScheduleShowWeekend';

function readWeekendPreference() {
  try { return localStorage.getItem(WEEKEND_STORAGE_KEY) === 'true'; }
  catch { return false; }
}
let showWeekend = readWeekendPreference();

function startOfWeek(date) {
  const d = new Date(date), weekday = d.getDay();
  d.setDate(d.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  d.setHours(0,0,0,0);
  return d;
}
function sameDate(a,b) { return a.toDateString() === b.toDateString(); }
function keyDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDate(d) { return `${d.getDate()} de ${months[d.getMonth()]}`; }
function getWeekDates(offset) {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + offset * 7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });
}
function clothingFor(childKey, day) {
  return Object.entries(schedule[childKey].clothing || {}).find(([,days])=>(days||[]).includes(day))?.[0] || null;
}
function activitiesFor(childKey, day) {
  return Object.entries(schedule[childKey].activities || {}).filter(([,days])=>(days||[]).includes(day)).map(([name])=>name);
}
function eventsFor(date) { return events.filter(event=>event.date===keyDate(date)); }
function eventMarkup(childKey,date) {
  return eventsFor(date).filter(e=>e.child===childKey).map(e=>`<div class="event">${e.icon||'📌'} ${e.title}</div>`).join('');
}
function personMarkup(childKey,day,date) {
  const child=schedule[childKey], clothing=clothingFor(childKey,day), info=clothingLabels[clothing];
  const pool=(child.pool||[]).includes(day);
  const activities=activitiesFor(childKey,day).map(a=>{const x=activityLabels[a]||{icon:'⭐',label:a};return `<div class="activity">${x.icon} ${x.label}</div>`;}).join('');
  return `<div class="child"><div class="child-name"><span class="avatar">👦</span>${child.name}</div>
    ${info?`<div class="clothing ${clothing}">${info.icon} ${info.label}</div>`:'<div class="not-configured">Ropa sin configurar</div>'}
    ${pool?'<div class="pool">🏊 Piscina</div>':''}${activities}${eventMarkup(childKey,date)}</div>`;
}
function renderToday(dates) {
  const today=new Date(), idx=dates.findIndex(d=>sameDate(d,today)), box=$('#todaySummary');
  if(weekOffset!==0 || idx<0 || (!showWeekend && idx>4)) { box.classList.remove('visible'); return; }
  const day=dayKeys[idx];
  const people=Object.keys(schedule).map(key=>{
    const child=schedule[key], clothes=clothingLabels[clothingFor(key,day)];
    const details=[clothes?`${clothes.icon} ${clothes.label}`:'Ropa sin configurar'];
    if((child.pool||[]).includes(day)) details.push('🏊 Piscina');
    activitiesFor(key,day).forEach(a=>{const x=activityLabels[a]||{icon:'⭐',label:a};details.push(`${x.icon} ${x.label}`);});
    eventsFor(today).filter(e=>e.child===key).forEach(e=>details.push(`${e.icon||'📌'} ${e.title}`));
    return `<div class="summary-person"><strong>${child.name}</strong><div class="summary-details">${details.map(x=>`<span>${x}</span>`).join('')}</div></div>`;
  }).join('');
  const shared=eventsFor(today).filter(e=>e.child==='all').map(e=>`<div class="summary-shared">${e.icon||'📌'} ${e.title}</div>`).join('');
  const dayName=dayNames[idx];
  box.innerHTML=`<div class="summary-label">PARA HOY</div><div class="summary-title">${dayName[0].toUpperCase()+dayName.slice(1)}, ${formatDate(today)}</div><div class="summary-people">${people}</div>${shared}`;
  box.classList.add('visible');
}
function renderWeek() {
  const allDates=getWeekDates(weekOffset);
  const dates=showWeekend?allDates:allDates.slice(0,5);
  const today=new Date();
  $('#weekLabel').textContent=weekOffset===0?'Esta semana':`Semana ${weekOffset>0?'+':''}${weekOffset}`;
  $('#weekRange').textContent=`${formatDate(dates[0])} · ${formatDate(dates[dates.length-1])}`;
  $('#todayPill').textContent=`Hoy · ${dayNames[today.getDay()===0?6:today.getDay()-1]} ${today.getDate()}`;
  $('#weekGrid').classList.toggle('full-week',showWeekend);
  $('#weekGrid').innerHTML=dates.map(date=>{
    const idx=allDates.findIndex(d=>sameDate(d,date));
    const day=dayKeys[idx], isToday=sameDate(date,today);
    const shared=eventsFor(date).filter(e=>e.child==='all').map(e=>`<div class="event">${e.icon||'📌'} ${e.title}</div>`).join('');
    return `<article class="day-card ${isToday?'is-today':''}"><header class="day-header"><div class="day-name">${dayNames[idx]}</div><div class="day-number">${date.getDate()}${isToday?'<span class="today-label">HOY</span>':''}</div></header><div class="children">${Object.keys(schedule).map(k=>personMarkup(k,day,date)).join('')}</div>${shared?`<div class="shared-events">${shared}</div>`:''}</article>`;
  }).join('');
  renderToday(allDates);
}
$('#previousWeek').addEventListener('click',()=>{weekOffset--;renderWeek();});
$('#nextWeek').addEventListener('click',()=>{weekOffset++;renderWeek();});
$('#currentWeek').addEventListener('click',()=>{weekOffset=0;renderWeek();});
$('#showWeekend').checked=showWeekend;
$('#showWeekend').addEventListener('change',event=>{
  showWeekend=event.target.checked;
  try { localStorage.setItem(WEEKEND_STORAGE_KEY,String(showWeekend)); } catch {}
  renderWeek();
});
renderWeek();
