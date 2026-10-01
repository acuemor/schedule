# Organizador semanal familiar

Web estática para GitHub Pages.

## Archivos
- `index.html`: estructura.
- `styles.css`: estilos responsive.
- `config.js`: niños, horarios y eventos puntuales.
- `script.js`: lógica de calendario.

## Rodrigo
Rodrigo está añadido, pero sus días de uniforme, chándal, piscina y actividades quedan sin configurar. Se pueden completar en `config.js`.

## Eventos
En `config.js`, añade objetos a `events` con `date` en formato `AAAA-MM-DD`, `child` con la clave del niño (o `all` para todos), `title` e `icon` opcional.

Los dos eventos de ejemplo están fechados en 2026:
- 10 de octubre: excursión de Héctor en la granja.
- 18 de diciembre: festival de Navidad de Adrián.

Sube los cuatro archivos principales al repositorio y publica la rama `main` desde `/ (root)` en Settings → Pages.


## Vista de fin de semana

El calendario muestra de lunes a viernes por defecto. Activa el interruptor **Mostrar fines de semana** para incluir también sábado y domingo. La preferencia queda guardada en el navegador, así que se mantiene al volver a abrir la web en ese mismo dispositivo y navegador.

Los eventos puntuales configurados para sábado o domingo también se muestran al activar la semana completa.
