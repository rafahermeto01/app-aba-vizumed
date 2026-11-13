import '@/index.css'

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { startSyncLoop } from '@/offline'
import { queryPersister, shouldPersistQuery } from '@/offline/queryPersist'
import { router } from '@/routes'

const DAY = 24 * 60 * 60 * 1000

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // mantém os dados por uma semana para funcionar sem internet
      gcTime: 7 * DAY,
      // sem internet: mostra o que já está guardado no aparelho
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'always' },
  },
})

function MissingConfig() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-base">
      <h1 className="mb-3 text-2xl font-semibold">LovABA ainda não está conectado ao Supabase</h1>
      <p className="text-muted-foreground">
        Crie o arquivo <code>.env.local</code> a partir do <code>.env.example</code> e preencha <code>VITE_SUPABASE_URL</code> e{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>. Depois reinicie com <code>npm run dev</code>. O passo a passo está no README.
      </p>
    </main>
  )
}

if (isSupabaseConfigured) startSyncLoop()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: 7 * DAY,
          buster: 'lovaba-v1',
          dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        }}
      >
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster theme="light" position="top-center" richColors={false} />
        </AuthProvider>
      </PersistQueryClientProvider>
    ) : (
      <MissingConfig />
    )}
  </StrictMode>,
)
