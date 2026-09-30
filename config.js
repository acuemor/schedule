// Configuración del calendario escolar.
// Los días se escriben por su nombre para que sea fácil modificarlo.
// Valores admitidos: monday, tuesday, wednesday, thursday, friday.

const schedule = {
  adrian: {
    name: 'Adrián',
    clothing: {
      uniform: ['monday', 'wednesday'],
      tracksuit: ['tuesday', 'thursday', 'friday'],
    },
    pool: ['friday'],
    activities: {
      taekwondo: ['monday', 'wednesday', 'friday'],
    },
  },

  hector: {
    name: 'Héctor',
    clothing: {
      tracksuit: ['monday', 'wednesday', 'thursday'],
      uniform: ['tuesday', 'friday'],
    },
    pool: ['monday'],
    activities: {
      music: ['thursday'],
    },
  },
};
