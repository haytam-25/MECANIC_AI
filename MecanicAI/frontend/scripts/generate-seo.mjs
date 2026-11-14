// Genera las páginas estáticas para buscadores a partir de los datos de seo/:
//   seo/coches.json   → public/coches.html  y public/coches/<marca>-<modelo>.html   (/coches/seat-ibiza)
//   seo/codigos.json  → public/codigos.html y public/codigos/<código>.html          (/codigos/p0420)
// y vuelve a escribir public/sitemap.xml con todas las páginas públicas (también las guías de public/guias/).
//
// Uso: npm run generate-seo   (desde frontend/). El resultado se sube al repositorio, igual que las guías: el build de
// Docker no lo ejecuta porque no tiene el catálogo del backend, con el que aquí se comprueban la marca y el modelo.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const SITE = 'https://mecanicai.org'

// Fecha de la última revisión del contenido de cada tipo de página: cámbiala al tocar su JSON o su plantilla
const UPDATED = { coches: '2026-11-14', codigos: '2026-11-14' }

// Páginas escritas a mano que no son guías, con la fecha de su último cambio
const FIXED_PAGES = [
  ['/', '2026-11-14'],
  ['/guias', '2026-11-14'],
  ['/privacidad', '2026-10-25'],
  ['/terminos', '2026-10-08'],
  ['/cookies', '2026-10-09'],
]

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const longDate = (iso) => `${Number(iso.slice(8))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`
const list = (items) => `<ul>\n${items.map((item) => `        <li>${esc(item)}</li>`).join('\n')}\n      </ul>`

/** Mismo criterio que CatalogService.slug del backend: "León" → "leon", "Serie 3" → "serie-3". */
function slug(text) {
  const value = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return value || 'x'
}

/** Página completa con la misma cabecera, pie y estilos (legal.css) que las guías. */
function page({ path, title, description, ogTitle, type = 'article', crumbs, graph, body, current }) {
  const url = SITE + path
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [['MecanicAI', '/'], ...crumbs].map(([name, to], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: SITE + to,
    })),
  }
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': [...graph, breadcrumb] }, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/^/gm, '      ')
  const trail = [['MecanicAI', '/'], ...crumbs]
    .map(([name, to], i, all) => (i === all.length - 1 ? esc(name) : `<a href="${to}">${esc(name)}</a>`))
    .join(' › ')
  const footerLinks = [
    ['/coches', 'Averías por modelo'],
    ['/codigos', 'Códigos de avería'],
    ['/guias', 'Guías'],
    ['/privacidad', 'Privacidad'],
    ['/terminos', 'Términos y aviso legal'],
    ['/cookies', 'Cookies'],
    ['/', 'MecanicAI'],
  ]
    .map(([to, name]) => `        <a href="${to}"${to === current ? ' aria-current="page"' : ''}>${name}</a>`)
    .join('\n')

  return `<!doctype html>
<!-- Página generada por scripts/generate-seo.mjs a partir de seo/*.json: no la edites a mano -->
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)} · MecanicAI</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" content="#1a1d21" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/logo.svg" sizes="any" type="image/svg+xml" />
    <link rel="stylesheet" href="/legal.css" />
    <meta property="og:type" content="${type}" />
    <meta property="og:site_name" content="MecanicAI" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(ogTitle ?? title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">
${jsonLd}
    </script>
  </head>
  <body>
    <header class="top">
      <div class="top__inner">
        <a class="brand" href="/"><img src="/logo.svg" alt="" width="32" height="32" /><span>Mecanic<b>AI</b></span></a>
        <a class="back" href="/">Abrir la app</a>
      </div>
    </header>

    <main>
      <p class="crumbs">${trail}</p>
${body}
    </main>

    <footer>
      <nav aria-label="Más información">
${footerLinks}
      </nav>
      © 2026 MecanicAI
    </footer>
  </body>
</html>
`
}

