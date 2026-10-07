    const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const clothingLabels = {
      tracksuit: { icon: '🏃', label: 'Chándal' },
      uniform: { icon: '🧥', label: 'Ropa de calle' },
    };
    const activityLabels = {
      taekwondo: { icon: '🥋', label: 'Taekwondo' },
      music: { icon: '🎵', label: 'Música' },
    };
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
      return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
    }

    function slugify(value) {
      return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'persona';
    }

    function setCloudStatus(message, state = '') {
      const status = $('#cloudStatus');
      status.textContent = message;
      status.dataset.state = state;
    }

    function isAdult(person) {
      return person?.type === 'adult';
    }

    function normaliseSchedule(source) {
      const result = {};
      Object.entries(source || {}).forEach(([key, raw]) => {
        const person = raw || {};
        const adult = person.type === 'adult';
        result[key] = adult
          ? { name: person.name || key, type: 'adult' }
          : {
              name: person.name || key,
              type: 'child',
              clothing: {
                uniform: [...(person.clothing?.uniform || [])],
                tracksuit: [...(person.clothing?.tracksuit || [])],
              },
              pool: [...(person.pool || [])],
              activities: clone(person.activities || {}),
            };
      });

      // Migración: cualquier persona existente sin "type" se considera niño.
      // Añadimos a Abel y Raquel solo si todavía no existen.
      if (!result.abel) result.abel = { name: 'Abel', type: 'adult' };
      else result.abel.type = 'adult';
      if (!result.raquel) result.raquel = { name: 'Raquel', type: 'adult' };
      else result.raquel.type = 'adult';

      return result;
    }

    function normaliseEvents(source, people) {
      return (Array.isArray(source) ? source : [])
        .map((event, index) => ({
          ...event,
          id: event.id || `migrated-${index}-${Date.now()}`,
          person: event.person || event.child || 'all',
        }))
        .filter(event => event.date && event.title && (event.person === 'all' || people[event.person]));
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
        const oldSchedule = data.config.schedule;
        const oldEvents = data.config.events;
        currentSchedule = normaliseSchedule(oldSchedule);
        currentEvents = normaliseEvents(oldEvents, currentSchedule);
        lastUpdatedAt = data.updated_at;

        // Persistimos únicamente si hay que migrar la estructura.
        const oldScheduleText = JSON.stringify(oldSchedule);
        const oldEventsText = JSON.stringify(oldEvents);
        if (oldScheduleText !== JSON.stringify(currentSchedule) || oldEventsText !== JSON.stringify(currentEvents)) {
          await persistConfig();
        }
      } else {
        currentSchedule = normaliseSchedule(defaultSchedule);
        currentEvents = normaliseEvents(defaultEvents, currentSchedule);
        const saved = await persistConfig();
        if (!saved) throw new Error('No se pudo crear la configuración inicial de la familia.');
      }
    }

    function renderApplication() {
      renderPeopleEditor();
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
          currentSchedule = normaliseSchedule(payload.new.config.schedule || {});
          currentEvents = normaliseEvents(payload.new.config.events || [], currentSchedule);
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
        $('#authPanel').hidden = false;
        $('#appContent').hidden = true;
        $('#authMessage').textContent = 'No se ha podido cargar Supabase. Revisa la conexión e inténtalo de nuevo.';
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
        $('#authMessage').textContent = signup ? 'Usa el correo con el que quieras acceder.' : '';
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
      const d = new Date(date);
      const weekday = d.getDay();
      d.setDate(d.getDate() + (weekday === 0 ? -6 : 1 - weekday));
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function sameDate(a, b) { return a.toDateString() === b.toDateString(); }
    function keyDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    function formatDate(d) { return `${d.getDate()} de ${months[d.getMonth()]}`; }

    function getWeekDates(offset) {
      const start = startOfWeek(new Date());
      start.setDate(start.getDate() + offset * 7);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }

    function clothingFor(personKey, day) {
      return Object.entries(currentSchedule[personKey]?.clothing || {})
        .find(([, days]) => (days || []).includes(day))?.[0] || null;
    }

    function activitiesFor(personKey, day) {
      return Object.entries(currentSchedule[personKey]?.activities || {})
        .filter(([, days]) => (days || []).includes(day))
        .map(([name]) => name);
    }

    function eventsFor(date) {
      return currentEvents.filter(event => event.date === keyDate(date));
    }

    function activityInfo(name) {
      return activityLabels[name.toLowerCase()] || { icon: '⭐', label: name };
    }

    function eventMarkup(personKey, date) {
      return eventsFor(date)
        .filter(event => event.person === personKey)
        .map(event => `<div class="event">${escapeHtml(event.icon || '📌')} ${escapeHtml(event.title)}</div>`)
        .join('');
    }

    function personMarkup(personKey, day, date) {
      const person = currentSchedule[personKey];
      const adult = isAdult(person);

      if (adult) {
        return `<div class="child adult-person">
          <div class="child-name"><span class="avatar">👤</span>${escapeHtml(person.name)}</div>
          ${eventMarkup(personKey, date)}
        </div>`;
      }

      const clothing = clothingFor(personKey, day);
      const info = clothingLabels[clothing];
      const pool = (person.pool || []).includes(day);
      const activities = activitiesFor(personKey, day).map(activity => {
        const info = activityInfo(activity);
        return `<div class="activity">${info.icon} ${escapeHtml(info.label)}</div>`;
      }).join('');

      return `<div class="child">
        <div class="child-name"><span class="avatar">👦</span>${escapeHtml(person.name)}</div>
        ${info ? `<div class="clothing ${clothing}">${info.icon} ${info.label}</div>` : '<div class="not-configured">Ropa sin configurar</div>'}
        ${pool ? '<div class="pool">🏊 Piscina</div>' : ''}
        ${activities}
        ${eventMarkup(personKey, date)}
      </div>`;
    }

    function renderToday(dates) {
      const today = new Date();
      const idx = dates.findIndex(d => sameDate(d, today));
      const box = $('#todaySummary');
      if (weekOffset !== 0 || idx < 0 || (!showWeekend && idx > 4)) {
        box.classList.remove('visible');
        return;
      }

      const day = dayKeys[idx];
      const people = Object.keys(currentSchedule).map(key => {
        const person = currentSchedule[key];
        const details = [];

        if (!isAdult(person)) {
          const clothes = clothingLabels[clothingFor(key, day)];
          if (clothes) details.push(`${clothes.icon} ${clothes.label}`);
          if ((person.pool || []).includes(day)) details.push('🏊 Piscina');
          activitiesFor(key, day).forEach(activity => {
            const x = activityInfo(activity);
            details.push(`${x.icon} ${x.label}`);
          });
        }

        eventsFor(today).filter(event => event.person === key).forEach(event => {
          details.push(`${event.icon || '📌'} ${event.title}`);
        });

        return `<div class="summary-person">
          <strong>${escapeHtml(person.name)}</strong>
          <div class="summary-details">${details.length ? details.map(x => `<span>${escapeHtml(x)}</span>`).join('') : '<span>Sin eventos hoy</span>'}</div>
        </div>`;
      }).join('');

      const shared = eventsFor(today)
        .filter(event => event.person === 'all')
        .map(event => `<div class="summary-shared">${escapeHtml(event.icon || '📌')} ${escapeHtml(event.title)}</div>`)
        .join('');

      const dayName = dayNames[idx];
      box.innerHTML = `<div class="summary-label">PARA HOY</div>
        <div class="summary-title">${dayName[0].toUpperCase() + dayName.slice(1)}, ${formatDate(today)}</div>
        <div class="summary-people">${people}</div>${shared}`;
      box.classList.add('visible');
    }

    function renderWeek() {
      const allDates = getWeekDates(weekOffset);
      const dates = showWeekend ? allDates : allDates.slice(0, 5);
      const today = new Date();

      $('#weekLabel').textContent = weekOffset === 0 ? 'Esta semana' : `Semana ${weekOffset > 0 ? '+' : ''}${weekOffset}`;
      $('#weekRange').textContent = `${formatDate(dates[0])} · ${formatDate(dates[dates.length - 1])}`;
      $('#todayPill').textContent = `Hoy · ${dayNames[today.getDay() === 0 ? 6 : today.getDay() - 1]}`;
      $('#weekGrid').classList.toggle('full-week', showWeekend);

      $('#weekGrid').innerHTML = dates.map(date => {
        const idx = allDates.findIndex(d => sameDate(d, date));
        const day = dayKeys[idx];
        const isToday = sameDate(date, today);
        const shared = eventsFor(date)
          .filter(event => event.person === 'all')
          .map(event => `<div class="event">${escapeHtml(event.icon || '📌')} ${escapeHtml(event.title)}</div>`)
          .join('');

        return `<article class="day-card ${isToday ? 'is-today' : ''}">
          <header class="day-header"><div class="day-name">${dayNames[idx]}</div><div class="day-number">${date.getDate()}${isToday ? '<span class="today-label">HOY</span>' : ''}</div></header>
          <div class="children">${Object.keys(currentSchedule).map(key => personMarkup(key, day, date)).join('')}</div>
          ${shared ? `<div class="shared-events">${shared}</div>` : ''}
        </article>`;
      }).join('');

      renderToday(allDates);
    }

    function renderPeopleEditor() {
      const host = $('#peopleEditor');
      const keys = Object.keys(currentSchedule);

      if (!keys.length) {
        host.innerHTML = '<p class="empty-state">Todavía no hay personas configuradas.</p>';
      } else {
        host.innerHTML = keys.map(key => {
          const person = currentSchedule[key];

          if (isAdult(person)) {
            return `<article class="child-editor adult-editor" data-person-key="${escapeHtml(key)}">
              <div class="child-editor-heading">
                <label class="child-name-field">Nombre<input class="edit-person-name" type="text" value="${escapeHtml(person.name)}" maxlength="40" required></label>
                <span class="person-type-badge">👤 Adulto</span>
                <button class="remove-person text-danger" type="button" data-remove-person="${escapeHtml(key)}">Eliminar</button>
              </div>
            </article>`;
          }

          const rows = dayKeys.map((day, index) => {
            const clothing = (person.clothing?.uniform || []).includes(day)
              ? 'uniform'
              : (person.clothing?.tracksuit || []).includes(day) ? 'tracksuit' : '';
            const pool = (person.pool || []).includes(day);
            const activities = Object.entries(person.activities || {})
              .filter(([, days]) => (days || []).includes(day))
              .map(([name]) => name).join(', ');

            return `<div class="day-edit-row">
              <strong>${dayNames[index][0].toUpperCase() + dayNames[index].slice(1)}</strong>
              <label>Ropa<select class="edit-clothing" data-day="${day}">
                <option value="">Sin especificar</option>
                <option value="tracksuit" ${clothing === 'tracksuit' ? 'selected' : ''}>🏃 Chándal</option>
                <option value="uniform" ${clothing === 'uniform' ? 'selected' : ''}>🧥 Ropa de calle</option>
              </select></label>
              <label class="pool-check"><input type="checkbox" class="edit-pool" data-day="${day}" ${pool ? 'checked' : ''}> 🏊 Piscina</label>
              <label class="activity-edit">Extraescolares<input type="text" class="edit-activities" data-day="${day}" value="${escapeHtml(activities)}" placeholder="Ej. Taekwondo, Música"></label>
            </div>`;
          }).join('');

          return `<article class="child-editor" data-person-key="${escapeHtml(key)}">
            <div class="child-editor-heading">
              <label class="child-name-field">Nombre<input class="edit-person-name" type="text" value="${escapeHtml(person.name)}" maxlength="40" required></label>
              <span class="person-type-badge child-badge">👦 Niño</span>
              <button class="remove-person text-danger" type="button" data-remove-person="${escapeHtml(key)}">Eliminar</button>
            </div>
            <div class="day-edit-grid">${rows}</div>
          </article>`;
        }).join('');
      }

      renderEventPersonOptions();
    }

    function renderEventPersonOptions() {
      const select = $('#eventPerson');
      const previous = select.value;
      select.innerHTML = '<option value="all">👨‍👩‍👧‍👦 Toda la familia</option>' +
        Object.entries(currentSchedule).map(([key, person]) =>
          `<option value="${escapeHtml(key)}">${isAdult(person) ? '👤' : '👦'} ${escapeHtml(person.name)}</option>`
        ).join('');
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
    }

    function buildScheduleFromEditor() {
      const next = {};

      document.querySelectorAll('.child-editor, .adult-editor').forEach(card => {
        const key = card.dataset.personKey;
        const name = card.querySelector('.edit-person-name').value.trim();
        if (!name) return;

        const previous = currentSchedule[key];
        if (isAdult(previous)) {
          next[key] = { name, type: 'adult' };
          return;
        }

        const clothing = { uniform: [], tracksuit: [] };
        const pool = [];
        const activities = {};

        card.querySelectorAll('.edit-clothing').forEach(select => {
          if (select.value) clothing[select.value].push(select.dataset.day);
        });
        card.querySelectorAll('.edit-pool:checked').forEach(input => pool.push(input.dataset.day));
        card.querySelectorAll('.edit-activities').forEach(input => {
          input.value.split(',').map(item => item.trim()).filter(Boolean).forEach(activity => {
            if (!activities[activity]) activities[activity] = [];
            activities[activity].push(input.dataset.day);
          });
        });

        next[key] = { name, type: 'child', clothing, pool, activities };
      });

      return next;
    }

    async function saveSchedule() {
      const next = buildScheduleFromEditor();
      if (Object.keys(next).length !== document.querySelectorAll('.child-editor, .adult-editor').length) {
        $('#scheduleStatus').textContent = 'Revisa los nombres: no pueden estar vacíos.';
        return;
      }

      currentSchedule = next;
      currentEvents = currentEvents.filter(event => event.person === 'all' || currentSchedule[event.person]);

      if (await persistConfig()) {
        renderWeek();
        renderPeopleEditor();
        renderEventsEditor();
        $('#scheduleStatus').textContent = '✓ Cambios guardados';
      }
    }

    async function addPerson(type) {
      const label = type === 'adult' ? 'adulto/a' : 'niño/a';
      const name = prompt(`¿Cómo se llama el/la ${label}?`);
      if (!name || !name.trim()) return;

      const base = slugify(name.trim());
      let key = base;
      let suffix = 2;
      while (currentSchedule[key]) key = `${base}-${suffix++}`;

      currentSchedule[key] = type === 'adult'
        ? { name: name.trim(), type: 'adult' }
        : { name: name.trim(), type: 'child', clothing: { uniform: [], tracksuit: [] }, pool: [], activities: {} };

      if (await persistConfig()) {
        renderPeopleEditor();
        renderWeek();
        $('#scheduleStatus').textContent = `${type === 'adult' ? 'Adulto/a' : 'Niño/a'} añadido.`;
      }
    }

    function renderEventsEditor() {
      const host = $('#eventsEditor');
      if (!currentEvents.length) {
        host.innerHTML = '<p class="empty-state">No hay eventos puntuales configurados.</p>';
        return;
      }

      host.innerHTML = [...currentEvents].sort((a, b) => a.date.localeCompare(b.date)).map(event => {
        const who = event.person === 'all' ? 'Toda la familia' : (currentSchedule[event.person]?.name || 'Persona eliminada');
        return `<div class="event-edit-item">
          <div class="event-edit-icon">${escapeHtml(event.icon || '📌')}</div>
          <div class="event-edit-copy"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.date)} · ${escapeHtml(who)}</span></div>
          <button type="button" class="text-button edit-event" data-edit-event="${escapeHtml(event.id)}">Editar</button>
          <button type="button" class="text-danger delete-event" data-delete-event="${escapeHtml(event.id)}">Borrar</button>
        </div>`;
      }).join('');
    }

    function resetEventForm() {
      $('#eventForm').reset();
      $('#editingEventId').value = '';
      $('#eventSubmit').textContent = 'Añadir evento';
      $('#cancelEventEdit').hidden = true;
    }

    async function saveEvent(event) {
      event.preventDefault();
      const id = $('#editingEventId').value;
      const item = {
        id: id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: $('#eventDate').value,
        person: $('#eventPerson').value,
        title: $('#eventTitle').value.trim(),
        icon: $('#eventIcon').value.trim() || '📌',
      };
      if (!item.date || !item.title) return;

      if (id) currentEvents = currentEvents.map(existing => existing.id === id ? item : existing);
      else currentEvents.push(item);

      if (await persistConfig()) {
        resetEventForm();
        renderEventsEditor();
        renderWeek();
      }
    }

    function editEvent(id) {
      const event = currentEvents.find(item => item.id === id);
      if (!event) return;
      $('#editingEventId').value = id;
      $('#eventDate').value = event.date;
      $('#eventPerson').value = event.person || event.child || 'all';
      $('#eventTitle').value = event.title;
      $('#eventIcon').value = event.icon || '';
      $('#eventSubmit').textContent = 'Guardar cambios';
      $('#cancelEventEdit').hidden = false;
      $('#eventForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function exportConfig() {
      const payload = { schedule: currentSchedule, events: currentEvents };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'configuracion-semana-familiar.json';
      link.click();
      URL.revokeObjectURL(url);
    }

    async function importConfig(file) {
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.schedule || typeof data.schedule !== 'object' || !Array.isArray(data.events)) throw new Error('Formato no válido');

        currentSchedule = normaliseSchedule(data.schedule);
        currentEvents = normaliseEvents(data.events, currentSchedule);

        if (await persistConfig()) {
          renderWeek();
          renderPeopleEditor();
          renderEventsEditor();
          resetEventForm();
          alert('Configuración importada correctamente.');
        }
      } catch (error) {
        alert(`No se ha podido importar el archivo: ${error.message}`);
      }
      $('#importConfig').value = '';
    }

    function setConfigVisible(visible) {
      $('#configPanel').hidden = !visible;
      $('#toggleConfig').setAttribute('aria-expanded', String(visible));
      $('#toggleConfig').textContent = visible ? '✕ Cerrar configuración' : '⚙️ Configurar calendario';
      if (visible) $('#configPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    $('#previousWeek').addEventListener('click', () => { weekOffset--; renderWeek(); });
    $('#nextWeek').addEventListener('click', () => { weekOffset++; renderWeek(); });
    $('#currentWeek').addEventListener('click', () => { weekOffset = 0; renderWeek(); });

    $('#showWeekend').checked = showWeekend;
    $('#showWeekend').addEventListener('change', event => {
      showWeekend = event.target.checked;
      try { localStorage.setItem(WEEKEND_STORAGE_KEY, String(showWeekend)); } catch {}
      renderWeek();
    });

    $('#toggleConfig').addEventListener('click', () => setConfigVisible($('#configPanel').hidden));
    $('#closeConfig').addEventListener('click', () => setConfigVisible(false));
    $('#addChild').addEventListener('click', () => addPerson('child'));
    $('#addAdult').addEventListener('click', () => addPerson('adult'));
    $('#saveSchedule').addEventListener('click', saveSchedule);
    $('#eventForm').addEventListener('submit', saveEvent);
    $('#cancelEventEdit').addEventListener('click', resetEventForm);
    $('#exportConfig').addEventListener('click', exportConfig);
    $('#importConfig').addEventListener('change', event => importConfig(event.target.files[0]));

    $('#peopleEditor').addEventListener('click', async event => {
      const button = event.target.closest('[data-remove-person]');
      if (!button) return;
      const key = button.dataset.removePerson;
      const name = currentSchedule[key]?.name;
      if (!confirm(`¿Eliminar a ${name} y sus eventos asociados?`)) return;

      delete currentSchedule[key];
      currentEvents = currentEvents.filter(item => item.person !== key);

      if (await persistConfig()) {
        renderPeopleEditor();
        renderEventsEditor();
        renderWeek();
      }
    });

    $('#eventsEditor').addEventListener('click', async event => {
      const edit = event.target.closest('[data-edit-event]');
      const remove = event.target.closest('[data-delete-event]');
      if (edit) editEvent(edit.dataset.editEvent);
      if (remove) {
        currentEvents = currentEvents.filter(item => item.id !== remove.dataset.deleteEvent);
        if (await persistConfig()) {
          renderEventsEditor();
          renderWeek();
        }
      }
    });

    initialiseCloud();
