// Días: monday, tuesday, wednesday, thursday, friday.
const schedule = {
  adrian: {
    name: 'Adrián',
    clothing: { uniform: ['monday', 'wednesday'], tracksuit: ['tuesday', 'thursday', 'friday'] },
    pool: ['friday'],
    activities: { taekwondo: ['monday', 'wednesday', 'friday'], swimming: ['saturday'] },
  },
  hector: {
    name: 'Héctor',
    clothing: { tracksuit: ['monday', 'wednesday', 'thursday'], uniform: ['tuesday', 'friday'] },
    pool: ['monday'],
    activities: { music: ['thursday'], swimming: ['saturday'] },
  },
  // Rodrigo queda creado; completa sus días cuando quieras.
  rodrigo: {
    name: 'Rodrigo',
    clothing: { uniform: [], tracksuit: [] },
    pool: [],
    activities: { swimming: ['saturday'] },
  },
};

// Eventos puntuales: fecha AAAA-MM-DD. child puede ser una clave de schedule o 'all'.
const events = [
  { date: '2026-10-30', child: 'adrian', title: 'Disfraz Halloween', icon: '🎃' },
  { date: '2026-10-30', child: 'hector', title: 'Disfraz Halloween', icon: '🎃' },
  { date: '2026-12-18', child: 'adrian', title: 'Festival de Navidad', icon: '🎄' },
  { date: '2026-12-18', child: 'hector', title: 'Festival de Navidad', icon: '🎄' },
  { date: '2026-12-18', child: 'rodrigo', title: 'Festival de Navidad', icon: '🎄' },
  { date: '2026-11-18', child: 'adrian', title: 'Teatro ratoncito pérez', icon: '🎭' },
  { date: '2027-01-15', child: 'adrian', title: 'Excursión arqueopinto', icon: '🚌' },
  { date: '2027-06-10', child: 'adrian', title: 'Graduación', icon: '🎓' },
  { date: '2026-10-09', child: 'adrian', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-09', child: 'hector', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-09', child: 'rodrigo', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-10', child: 'adrian', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-10', child: 'hector', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-10', child: 'rodrigo', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-11', child: 'adrian', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-11', child: 'hector', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-11', child: 'rodrigo', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-12', child: 'adrian', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-12', child: 'hector', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-12', child: 'rodrigo', title: 'Riotinto', icon: '🚌' },
  { date: '2026-10-02', child: 'adrian', title: 'Cumple de Mateo', icon: '🎉' },
  { date: '2026-10-02', child: 'hector', title: 'Cumple de Mateo', icon: '🎉' },
  { date: '2026-10-02', child: 'rodrigo', title: 'Cumple de Mateo', icon: '🎉' },
];
