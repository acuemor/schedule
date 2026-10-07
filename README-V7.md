# La semana familiar — v7

Esta versión añade **Abel y Raquel como adultos** y convierte el calendario en un calendario de personas.

## Importante: datos existentes

No hay que ejecutar ninguna migración SQL nueva para esta versión.

Los datos actuales de `family_config` se migran automáticamente al iniciar sesión:
- Las personas existentes que no tenían `type` se consideran `child`.
- Se añaden `abel` y `raquel` como `adult` solo si todavía no existen.
- Los eventos existentes que usan `child` se convierten internamente a `person`.
- Los eventos y horarios existentes no se borran.

La primera carga de v7 puede guardar la configuración normalizada de nuevo en Supabase.

## Despliegue

Sustituye en GitHub:
- `index.html`
- `config.js`
- `script.js`
- `styles.css`

Conserva tu `supabase-config.js` actual exactamente como está.

No sustituyas ni borres el proyecto Supabase.

## Funcionalidad nueva

- Abel y Raquel aparecen como adultos.
- Los adultos no muestran ropa, piscina ni extraescolares.
- Los adultos pueden tener eventos.
- Los niños mantienen ropa, piscina y extraescolares.
- Los eventos pueden asignarse a cualquier persona o a toda la familia.
- Se mantiene importación/exportación.
- Se mantienen sincronización realtime y autenticación.

## Siguiente evolución

Esta estructura deja preparada la aplicación para evolucionar posteriormente hacia familias independientes/multiusuario.
