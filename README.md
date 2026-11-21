# Radar Local — app de pronósticos de fútbol

Una **aplicación web para móvil, instalable (PWA)** que muestra los próximos siete días y **sólo pronósticos de victoria del equipo local**. Su diseño replica la estructura de la captura: barras verde/lila/azul, porcentaje 1-X-2, marcador más probable y confianza.

## Funcionalidades

- Siete días con botones por fecha y hora en **Tijuana** (`America/Tijuana`).
- Filtros: **Todos / Alta / Media / Favoritos**; búsqueda por club o liga.
- **Alta**: victoria local estimada ≥ 75% y buen historial disponible.
- **Media**: victoria local estimada ≥ 60%, pero sin los requisitos de Alta.
- Forma reciente con rivales identificados, rendimiento local/visitante, puntos por partido, H2H y advertencias.
- Favoritos en almacenamiento del celular y modo demostración con clubes **ficticios**.
- Actualización **automática** cada día mediante GitHub Actions; **sin poner tu API key en HTML/JavaScript público**.
- Usa API-Football (API-SPORTS) V3 para resultados. **No consulta el endpoint de cuotas ni usa cuotas de casas de apuestas**.

## Para instalarla en GitHub Pages

1. Crea un repositorio **nuevo en GitHub** (o usa uno vacío), por ejemplo `radar-local`.
2. Descomprime el ZIP y **sube todos los archivos y carpetas de su interior a la raíz** del repositorio, incluida la carpeta oculta `.github/workflows/`. El archivo `index.html` debe quedar en la raíz.
3. Crea una cuenta en [API-Football](https://dashboard.api-football.com/) y toma su clave (`x-apisports-key`). **No es la clave de football-data.org; son servicios distintos.**
4. En tu repositorio abre **Settings → Secrets and variables → Actions → New repository secret**. Nombre exacto: `APISPORTS_KEY`; valor: la clave de **API-Football**. No uses comillas ni comas.
5. Abre **Settings → Pages → Build and deployment → Source: GitHub Actions**.
6. En **Actions → Actualizar Radar Local y publicar → Run workflow**, ejecuta la actualización inicial. Al terminar, el enlace sale en **Settings → Pages**, con formato `https://USUARIO.github.io/radar-local/`.
7. Desde el teléfono abre ese enlace en Chrome y pulsa **⋮ → Agregar a pantalla principal / Instalar aplicación**.

> **Importante:** si ya publicaste una API key en chats o capturas, lo prudente es **regenerarla** antes de guardarla como `APISPORTS_KEY` en GitHub.

### Límites reales

El plan gratuito de API-Football ofrece **100 solicitudes/día** (la disponibilidad histórica y las temporadas están limitadas). Por eso la configuración usa **hasta 85 solicitudes por ejecución**, prioriza **35 ligas** con partidos y consulta hasta **12 H2H** de los mejores candidatos. Los encuentros sin historial suficiente no muestran probabilidades inventadas. No se garantiza cubrir cada torneo del mundo con el plan gratuito. Todas las ligas consultadas se registran en el resumen de cobertura.

La app por defecto excluye competiciones que parecen copas o amistosos porque su historial por torneo a menudo no permite comparar la forma de los equipos. Para incluirlas, cambia `INCLUDE_CUPS: 'false'` a `'true'` en `.github/workflows/publicar.yml`. Puede seguir habiendo partidos excluidos por falta de muestra.

Si tu suscripción permite más consultas, aumenta las variables del workflow, por ejemplo `MAX_CALLS`, `MAX_LEAGUES`, `MAX_H2H`, ajustando `REQUEST_INTERVAL` según el límite de tu plan. Las actualizaciones programadas de GitHub Actions no son instantáneas ni garantizan una hora exacta.

### ¿Cómo funciona la estimación?

1. La app obtiene el listado mundial de encuentros para los próximos siete días.
2. Selecciona ligas según prioridad y presupuesto de API.
3. Para cada liga descarga su temporada para calcular **goles a favor y en contra del local jugando en casa y del visitante jugando fuera**, contra el promedio de la liga.
4. Suaviza muestras pequeñas y ajusta moderadamente según **nivel de los oponentes (puntos por partido), forma reciente y un Elo simplificado de la temporada**.
5. Usa una **distribución de Poisson** para estimar 1-X-2 y marcadores exactos.
6. H2H se muestra para hasta 12 favoritos, pero no altera los porcentajes finales (bajo valor predictivo de encuentros antiguos). Las **lesiones, suspensiones y rotaciones no se analizan automáticamente**, y se muestran como riesgo a verificar.
7. Descarta los partidos sin datos suficientes o por debajo del 60% de victoria local estimada.

**Advertencia:** son probabilidades **heurísticas y no calibradas**. Ni el 80% ni la categoría Alta deben interpretarse como porcentajes comprobados de acierto. La app no es una recomendación de apuestas ni asegura ganancias.

## Ejecutar en tu computadora

```bash
python -m unittest discover -s tests -v
APISPORTS_KEY="TU_CLAVE_NUEVA" python scripts/update.py
python -m http.server 8000
```

Visita `http://localhost:8000`. Para probar solo el diseño sin key, abre la web con servidor local y pulsa **Ver demostración**: los equipos que aparezcan son **ficticios**.

## Estructura

- `index.html`, `styles.css`, `app.js`: interfaz y lógica del teléfono.
- `scripts/model.py`: cálculo local de porcentajes y calidad de datos.
- `scripts/update.py`: obtención de partidos, historial por liga y H2H.
- `.github/workflows/publicar.yml`: actualización y publicación diarias.
- `data/predictions.json`: pronósticos generados, sin claves.
- `sw.js`, `manifest.webmanifest`: instalación PWA.
- `tests/test_model.py`: pruebas automatizadas.

## Documentación de origen

- [API-Football docs](https://www.api-football.com/documentation-v3)
- [Uso eficiente de cuota](https://www.api-football.com/news/post/how-to-optimize-api-sports-calls-and-quota-usage)
- [GitHub Pages con Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-for-github-pages)
