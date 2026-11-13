// Gera os ícones do PWA e as telas de abertura do iPhone a partir do
// coração do logotipo, usando o Chrome instalado no computador.
//   node scripts/generate-icons.mjs
// Saída: public/icons/*.png (vão para o GitHub junto com o app)
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

import { chromium } from 'playwright-core'

const BLUE = '#2f5fd0'
const BG = '#f6f8fc'
const HEART = 'M32 47s-15-8.7-15-19.2C17 22.4 21 19 25.4 19c2.8 0 5.2 1.5 6.6 3.7 1.4-2.2 3.8-3.7 6.6-3.7C43 19 47 22.4 47 27.8 47 38.3 32 47 32 47z'

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('Chrome não encontrado (defina CHROME_PATH)')

const out = path.resolve(import.meta.dirname, '../public/icons')
mkdirSync(out, { recursive: true })

/** Ícone quadrado: fundo azul cheio (o sistema arredonda) e o coração branco. */
function iconSvg(size, heartScale) {
  // coração ocupa ~30 de 64 unidades; heartScale = fração do ícone que ele ocupa
  const s = (size * heartScale) / 30
  const tx = size / 2 - 32 * s
  const ty = size / 2 - 33 * s
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BLUE}"/>
    <path transform="translate(${tx} ${ty}) scale(${s})" d="${HEART}" fill="#fff"/>
  </svg>`
}

/** Tela de abertura do iPhone: fundo claro, ícone arredondado e o nome LovABA. */
function splashHtml(w, h) {
  const icon = Math.round(Math.min(w, h) * 0.22)
  return `<html><body style="margin:0;width:${w}px;height:${h}px;background:${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(icon * 0.25)}px;font-family:'Segoe UI',system-ui,sans-serif">
    <div style="width:${icon}px;height:${icon}px;border-radius:${Math.round(icon * 0.24)}px;overflow:hidden">${iconSvg(icon, 0.56)}</div>
    <div style="font-size:${Math.round(icon * 0.42)}px;font-weight:700;color:#0f172a;letter-spacing:-0.02em">Lov<span style="color:${BLUE}">ABA</span></div>
  </body></html>`
}

const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 0.56 },
  { file: 'icon-512.png', size: 512, scale: 0.56 },
  // "maskable": o Android pode cortar em círculo; o coração fica dentro da área segura (80%)
  { file: 'icon-maskable-512.png', size: 512, scale: 0.42 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.56 },
  { file: 'favicon-32.png', size: 32, scale: 0.7 },
]

// Tamanhos de tela (retrato) dos iPhones mais comuns: [largura, altura, densidade, largura css, altura css]
const SPLASH = [
  [1290, 2796, 3, 430, 932],
  [1179, 2556, 3, 393, 852],
  [1284, 2778, 3, 428, 926],
  [1170, 2532, 3, 390, 844],
  [1125, 2436, 3, 375, 812],
  [1242, 2688, 3, 414, 896],
  [828, 1792, 2, 414, 896],
  [750, 1334, 2, 375, 667],
]

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
for (const { file, size, scale } of ICONS) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0">${iconSvg(size, scale)}</body></html>`)
  await page.screenshot({ path: path.join(out, file), omitBackground: false })
  console.log('•', file)
}
for (const [w, h] of SPLASH) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(splashHtml(w, h))
  const file = `splash-${w}x${h}.png`
  await page.screenshot({ path: path.join(out, file) })
  console.log('•', file)
}
await browser.close()

// Trechos para colar no index.html (telas de abertura do iPhone)
console.log('\n<!-- telas de abertura do iPhone -->')
for (const [w, h, dpr, cw, ch] of SPLASH) {
  console.log(
    `<link rel="apple-touch-startup-image" href="/icons/splash-${w}x${h}.png" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`,
  )
}