const article = (path, headline, description, date) => ({
  '@type': 'Article',
  headline,
  description,
  image: `${SITE}/og-image.png`,
  datePublished: date,
  dateModified: date,
  inLanguage: 'es-ES',
  mainEntityOfPage: SITE + path,
  author: { '@type': 'Organization', name: 'MecanicAI', url: `${SITE}/` },
  publisher: {
    '@type': 'Organization',
    name: 'MecanicAI',
    logo: { '@type': 'ImageObject', url: `${SITE}/pwa-512x512.png` },
  },
})

const faq = (questions) => ({
  '@type': 'FAQPage',
  mainEntity: questions.map(([name, text]) => ({
    '@type': 'Question',
    name,
    acceptedAnswer: { '@type': 'Answer', text },
  })),
})

/** Vacía la carpeta de un tipo de página para que no queden ficheros de entradas que ya no existen. */
function cleanDir(name) {
  const dir = join(PUBLIC, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

// ---------- Averías por modelo ----------

/** Comprueba cada coche contra el catálogo del backend (los ids abren el asistente con ese coche ya elegido). */
function loadCars() {
  const cars = readJson(join(ROOT, 'seo/coches.json'))
  const catalogFile = join(ROOT, '../backend/src/main/resources/catalog/vehicles.json')
  if (!existsSync(catalogFile)) throw new Error(`No encuentro el catálogo del backend: ${catalogFile}`)
  const catalog = readJson(catalogFile)
  return cars.map((car) => {
    const brand = catalog.find((b) => slug(b.name) === car.brandId)
    const model = brand && Object.keys(brand.models).find((name) => slug(name) === car.modelId)
    if (!brand || !model) throw new Error(`${car.brandId}/${car.modelId} no está en el catálogo`)
    const years = brand.models[model]
      .split(',')
      .map((range) => range.trim().split('-'))
      .map(([from, to]) => `${from}–${to || 'hoy'}`)
      .join(' y ')
    return { ...car, brand: brand.name, model, years, name: `${brand.name} ${model}`, path: `/coches/${car.brandId}-${car.modelId}` }
  })
}

function carPage(car, cars) {
  const title = `${car.name}: averías comunes, correa o cadena y mantenimiento`
  const description = `Averías más frecuentes del ${car.name} según el motor y el año, qué motores llevan correa o cadena de distribución y qué mantenimiento no conviene saltarse.`
  const ask = `/?marca=${car.brandId}&amp;modelo=${car.modelId}`
  const siblings = cars.filter((other) => other.brandId === car.brandId && other !== car)
  const others = [...siblings, ...cars.filter((other) => other.brandId !== car.brandId)].slice(0, 6)
  const questions = [
    [
      `¿Cuáles son las averías más comunes del ${car.name}?`,
      `Las que más se repiten son: ${car.faults.map((fault) => `${fault.t.toLowerCase()} (${fault.e})`).join('; ')}.`,
    ],
    [`¿El ${car.name} lleva correa o cadena de distribución?`, `Depende del motor. ${car.belt.join(' ')}`],
  ]

  const body = `      <h1>${esc(title)}</h1>
      <p class="updated">Actualizado el ${longDate(UPDATED.coches)} · En el catálogo de MecanicAI: ${esc(car.years)}</p>

      <p class="lead">${esc(car.intro)}</p>

      <div class="summary">
        <p><strong>Lo que más se repite en el ${esc(car.name)}:</strong></p>
        <ul>
${car.faults.map((fault) => `          <li>${esc(fault.t)} <span class="tag">${esc(fault.e)}</span></li>`).join('\n')}
        </ul>
      </div>

      <h2>Averías más frecuentes del ${esc(car.name)}</h2>
${car.faults
  .map(
    (fault) => `      <h3>${esc(fault.t)}</h3>
      <p><span class="tag">${esc(fault.e)}</span></p>
      <p>${esc(fault.d)}</p>`,
  )
  .join('\n')}

      <div class="cta">
        <p><strong>¿Le pasa algo a tu ${esc(car.model)}?</strong> Elige el año y el motor exactos, cuéntale a MecanicAI qué
          notas y te dice qué puede ser en tu versión concreta. Gratis y sin registro.</p>
        <a class="button" href="${ask}">Preguntar por mi ${esc(car.name)}</a>
      </div>

      <h2>¿El ${esc(car.name)} lleva correa o cadena de distribución?</h2>
      <p>Depende del motor:</p>
      ${list(car.belt)}
      <p>La cadena no tiene un plazo de cambio fijo, pero no es eterna: un traqueteo al arrancar en frío es el aviso. La
        correa se cambia por kilómetros o por años, lo que llegue antes; el plazo exacto depende del motor.
        <a href="/guias/mantenimiento-del-coche">Ver la guía de mantenimiento por kilómetros</a>.</p>

      <h2>Mantenimiento: lo que no conviene saltarse</h2>
      ${list(car.care)}

      <div class="alert">
        <strong>Importante:</strong> esta página es orientativa y recoge los fallos que más se repiten, no todos los
        posibles. Que un motor tenga una avería conocida no significa que tu coche la vaya a sufrir. Un diagnóstico solo
        se confirma revisando el coche.
      </div>

      <h2>Otros modelos</h2>
      <ul>
${others.map((other) => `        <li><a href="${other.path}">Averías comunes del ${esc(other.name)}</a></li>`).join('\n')}
        <li><a href="/coches">Todos los modelos</a></li>
      </ul>

      <h2>También te puede servir</h2>
      <ul>
        <li><a href="/codigos">Códigos de avería OBD2: qué significa cada uno</a></li>
        <li><a href="/guias/testigos-del-coche">Testigos del coche: qué significa cada luz del cuadro</a></li>
        <li><a href="/guias/ruidos-del-coche">Ruidos del coche: qué significan y cuándo preocuparse</a></li>
      </ul>`

  return page({
    path: car.path,
    title,
    description,
    ogTitle: `Averías comunes del ${car.name}`,
    crumbs: [['Averías por modelo', '/coches'], [car.name, car.path]],
    graph: [article(car.path, title, description, UPDATED.coches), faq(questions)],
    body,
    current: null,
  })
}

function carsIndex(cars) {
  const title = 'Averías comunes por modelo de coche'
  const description = 'Los fallos que más se repiten en cada modelo según el motor y el año, si lleva correa o cadena de distribución y qué mantenimiento necesita.'
  const brands = [...new Set(cars.map((car) => car.brand))].sort((a, b) => a.localeCompare(b, 'es'))
  const body = `      <h1>${title}</h1>
      <p class="lead">Cada coche tiene sus puntos débiles. Aquí tienes, modelo a modelo, las averías que más se repiten
        según el motor y el año, si lleva correa o cadena de distribución y el mantenimiento que no conviene saltarse.</p>

${brands
  .map(
    (brand) => `      <h2>${esc(brand)}</h2>
      <ul class="cards">
${cars
  .filter((car) => car.brand === brand)
  .map(
    (car) => `        <li>
          <a href="${car.path}">
            <strong>${esc(car.name)}</strong>
            ${esc(car.faults.slice(0, 3).map((fault) => fault.t).join(' · '))}
          </a>
        </li>`,
  )
  .join('\n')}
      </ul>`,
  )
  .join('\n\n')}

      <div class="cta">
        <p><strong>¿Tu coche no está en la lista?</strong> MecanicAI conoce cientos de modelos: elige el tuyo (marca,
          modelo, año y motor) y pregúntale directamente. Gratis y sin registro.</p>
        <a class="button" href="/">Preguntar por mi coche</a>
      </div>`

  return page({
    path: '/coches',
    title,
    description,
    type: 'website',
    crumbs: [['Averías por modelo', '/coches']],
    graph: [],
    body,
    current: '/coches',
  })
}

// ---------- Códigos de avería OBD2 ----------

const LEVELS = {
  seguir: ['green', 'Puedes seguir circulando'],
  cuidado: ['amber', 'Con precaución y hasta el taller'],
  parar: ['red', 'Mejor no circular'],
}

/** Un código por cilindro (P0301, P0302…) sale de una sola entrada con {n} en sus textos. */
function loadCodes() {
  const fill = (value, n) =>
    typeof value === 'string' ? value.replaceAll('{n}', n) : Array.isArray(value) ? value.map((item) => fill(item, n)) : value
  return readJson(join(ROOT, 'seo/codigos.json'))
    .flatMap(({ cylinders, ...entry }) =>
      cylinders ? cylinders.map((n) => Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, fill(value, String(n))]))) : [entry],
    )
    .map((code) => {
      if (!/^[PBCU][0-9A-F]{4}$/.test(code.code) || !LEVELS[code.level]) throw new Error(`Código no válido: ${code.code}`)
      return { ...code, path: `/codigos/${code.code.toLowerCase()}` }
    })
    .sort((a, b) => a.code.localeCompare(b.code))
}

