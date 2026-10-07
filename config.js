// Configuración inicial para una familia nueva.
// Los días: monday, tuesday, wednesday, thursday, friday.
const schedule = {
  abel: {
    name: 'Abel',
    type: 'adult',
  },
  raquel: {
    name: 'Raquel',
    type: 'adult',
  },
  adrian: {
    name: 'Adrián',
    type: 'child',
    clothing: { uniform: ['monday', 'wednesday'], tracksuit: ['tuesday', 'thursday', 'friday'] },
    pool: ['friday'],
    activities: { taekwondo: ['monday', 'wednesday', 'friday'] },
  },
  hector: {
    name: 'Héctor',
    type: 'child',
    clothing: { tracksuit: ['monday', 'wednesday', 'thursday'], uniform: ['tuesday', 'friday'] },
    pool: ['monday'],
    activities: { music: ['thursday'] },
  },
  rodrigo: {
    name: 'Rodrigo',
    type: 'child',
    clothing: { uniform: [], tracksuit: [] },
    pool: [],
    activities: {},
  },
};

// Eventos iniciales para una familia nueva.
const events = [
  { date: '2026-10-10', person: 'hector', title: 'Excursión en la granja', icon: '🐮' },
  { date: '2026-12-18', person: 'adrian', title: 'Festival de Navidad', icon: '🎄' },
];
