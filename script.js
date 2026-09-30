const schedule = {
  adrian: {
    name: "Adrián",
    clothing: {
      1: "uniform",  // lunes
      2: "tracksuit", // martes
      3: "uniform",
      4: "tracksuit",
      5: "tracksuit"
    },
    pool: 5
  },
  hector: {
    name: "Héctor",
    clothing: {
      1: "tracksuit",
      2: "uniform",
      3: "tracksuit",
      4: "tracksuit",
      5: "uniform"
    },
    pool: 1
  }
};

const clothingLabels = {
  tracksuit: { icon: "🏃", label: "Chándal" },
  uniform: { icon: "🧥", label: "Uniforme de calle" }
};

const dayNames = ["lunes", "martes", "miércoles", "jueves", "viernes"];
const monthNames = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

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

function sameDate(a, b) {
  return a.toDateString() === b.toDateString();
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

function getClothing(child, dayNumber) {
  return schedule[child].clothing[dayNumber];
}

function personMarkup(key, dayNumber) {
  const child = schedule[key];
  const clothing = getClothing(key, dayNumber);
  const info = clothingLabels[clothing];
  const hasPool = child.pool === dayNumber;

  return `
    <div class="child">
      <div class="child-name">
        <span class="avatar">👦</span>
        ${child.name}
      </div>
      <div class="clothing ${clothing}">
        <span>${info.icon}</span>
        <span>${info.label}</span>
      </div>
      ${hasPool ? '<div class="pool">🏊 Piscina</div>' : ""}
    </div>
  `;
}

function renderWeek() {
  const dates = getWeekDates(weekOffset);
  const today = new Date();
  const first = dates[0];
  const last = dates[4];

  $("#weekLabel").textContent = weekOffset === 0
    ? "Esta semana"
    : `Semana ${weekOffset > 0 ? "+" : ""}${weekOffset}`;

  $("#weekRange").textContent =
    `${formatDate(first)} · ${formatDate(last)}`;

  $("#todayPill").textContent =
    `Hoy · ${dayNames[today.getDay() === 0 ? 6 : today.getDay() - 1]} ${today.getDate()}`;

  $("#weekGrid").innerHTML = dates.map((date, index) => {
    const dayNumber = index + 1;
    const isToday = sameDate(date, today);

    return `
      <article class="day-card ${isToday ? "is-today" : ""}">
        <header class="day-header">
          <div>
            <div class="day-name">${dayNames[index]}</div>
            <div class="day-number">
              ${date.getDate()}
              ${isToday ? '<span class="today-label">HOY</span>' : ""}
            </div>
          </div>
        </header>
        <div class="children">
          ${personMarkup("adrian", dayNumber)}
          ${personMarkup("hector", dayNumber)}
        </div>
      </article>
    `;
  }).join("");

  renderTodaySummary(dates);
}

function renderTodaySummary(dates) {
  const today = new Date();
  const todayIndex = dates.findIndex(date => sameDate(date, today));
  const summary = $("#todaySummary");

  if (weekOffset !== 0 || todayIndex < 0) {
    summary.classList.remove("visible");
    return;
  }

  const dayNumber = todayIndex + 1;
  const people = ["adrian", "hector"].map(key => {
    const child = schedule[key];
    const clothing = clothingLabels[getClothing(key, dayNumber)];
    const pool = child.pool === dayNumber ? " · 🏊 Piscina" : "";
    return `<span class="summary-person">${child.name}: ${clothing.icon} ${clothing.label}${pool}</span>`;
  }).join("");

  summary.innerHTML = `
    <div class="summary-label">PARA HOY</div>
    <div class="summary-title">${dayNames[todayIndex].charAt(0).toUpperCase() + dayNames[todayIndex].slice(1)}, ${today.getDate()} de ${monthNames[today.getMonth()]}</div>
    <div class="summary-people">${people}</div>
  `;
  summary.classList.add("visible");
}

$("#previousWeek").addEventListener("click", () => {
  weekOffset -= 1;
  renderWeek();
});

$("#nextWeek").addEventListener("click", () => {
  weekOffset += 1;
  renderWeek();
});

$("#currentWeek").addEventListener("click", () => {
  weekOffset = 0;
  renderWeek();
});

renderWeek();
