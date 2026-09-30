const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const monthNames = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const clothingLabels = {
  tracksuit: { icon: '🏃', label: 'Chándal' },
  uniform: { icon: '🧥', label: 'Uniforme de calle' },
};

const activityLabels = {
  taekwondo: { icon: '🥋', label: 'Taekwondo' },
  music: { icon: '🎵', label: 'Música' },
};

let weekOffset = 0;

const $ = selector => document.querySelector(selector);

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);

  return result;
}

function formatDate(date) {
  return `${date.getDate()} de ${monthNames[date.getMonth()]}`;
}

function sameDate(firstDate, secondDate) {
  return firstDate.toDateString() === secondDate.toDateString();
}

function getWeekDates(offset) {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + offset * 7);

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getClothing(childKey, dayKey) {
  const clothing = Object.entries(schedule[childKey].clothing)
    .find(([, days]) => days.includes(dayKey));

  return clothing ? clothing[0] : null;
}

function getActivities(childKey, dayKey) {
  return Object.entries(schedule[childKey].activities || {})
    .filter(([, days]) => days.includes(dayKey))
    .map(([activity]) => activity);
}

function hasPool(childKey, dayKey) {
  return (schedule[childKey].pool || []).includes(dayKey);
}

function activityMarkup(childKey, dayKey) {
  return getActivities(childKey, dayKey)
    .map(activity => {
      const info = activityLabels[activity] || { icon: '⭐', label: activity };

      return `
        <div class="activity">
          <span>${info.icon}</span>
          <span>${info.label}</span>
        </div>
      `;
    })
    .join('');
}

function personMarkup(childKey, dayKey) {
  const child = schedule[childKey];
  const clothing = getClothing(childKey, dayKey);
  const clothingInfo = clothingLabels[clothing];

  return `
    <div class="child">
      <div class="child-name">
        <span class="avatar">👦</span>
        ${child.name}
      </div>

      <div class="clothing ${clothing}">
        <span>${clothingInfo.icon}</span>
        <span>${clothingInfo.label}</span>
      </div>

      ${hasPool(childKey, dayKey) ? '<div class="pool">🏊 Piscina</div>' : ''}
      ${activityMarkup(childKey, dayKey)}
    </div>
  `;
}

function renderWeek() {
  const dates = getWeekDates(weekOffset);
  const today = new Date();

  $('#weekLabel').textContent = weekOffset === 0
    ? 'Esta semana'
    : `Semana ${weekOffset > 0 ? '+' : ''}${weekOffset}`;

  $('#weekRange').textContent = `${formatDate(dates[0])} · ${formatDate(dates[4])}`;

  const todayDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  $('#todayPill').textContent = `Hoy · ${dayNames[todayDayIndex]} ${today.getDate()}`;

  $('#weekGrid').innerHTML = dates.map((date, index) => {
    const dayKey = dayKeys[index];
    const isToday = sameDate(date, today);

    return `
      <article class="day-card ${isToday ? 'is-today' : ''}">
        <header class="day-header">
          <div>
            <div class="day-name">${dayNames[index]}</div>
            <div class="day-number">
              ${date.getDate()}
              ${isToday ? '<span class="today-label">HOY</span>' : ''}
            </div>
          </div>
        </header>

        <div class="children">
          ${personMarkup('adrian', dayKey)}
          ${personMarkup('hector', dayKey)}
        </div>
      </article>
    `;
  }).join('');

  renderTodaySummary(dates);
}

function renderTodaySummary(dates) {
  const today = new Date();
  const todayIndex = dates.findIndex(date => sameDate(date, today));
  const summary = $('#todaySummary');

  if (weekOffset !== 0 || todayIndex < 0 || todayIndex > 4) {
    summary.classList.remove('visible');
    return;
  }

  const dayKey = dayKeys[todayIndex];

  const people = ['adrian', 'hector'].map(childKey => {
    const child = schedule[childKey];
    const clothing = clothingLabels[getClothing(childKey, dayKey)];
    const pool = hasPool(childKey, dayKey) ? ' · 🏊 Piscina' : '';
    const activities = getActivities(childKey, dayKey)
      .map(activity => {
        const info = activityLabels[activity] || { icon: '⭐', label: activity };
        return ` · ${info.icon} ${info.label}`;
      })
      .join('');

    return `<span class="summary-person">${child.name}: ${clothing.icon} ${clothing.label}${pool}${activities}</span>`;
  }).join('');

  const capitalizedDayName = dayNames[todayIndex].charAt(0).toUpperCase() + dayNames[todayIndex].slice(1);

  summary.innerHTML = `
    <div class="summary-label">PARA HOY</div>
    <div class="summary-title">${capitalizedDayName}, ${today.getDate()} de ${monthNames[today.getMonth()]}</div>
    <div class="summary-people">${people}</div>
  `;

  summary.classList.add('visible');
}

$('#previousWeek').addEventListener('click', () => {
  weekOffset -= 1;
  renderWeek();
});

$('#nextWeek').addEventListener('click', () => {
  weekOffset += 1;
  renderWeek();
});

$('#currentWeek').addEventListener('click', () => {
  weekOffset = 0;
  renderWeek();
});

renderWeek();
