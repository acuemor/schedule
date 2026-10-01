// Días: monday, tuesday, wednesday, thursday, friday.
const schedule = {
  adrian: {
    name: 'Adrián',
    clothing: { uniform: ['monday', 'wednesday'], tracksuit: ['tuesday', 'thursday', 'friday'] },
    pool: ['friday'],
    activities: { taekwondo: ['monday', 'wednesday', 'friday'] },
  },
  hector: {
    name: 'Héctor',
    clothing: { tracksuit: ['monday', 'wednesday', 'thursday'], uniform: ['tuesday', 'friday'] },
    pool: ['monday'],
    activities: { music: ['thursday'] },
  },
  // Rodrigo queda creado; completa sus días cuando quieras.
  rodrigo: {
    name: 'Rodrigo',
    clothing: { uniform: [], tracksuit: [] },
    pool: [],
    activities: {},
  },
};

// Eventos puntuales: fecha AAAA-MM-DD. child puede ser una clave de schedule o 'all'.
const events = [
  { date: '2026-10-10', child: 'hector', title: 'Excursión en la granja', icon: '🐮' },
  { date: '2026-12-18', child: 'adrian', title: 'Festival de Navidad', icon: '🎄' },
];
