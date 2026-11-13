import type { ComponentType, ReactNode } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { RouteError } from '@/components/RouteError'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { FullScreenLoader, RequireAuth } from '@/features/auth/RequireAuth'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { HomePage } from '@/features/home/HomePage'
import type { UserRole } from '@/features/auth/AuthProvider'

/**
 * Cada tela é carregada só quando é aberta (app mais leve). Todas ficam
 * guardadas no aparelho pelo PWA, então continuam abrindo sem internet.
 */
function page<M>(load: () => Promise<M>, pick: (m: M) => ComponentType, wrap?: (el: ReactNode) => ReactNode): Pick<RouteObject, 'lazy'> {
  return {
    lazy: async () => {
      const Component = pick(await load())
      return { element: wrap ? wrap(<Component />) : <Component /> }
    },
  }
}

const onlyFor = (roles: UserRole[]) => (el: ReactNode) => <RequireAuth roles={roles}>{el}</RequireAuth>
const signedIn = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullScreenLoader />,
    children: [
      // Telas públicas (não existe "criar conta")
      { path: '/login', element: <LoginPage /> },
      { path: '/esqueci-senha', element: <ForgotPasswordPage /> },
      { path: '/redefinir-senha', element: <ResetPasswordPage /> },
      { path: '/trocar-senha', element: <ChangePasswordPage /> },

      // Coleta: tela cheia, sem o menu (menos toques acidentais durante o atendimento)
      { path: '/aprendizes/:id/sessao/nova', ...page(() => import('@/features/collection/NewSessionPage'), (m) => m.NewSessionPage, signedIn) },
      { path: '/sessao/:sessionId', ...page(() => import('@/features/collection/CollectPage'), (m) => m.CollectPage, signedIn) },
      { path: '/sessao/:sessionId/finalizar', ...page(() => import('@/features/collection/FinalizePage'), (m) => m.FinalizePage, signedIn) },
      { path: '/sessao/:sessionId/resumo', ...page(() => import('@/features/collection/SummaryPage'), (m) => m.SummaryPage, signedIn) },

      // Telas internas
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: 'aprendizes', ...page(() => import('@/features/learners/LearnersPage'), (m) => m.LearnersPage) },
          { path: 'aprendizes/novo', ...page(() => import('@/features/learners/LearnerFormPage'), (m) => m.LearnerFormPage, onlyFor(['coordenador'])) },
          { path: 'aprendizes/:id', ...page(() => import('@/features/learners/LearnerPage'), (m) => m.LearnerPage) },
          { path: 'aprendizes/:id/editar', ...page(() => import('@/features/learners/LearnerFormPage'), (m) => m.LearnerFormPage, onlyFor(['coordenador'])) },
          { path: 'aprendizes/:id/sessoes/:sessionId', ...page(() => import('@/features/evolution/SessionDetailPage'), (m) => m.SessionDetailPage) },
          { path: 'aprendizes/:id/programas/novo', ...page(() => import('@/features/programs/ProgramFormPages'), (m) => m.NewProgramPage) },
          { path: 'aprendizes/:id/programas/:programId', ...page(() => import('@/features/programs/ProgramPage'), (m) => m.ProgramPage) },
          { path: 'aprendizes/:id/programas/:programId/editar', ...page(() => import('@/features/programs/ProgramFormPages'), (m) => m.EditProgramPage) },
          { path: 'perfil', ...page(() => import('@/features/profile/ProfilePage'), (m) => m.ProfilePage) },
          { path: 'biblioteca', ...page(() => import('@/features/library/LibraryPage'), (m) => m.LibraryPage, onlyFor(['coordenador', 'supervisor'])) },
          { path: 'biblioteca/novo', ...page(() => import('@/features/library/TemplateFormPage'), (m) => m.TemplateFormPage, onlyFor(['coordenador', 'supervisor'])) },
          { path: 'biblioteca/:id', ...page(() => import('@/features/library/TemplateFormPage'), (m) => m.TemplateFormPage, onlyFor(['coordenador', 'supervisor'])) },
          { path: 'configuracoes', ...page(() => import('@/features/settings/SettingsPage'), (m) => m.SettingsPage, onlyFor(['coordenador'])) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
