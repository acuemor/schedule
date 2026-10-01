const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const clothingLabels = { tracksuit: { icon: '🏃', label: 'Chándal' }, uniform: { icon: '🧥', label: 'Ropa de calle' } };
const activityLabels = { taekwondo: { icon: '🥋', label: 'Taekwondo' }, music: { icon: '🎵', label: 'Música' } };
const $ = selector => document.querySelector(selector);
const WEEKEND_STORAGE_KEY = 'familyScheduleShowWeekend';
const clone = value => JSON.parse(JSON.stringify(value));
const defaultSchedule = clone(schedule);
const defaultEvents = clone(events).map((event, index) => ({ ...event, id: `initial-${index}` }));
let currentSchedule = clone(defaultSchedule);
let currentEvents = clone(defaultEvents);
let weekOffset = 0;
let showWeekend = readWeekendPreference();
let supabaseClient = null;
let familyId = null;
let currentUser = null;
let realtimeChannel = null;
let lastUpdatedAt = null;
let isSaving = false;

function readWeekendPreference() {
  try { return localStorage.getItem(WEEKEND_STORAGE_KEY) === 'true'; } catch { return false; }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function slugify(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nino';
}
function setCloudStatus(message, state = '') {
  const status = $('#cloudStatus');
  status.textContent = message;
  status.dataset.state = state;
}
function configPayload() {
  return { schedule: currentSchedule, events: currentEvents };
}
async function persistConfig() {
  if (!supabaseClient || !familyId || !currentUser) {
    setCloudStatus('Inicia sesión para guardar los cambios.', 'error');
    return false;
  }
  isSaving = true;
  setCloudStatus('Guardando cambios…', 'saving');
  const { data, error } = await supabaseClient
    .from('family_config')
    .upsert({ family_id: familyId, config: configPayload(), updated_by: currentUser.id }, { onConflict: 'family_id' })
    .select('updated_at')
    .single();
  isSaving = false;
  if (error) {
    setCloudStatus(`No se ha podido guardar: ${error.message}`, 'error');
    return false;
  }
  lastUpdatedAt = data?.updated_at || lastUpdatedAt;
  setCloudStatus('✓ Sincronizado con la nube', 'ok');
  return true;
}
async function loadConfig() {
  const { data, error } = await supabaseClient
    .from('family_config')
    .select('config, updated_at')
    .eq('family_id', familyId)
    .maybeSingle();
  if (error) throw error;
  if (data?.config?.schedule && Array.isArray(data.config.events)) {
    currentSchedule = data.config.schedule;
    currentEvents = data.config.events;
    lastUpdatedAt = data.updated_at;
  } else {
    currentSchedule = clone(defaultSchedule);
    currentEvents = clone(defaultEvents);
    const saved = await persistConfig();
    if (!saved) throw new Error('No se pudo crear la configuración inicial de la familia.');
  }
}
function renderApplication() {
  renderChildEditor();
  renderEventsEditor();
  renderWeek();
}
async function startRealtime() {
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient.channel(`family-config-${familyId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'family_config',
      filter: `family_id=eq.${familyId}`,
    }, payload => {
      if (isSaving || !payload.new?.config) return;
      currentSchedule = payload.new.config.schedule || {};
      currentEvents = payload.new.config.events || [];
      lastUpdatedAt = payload.new.updated_at || lastUpdatedAt;
      renderApplication();
      setCloudStatus('✓ Actualizado desde el otro dispositivo', 'ok');
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') setCloudStatus('✓ Sincronizado con la nube', 'ok');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setCloudStatus('Conectando… comprueba tu conexión.', 'error');
    });
}
async function enterApplication(session) {
  currentUser = session.user;
  $('#authPanel').hidden = true;
  $('#appContent').hidden = false;
  $('#userEmail').textContent = currentUser.email || 'Sesión iniciada';
  try {
    await loadConfig();
    renderApplication();
    await startRealtime();
  } catch (error) {
    setCloudStatus(`Error al cargar los datos: ${error.message}`, 'error');
  }
}
async function signOut() {
  if (realtimeChannel) {
    await supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  await supabaseClient.auth.signOut();
  currentUser = null;
  $('#appContent').hidden = true;
  $('#authPanel').hidden = false;
  setCloudStatus('Sesión cerrada.');
}
async function initialiseCloud() {
  if (!window.supabase?.createClient) {
    setCloudStatus('No se ha podido cargar Supabase. Revisa la conexión.');
    return;
  }
  const settings = window.SUPABASE_CONFIG || {};
  if (!settings.url || !settings.anonKey || !settings.familyId ||
      settings.url.includes('TU-PROYECTO') || settings.anonKey.includes('TU-CLAVE')) {
    $('#setupWarning').hidden = false;
    $('#appContent').hidden = true;
    $('#authPanel').hidden = true;
    return;
  }
  familyId = settings.familyId;
  supabaseClient = window.supabase.createClient(settings.url, settings.anonKey);
  $('#authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    const action = $('#authAction').value;
    $('#authSubmit').disabled = true;
    $('#authMessage').textContent = 'Procesando…';
    const result = action === 'signup'
      ? await supabaseClient.auth.signUp({ email, password })
      : await supabaseClient.auth.signInWithPassword({ email, password });
    $('#authSubmit').disabled = false;
    if (result.error) {
      $('#authMessage').textContent = result.error.message;
      return;
    }
    if (action === 'signup' && !result.data.session) {
      $('#authMessage').textContent = 'Cuenta creada. Revisa tu correo para confirmar la dirección y después inicia sesión.';
      return;
    }
    $('#authMessage').textContent = 'Acceso correcto.';
    if (result.data.session) await enterApplication(result.data.session);
  });
  $('#authMode').addEventListener('click', () => {
    const signup = $('#authAction').value !== 'signup';
    $('#authAction').value = signup ? 'signup' : 'login';
    $('#authSubmit').textContent = signup ? 'Crear cuenta' : 'Iniciar sesión';
    $('#authMode').textContent = signup ? 'Ya tengo cuenta' : 'Crear cuenta';
    $('#authMessage').textContent = signup ? 'Usa el mismo correo que hayas añadido a la familia.' : '';
  });
  $('#signOut').addEventListener('click', signOut);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session && !currentUser) setTimeout(() => enterApplication(session), 0);
    if (!session && currentUser) {
      currentUser = null;
      $('#appContent').hidden = true;
      $('#authPanel').hidden = false;
    }
  });
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await enterApplication(session);
  else {
    $('#authPanel').hidden = false;
    $('#appContent').hidden = true;
  }
}
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
  return Object.entries(currentSchedule[childKey]?.clothing || {}).find(([,days])=>(days||[]).includes(day))?.[0] || null;
}
function activitiesFor(childKey, day) {
  return Object.entries(currentSchedule[childKey]?.activities || {}).filter(([,days])=>(days||[]).includes(day)).map(([name])=>name);
}
function eventsFor(date) { return currentEvents.filter(event=>event.date===keyDate(date)); }
function activityInfo(name) {
  const known = activityLabels[name.toLowerCase()];
  return known || { icon: '⭐', label: name };
}
function eventMarkup(childKey,date) {
  return eventsFor(date).filter(e=>e.child===childKey).map(e=>`<div class="event">${escapeHtml(e.icon||'📌')} ${escapeHtml(e.title)}</div>`).join('');
}
function personMarkup(childKey,day,date) {
  const child=currentSchedule[childKey], clothing=clothingFor(childKey,day), info=clothingLabels[clothing];
  const pool=(child.pool||[]).includes(day);
  const activities=activitiesFor(childKey,day).map(a=>{const x=activityInfo(a);return `<div class="activity">${x.icon} ${escapeHtml(x.label)}</div>`;}).join('');
  return `<div class="child"><div class="child-name"><span class="avatar">👦</span>${escapeHtml(child.name)}</div>
    ${info?`<div class="clothing ${clothing}">${info.icon} ${info.label}</div>`:'<div class="not-configured">Ropa sin configurar</div>'}
    ${pool?'<div class="pool">🏊 Piscina</div>':''}${activities}${eventMarkup(childKey,date)}</div>`;
}
function renderToday(dates) {
  const today=new Date(), idx=dates.findIndex(d=>sameDate(d,today)), box=$('#todaySummary');
  if(weekOffset!==0 || idx<0 || (!showWeekend && idx>4)) { box.classList.remove('visible'); return; }
  const day=dayKeys[idx];
  const people=Object.keys(currentSchedule).map(key=>{
    const child=currentSchedule[key], clothes=clothingLabels[clothingFor(key,day)];
    const details=[clothes?`${clothes.icon} ${clothes.label}`:'Ropa sin configurar'];
    if((child.pool||[]).includes(day)) details.push('🏊 Piscina');
    activitiesFor(key,day).forEach(a=>{const x=activityInfo(a);details.push(`${x.icon} ${x.label}`);});
    eventsFor(today).filter(e=>e.child===key).forEach(e=>details.push(`${e.icon||'📌'} ${e.title}`));
    return `<div class="summary-person"><strong>${escapeHtml(child.name)}</strong><div class="summary-details">${details.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div></div>`;
  }).join('');
  const shared=eventsFor(today).filter(e=>e.child==='all').map(e=>`<div class="summary-shared">${escapeHtml(e.icon||'📌')} ${escapeHtml(e.title)}</div>`).join('');
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
    const shared=eventsFor(date).filter(e=>e.child==='all').map(e=>`<div class="event">${escapeHtml(e.icon||'📌')} ${escapeHtml(e.title)}</div>`).join('');
    return `<article class="day-card ${isToday?'is-today':''}"><header class="day-header"><div class="day-name">${dayNames[idx]}</div><div class="day-number">${date.getDate()}${isToday?'<span class="today-label">HOY</span>':''}</div></header><div class="children">${Object.keys(currentSchedule).map(k=>personMarkup(k,day,date)).join('')}</div>${shared?`<div class="shared-events">${shared}</div>`:''}</article>`;
  }).join('');
  renderToday(allDates);
}

/* Configuration editor */
function renderChildEditor() {
  const host = $('#childrenEditor');
  const keys = Object.keys(currentSchedule);
  if (!keys.length) { host.innerHTML = '<p class="empty-state">Todavía no hay niños. Pulsa «Añadir niño» para crear el primero.</p>'; }
  else host.innerHTML = keys.map(key => {
    const child = currentSchedule[key];
    const rows = dayKeys.map((day, index) => {
      const clothing = (child.clothing?.uniform || []).includes(day) ? 'uniform' : (child.clothing?.tracksuit || []).includes(day) ? 'tracksuit' : '';
      const pool = (child.pool || []).includes(day);
      const activities = Object.entries(child.activities || {}).filter(([,days]) => (days || []).includes(day)).map(([name]) => name).join(', ');
      return `<div class="day-edit-row">
        <strong>${dayNames[index][0].toUpperCase()+dayNames[index].slice(1)}</strong>
        <label>Ropa<select class="edit-clothing" data-day="${day}"><option value="">Sin especificar</option><option value="tracksuit" ${clothing==='tracksuit'?'selected':''}>🏃 Chándal</option><option value="uniform" ${clothing==='uniform'?'selected':''}>🧥 Ropa de calle</option></select></label>
        <label class="pool-check"><input type="checkbox" class="edit-pool" data-day="${day}" ${pool?'checked':''}> 🏊 Piscina</label>
        <label class="activity-edit">Extraescolares<input type="text" class="edit-activities" data-day="${day}" value="${escapeHtml(activities)}" placeholder="Ej. Taekwondo, Música"></label>
      </div>`;
    }).join('');
    return `<article class="child-editor" data-child-key="${escapeHtml(key)}">
      <div class="child-editor-heading"><label class="child-name-field">Nombre<input class="edit-child-name" type="text" value="${escapeHtml(child.name)}" maxlength="40" required></label><button class="remove-child text-danger" type="button" data-remove-child="${escapeHtml(key)}">Eliminar niño</button></div>
      <div class="day-edit-grid">${rows}</div>
    </article>`;
  }).join('');
  renderEventChildOptions();
}
function renderEventChildOptions() {
  const select = $('#eventChild');
  const previous = select.value;
  select.innerHTML = '<option value="all">Todos</option>' + Object.entries(currentSchedule).map(([key,child])=>`<option value="${escapeHtml(key)}">${escapeHtml(child.name)}</option>`).join('');
  if ([...select.options].some(option=>option.value===previous)) select.value=previous;
}
async function saveSchedule() {
  const next = {};
  document.querySelectorAll('.child-editor').forEach(card => {
    const key = card.dataset.childKey;
    const name = card.querySelector('.edit-child-name').value.trim();
    if (!name) return;
    const clothing = { uniform: [], tracksuit: [] }, pool = [], activities = {};
    card.querySelectorAll('.edit-clothing').forEach(select => {
      if (select.value) clothing[select.value].push(select.dataset.day);
    });
    card.querySelectorAll('.edit-pool:checked').forEach(input => pool.push(input.dataset.day));
    card.querySelectorAll('.edit-activities').forEach(input => {
      input.value.split(',').map(item=>item.trim()).filter(Boolean).forEach(activity => {
        if (!activities[activity]) activities[activity] = [];
        activities[activity].push(input.dataset.day);
      });
    });
    next[key] = { name, clothing, pool, activities };
  });
  if (Object.keys(next).length !== document.querySelectorAll('.child-editor').length) {
    $('#scheduleStatus').textContent = 'Revisa los nombres: no pueden estar vacíos.';
    return;
  }
  currentSchedule = next;
  currentEvents = currentEvents.filter(event=>event.child==='all' || currentSchedule[event.child]);
  if (await persistConfig()) {
    renderWeek(); renderChildEditor(); renderEventsEditor();
    $('#scheduleStatus').textContent = '✓ Horarios guardados';
  }
}
async function addChild() {
  const name = prompt('¿Cómo se llama el niño o la niña?');
  if (!name || !name.trim()) return;
  const base = slugify(name.trim());
  let key = base, suffix = 2;
  while (currentSchedule[key]) key = `${base}-${suffix++}`;
  currentSchedule[key] = { name: name.trim(), clothing: { uniform: [], tracksuit: [] }, pool: [], activities: {} };
  if (await persistConfig()) { renderChildEditor(); renderWeek(); $('#scheduleStatus').textContent='Nuevo niño añadido. Configura sus días y pulsa Guardar horarios.'; }
}
function renderEventsEditor() {
  const host = $('#eventsEditor');
  if (!currentEvents.length) { host.innerHTML = '<p class="empty-state">No hay eventos puntuales configurados.</p>'; return; }
  host.innerHTML = [...currentEvents].sort((a,b)=>a.date.localeCompare(b.date)).map(event => {
    const who = event.child==='all' ? 'Todos' : (currentSchedule[event.child]?.name || 'Niño eliminado');
    return `<div class="event-edit-item"><div class="event-edit-icon">${escapeHtml(event.icon||'📌')}</div><div class="event-edit-copy"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.date)} · ${escapeHtml(who)}</span></div><button type="button" class="text-button edit-event" data-edit-event="${escapeHtml(event.id)}">Editar</button><button type="button" class="text-danger delete-event" data-delete-event="${escapeHtml(event.id)}">Borrar</button></div>`;
  }).join('');
}
function resetEventForm() {
  $('#eventForm').reset(); $('#editingEventId').value=''; $('#eventSubmit').textContent='Añadir evento'; $('#cancelEventEdit').hidden=true;
}
async function saveEvent(event) {
  event.preventDefault();
  const id = $('#editingEventId').value;
  const item = { id: id || `event-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, date: $('#eventDate').value, child: $('#eventChild').value, title: $('#eventTitle').value.trim(), icon: $('#eventIcon').value.trim() || '📌' };
  if (!item.date || !item.title) return;
  if (id) currentEvents = currentEvents.map(existing=>existing.id===id?item:existing);
  else currentEvents.push(item);
  if (await persistConfig()) { resetEventForm(); renderEventsEditor(); renderWeek(); }
}
function editEvent(id) {
  const event = currentEvents.find(item=>item.id===id); if (!event) return;
  $('#editingEventId').value=id; $('#eventDate').value=event.date; $('#eventChild').value=event.child;
  $('#eventTitle').value=event.title; $('#eventIcon').value=event.icon||'';
  $('#eventSubmit').textContent='Guardar cambios'; $('#cancelEventEdit').hidden=false;
  $('#eventForm').scrollIntoView({behavior:'smooth',block:'center'});
}
function exportConfig() {
  const payload = { schedule: currentSchedule, events: currentEvents };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href=url; link.download='configuracion-semana-familiar.json'; link.click(); URL.revokeObjectURL(url);
}
async function importConfig(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.schedule || typeof data.schedule!=='object' || !Array.isArray(data.events)) throw new Error('Formato no válido');
    for (const [key,child] of Object.entries(data.schedule)) {
      if (!child.name || typeof child.name!=='string') throw new Error(`Datos incorrectos para ${key}`);
    }
    currentSchedule=data.schedule;
    currentEvents=data.events.map((event,index)=>({...event,id:event.id||`import-${Date.now()}-${index}`})).filter(event=>event.date && event.title && (event.child==='all' || currentSchedule[event.child]));
    if (await persistConfig()) { renderWeek(); renderChildEditor(); renderEventsEditor(); resetEventForm(); alert('Configuración importada correctamente.'); }
  } catch (error) { alert(`No se ha podido importar el archivo: ${error.message}`); }
  $('#importConfig').value='';
}
function setConfigVisible(visible) {
  $('#configPanel').hidden=!visible;
  $('#toggleConfig').setAttribute('aria-expanded',String(visible));
  $('#toggleConfig').textContent=visible?'✕ Cerrar configuración':'⚙️ Configurar calendario';
  if (visible) $('#configPanel').scrollIntoView({behavior:'smooth',block:'start'});
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
$('#toggleConfig').addEventListener('click',()=>setConfigVisible($('#configPanel').hidden));
$('#closeConfig').addEventListener('click',()=>setConfigVisible(false));
$('#addChild').addEventListener('click',addChild);
$('#saveSchedule').addEventListener('click',saveSchedule);
$('#eventForm').addEventListener('submit',saveEvent);
$('#cancelEventEdit').addEventListener('click',resetEventForm);
$('#exportConfig').addEventListener('click',exportConfig);
$('#importConfig').addEventListener('change',event=>importConfig(event.target.files[0]));
$('#childrenEditor').addEventListener('click',async event=>{
  const button=event.target.closest('[data-remove-child]'); if (!button) return;
  const key=button.dataset.removeChild, name=currentSchedule[key]?.name;
  if (!confirm(`¿Eliminar a ${name} y sus eventos asociados?`)) return;
  delete currentSchedule[key]; currentEvents=currentEvents.filter(item=>item.child!==key);
  if (await persistConfig()) { renderChildEditor(); renderEventsEditor(); renderWeek(); }
});
$('#eventsEditor').addEventListener('click',async event=>{
  const edit=event.target.closest('[data-edit-event]');
  const remove=event.target.closest('[data-delete-event]');
  if (edit) editEvent(edit.dataset.editEvent);
  if (remove) {
    currentEvents=currentEvents.filter(item=>item.id!==remove.dataset.deleteEvent);
    if (await persistConfig()) { renderEventsEditor(); renderWeek(); }
  }
});

initialiseCloud();
