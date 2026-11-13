import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Os mesmos cabeçalhos de segurança da Vercel valem no "npm run preview"
// (assim os testes automáticos já rodam com as regras de produção).
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const securityHeaders = Object.fromEntries(
  vercel.headers.find((h) => h.source === '/(.*)')!.headers.filter((h) => h.key !== 'Strict-Transport-Security').map((h) => [h.key, h.value]),
)

// https://vite.dev/config/
export default defineConfig({
  preview: { headers: securityHeaders },
  plugins: [
    react(),
    tailwindcss(),
    // PWA: app instalável (ícone na tela inicial) que abre sem internet.
    // Ícones e telas de abertura: node scripts/generate-icons.mjs
    VitePWA({
      // Atualização com aviso ("Nova versão disponível"): nunca recarrega sozinho no meio de uma sessão
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        id: '/',
        name: 'LovABA',
        short_name: 'LovABA',
        description: 'Coleta de dados e evolução para clínicas de terapia ABA',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f8fc',
        theme_color: '#2f5fd0',
        categories: ['medical', 'health', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // As telas de abertura do iPhone não precisam ficar no cache (o iOS guarda sozinho)
        globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2}', 'icons/icon-*.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
