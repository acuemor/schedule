# Semana familiar — versión 6 (Supabase)

Esta versión mantiene el calendario y su editor, pero sustituye `localStorage` como almacenamiento de los horarios/eventos por Supabase. **La base de datos es la fuente única de la verdad**: los dos progenitores acceden con cuentas separadas y ven los cambios del otro en tiempo real.

## Archivos

- `index.html`, `styles.css`, `script.js`: aplicación web.
- `config.js`: configuración inicial que se utiliza solo al crear por primera vez la fila familiar.
- `supabase-config.js`: URL, clave pública y UUID de vuestra familia.
- `supabase-schema.sql`: tablas, políticas de seguridad (RLS) y activación de Realtime.

## 1. Crear el proyecto Supabase

1. Entra en https://supabase.com/ y crea un proyecto.
2. Guarda la contraseña de la base de datos en un lugar seguro.
3. En el panel del proyecto, abre **SQL Editor**.
4. Copia el contenido completo de `supabase-schema.sql`, pégalo y pulsa **Run**.
5. En **Project Settings → API** (o **Data API / API Keys**, según la interfaz), copia:
   - Project URL.
   - La clave pública `anon` o `publishable`.
   **No uses nunca `service_role` ni `secret key` en el navegador.**

## 2. Crear las dos cuentas

1. Abre **Authentication → Users** y crea/añade la cuenta de correo del primer progenitor y la del segundo. También podéis registraros desde la pantalla de acceso de la web; si Supabase exige confirmación, confirmad ambos correos.
2. En Authentication → Users, copia el UUID (`ID`) de cada cuenta.
3. Genera un UUID para la familia. Puedes ejecutar en SQL Editor:
   ```sql
   select gen_random_uuid();
   ```
4. Sustituye `UUID_FAMILIA`, `UUID_USUARIO_1` y `UUID_USUARIO_2` por los valores reales y ejecuta:
   ```sql
   insert into public.family_members (family_id, user_id)
   values
     ('UUID_FAMILIA', 'UUID_USUARIO_1'),
     ('UUID_FAMILIA', 'UUID_USUARIO_2');

   insert into public.family_config (family_id, config)
   values ('UUID_FAMILIA', '{"schedule":{},"events":[]}'::jsonb)
   on conflict (family_id) do nothing;
   ```
   Las filas de `family_members` se crean desde SQL Editor, no desde el navegador, para impedir que terceros se unan por su cuenta.

## 3. Configurar la web

Edita `supabase-config.js` y reemplaza los tres valores:

```js
window.SUPABASE_CONFIG = {
  url: 'https://TU-PROYECTO.supabase.co',
  anonKey: 'TU-CLAVE-PUBLICA-ANON-O-PUBLISHABLE',
  familyId: 'UUID-FAMILIA',
};
```

Usa exactamente la misma URL, clave pública y UUID familiar en el despliegue de GitHub Pages. La clave pública puede estar en el frontend: el acceso a los datos lo restringen las políticas RLS y la pertenencia familiar. **Nunca publiques la clave `service_role` o una `secret key`.**

## 4. Publicar en GitHub Pages

1. Copia los archivos de esta versión al repositorio `schedule`.
2. Comprueba que `supabase-config.js` está incluido y tiene los valores correctos.
3. Haz commit y push a la rama que publica GitHub Pages.
4. Abre la web desde cada dispositivo e inicia sesión con cada correo.

## 5. Uso y sincronización

- Los horarios y eventos se guardan en Supabase al pulsar los botones de guardar o al añadir/eliminar elementos.
- Los cambios que guarda uno aparecen en el otro dispositivo mediante Realtime.
- La opción de mostrar fines de semana se conserva localmente en cada navegador porque es una preferencia de visualización, no un dato familiar.
- Exportar/importar JSON sigue disponible como copia de seguridad.
- Si un dispositivo está desconectado, no podrá guardar cambios hasta recuperar la conexión.

## Seguridad y limitación importante

La tabla compartida solo permite leer o modificar la configuración a usuarios autenticados que tengan una fila en `family_members` para ese UUID familiar. No hay acceso anónimo a los datos familiares. La clave del navegador es la clave pública de Supabase, no una clave administrativa.

Esta primera versión guarda horarios y eventos en un único documento JSON por familia. Si los dos editáis exactamente a la vez, el último guardado puede reemplazar el anterior; esperad a ver el estado **Sincronizado con la nube** antes de empezar una edición simultánea importante.