function codePage(code, codes) {
  const title = `Código ${code.code}: qué significa, causas y solución`
  const description = `${code.code}: ${code.name}. Síntomas, causas más probables ordenadas de más a menos frecuente, cómo se arregla y si puedes seguir circulando.`
  const [dot, levelText] = LEVELS[code.level]
  const question = `Mi coche da el código de avería ${code.code}. ¿Qué puede ser en mi coche y cómo se arregla?`
  const index = codes.indexOf(code)
  const near = [...codes.slice(Math.max(0, index - 3), index), ...codes.slice(index + 1, index + 4)]
  const questions = [
    [`¿Qué significa el código ${code.code}?`, `${code.name}. ${code.what}`],
    [`¿Cuáles son las causas del código ${code.code}?`, `De más a menos frecuente: ${code.causes.join('; ')}.`],
    [`¿Puedo seguir circulando con el código ${code.code}?`, code.drive],
    [`¿Cómo se arregla el código ${code.code}?`, code.fix],
  ]

  const body = `      <h1>Código ${code.code}: ${esc(code.name)}</h1>
      <p class="updated">Actualizado el ${longDate(UPDATED.codigos)}</p>

      <p class="lead">${esc(code.what)}</p>

      <div class="summary">
        <p><strong><span class="dot dot--${dot}"></span>${levelText}.</strong> ${esc(code.drive)}</p>
      </div>

      <h2>Síntomas del ${code.code}</h2>
      ${list(code.symptoms)}

      <h2>Causas más probables</h2>
      <p>De más a menos frecuente:</p>
      ${list(code.causes)}

      <h2>Cómo se arregla</h2>
      <p>${esc(code.fix)}</p>
      <p>Borrar el código con una máquina de diagnosis apaga el testigo, pero si la causa sigue ahí volverá a
        aparecer. Y un mismo código puede tener causas distintas según la marca y el motor.</p>

      <div class="cta">
        <p><strong>¿Te ha salido el ${code.code}?</strong> Dile a MecanicAI qué coche tienes (marca, modelo, año y motor) y
          te explica qué suele provocarlo en tu versión concreta y por dónde empezar a mirar.</p>
        <a class="button" href="/?q=${encodeURIComponent(question)}">Preguntar por el ${code.code} en mi coche</a>
      </div>

      <div class="alert">
        <strong>Importante:</strong> esta página es orientativa. El código indica qué ha detectado la centralita, no
        qué pieza hay que cambiar: antes de comprar nada, conviene comprobar la causa.
      </div>

      <h2>Otros códigos</h2>
      <ul>
${near.map((other) => `        <li><a href="${other.path}">${other.code}: ${esc(other.name)}</a></li>`).join('\n')}
        <li><a href="/codigos">Todos los códigos de avería</a></li>
      </ul>`

  return page({
    path: code.path,
    title,
    description,
    ogTitle: `Código ${code.code}: ${code.name}`,
    crumbs: [['Códigos de avería', '/codigos'], [code.code, code.path]],
    graph: [article(code.path, title, description, UPDATED.codigos), faq(questions)],
    body,
    current: null,
  })
}

function codesIndex(codes) {
  const title = 'Códigos de avería OBD2: qué significa cada uno'
  const description = 'Los códigos de avería más habituales (P0420, P0171, P0300, P0299, P2002…) explicados en español: qué significan, causas, solución y si puedes seguir circulando.'
  const body = `      <h1>${title}</h1>
      <p class="lead">Cuando se enciende el testigo de avería del motor, la centralita guarda un código que dice qué ha
        detectado. Se lee con una máquina de diagnosis o con un lector OBD2 de los que se conectan al móvil.</p>

      <div class="summary">
        <p><strong>Cómo se lee un código</strong> (por ejemplo, P0420):</p>
        <ul>
          <li><strong>La letra</strong> indica el sistema: <strong>P</strong> motor y cambio, <strong>B</strong>
            carrocería (airbag, climatización…), <strong>C</strong> chasis (ABS, dirección) y <strong>U</strong>
            comunicación entre centralitas.</li>
          <li><strong>El primer número</strong>: 0 es un código genérico, igual en todas las marcas; 1 es propio de
            cada fabricante.</li>
          <li><strong>El resto</strong> identifica el fallo concreto.</li>
        </ul>
      </div>

      <h2>Códigos más habituales</h2>
      <div class="table">
        <table>
          <thead>
            <tr><th>Código</th><th>Qué significa</th><th>¿Puedo circular?</th></tr>
          </thead>
          <tbody>
${codes
  .map(
    (code) =>
      `            <tr><td><a href="${code.path}">${code.code}</a></td><td>${esc(code.name)}</td><td><span class="dot dot--${LEVELS[code.level][0]}"></span>${LEVELS[code.level][1]}</td></tr>`,
  )
  .join('\n')}
          </tbody>
        </table>
      </div>

      <div class="cta">
        <p><strong>¿Tu código no está en la lista?</strong> Escríbeselo a MecanicAI junto con tu coche (marca, modelo,
          año y motor) y te explica qué significa en tu caso. Gratis y sin registro.</p>
        <a class="button" href="/?q=${encodeURIComponent('Mi coche da el código de avería … ¿Qué significa y cómo se arregla?')}">Preguntar por mi código</a>
      </div>

      <h2>También te puede servir</h2>
      <ul>
        <li><a href="/guias/testigos-del-coche">Testigos del coche: qué significa cada luz del cuadro</a></li>
        <li><a href="/coches">Averías comunes por modelo de coche</a></li>
      </ul>`

  return page({
    path: '/codigos',
    title,
    description,
    type: 'website',
    crumbs: [['Códigos de avería', '/codigos']],
    graph: [],
    body,
    current: '/codigos',
  })
}

// ---------- Sitemap ----------

/** Las guías se escriben a mano: su fecha sale del "dateModified" de sus datos estructurados. */
function guidePages() {
  return readdirSync(join(PUBLIC, 'guias'))
    .filter((file) => file.endsWith('.html'))
    .sort()
    .map((file) => {
      const date = /"dateModified":\s*"(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(join(PUBLIC, 'guias', file), 'utf8'))?.[1]
      if (!date) throw new Error(`La guía ${file} no tiene "dateModified"`)
      return [`/guias/${file.slice(0, -'.html'.length)}`, date]
    })
}

function sitemap(pages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generado por scripts/generate-seo.mjs (npm run generate-seo): no lo edites a mano. Las guías de public/guias/ entran solas -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([path, date]) => `  <url><loc>${SITE}${path}</loc><lastmod>${date}</lastmod></url>`).join('\n')}
</urlset>
`
}

// ---------- Escritura ----------

const cars = loadCars()
const codes = loadCodes()

const carsDir = cleanDir('coches')
writeFileSync(join(PUBLIC, 'coches.html'), carsIndex(cars))
for (const car of cars) writeFileSync(join(carsDir, `${car.brandId}-${car.modelId}.html`), carPage(car, cars))

const codesDir = cleanDir('codigos')
writeFileSync(join(PUBLIC, 'codigos.html'), codesIndex(codes))
for (const code of codes) writeFileSync(join(codesDir, `${code.code.toLowerCase()}.html`), codePage(code, codes))

const [home, guides, ...legal] = FIXED_PAGES
writeFileSync(
  join(PUBLIC, 'sitemap.xml'),
  sitemap([
    home,
    guides,
    ...guidePages(),
    ['/coches', UPDATED.coches],
    ...cars.map((car) => [car.path, UPDATED.coches]),
    ['/codigos', UPDATED.codigos],
    ...codes.map((code) => [code.path, UPDATED.codigos]),
    ...legal,
  ]),
)

console.log(`Generadas ${cars.length} páginas de modelos, ${codes.length} de códigos y el sitemap.`)
