import { createBrowserRouter, Navigate } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { RouteError } from '@/components/RouteError'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { CollectPage } from '@/features/collection/CollectPage'
import { FinalizePage } from '@/features/collection/FinalizePage'
import { NewSessionPage } from '@/features/collection/NewSessionPage'
import { SummaryPage } from '@/features/collection/SummaryPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { HomePage } from '@/features/home/HomePage'
import { SessionDetailPage } from '@/features/evolution/SessionDetailPage'
import { LearnerFormPage } from '@/features/learners/LearnerFormPage'
import { LearnerPage } from '@/features/learners/LearnerPage'
import { LearnersPage } from '@/features/learners/LearnersPage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { TemplateFormPage } from '@/features/library/TemplateFormPage'
import { EditProgramPage, NewProgramPage } from '@/features/programs/ProgramFormPages'
import { ProgramPage } from '@/features/programs/ProgramPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
  // Telas públicas (não existe "criar conta")
  { path: '/login', element: <LoginPage /> },
  { path: '/esqueci-senha', element: <ForgotPasswordPage /> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  { path: '/trocar-senha', element: <ChangePasswordPage /> },

  // Coleta: tela cheia, sem o menu (menos toques acidentais durante o atendimento)
  ...[
    ['aprendizes/:id/sessao/nova', <NewSessionPage />],
    ['sessao/:sessionId', <CollectPage />],
    ['sessao/:sessionId/finalizar', <FinalizePage />],
    ['sessao/:sessionId/resumo', <SummaryPage />],
  ].map(([path, page]) => ({ path: `/${path as string}`, element: <RequireAuth>{page}</RequireAuth> })),

  // Telas internas
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'aprendizes', element: <LearnersPage /> },
      {
        path: 'aprendizes/novo',
        element: (
          <RequireAuth roles={['coordenador']}>
            <LearnerFormPage />
          </RequireAuth>
        ),
      },
      { path: 'aprendizes/:id', element: <LearnerPage /> },
      {
        path: 'aprendizes/:id/editar',
        element: (
          <RequireAuth roles={['coordenador']}>
            <LearnerFormPage />
          </RequireAuth>
        ),
      },
      { path: 'aprendizes/:id/sessoes/:sessionId', element: <SessionDetailPage /> },
      { path: 'aprendizes/:id/programas/novo', element: <NewProgramPage /> },
      { path: 'aprendizes/:id/programas/:programId', element: <ProgramPage /> },
      { path: 'aprendizes/:id/programas/:programId/editar', element: <EditProgramPage /> },
      { path: 'perfil', element: <ProfilePage /> },
      ...['biblioteca', 'biblioteca/novo', 'biblioteca/:id'].map((path) => ({
        path,
        element: (
          <RequireAuth roles={['coordenador', 'supervisor']}>
            {path === 'biblioteca' ? <LibraryPage /> : <TemplateFormPage />}
          </RequireAuth>
        ),
      })),
      {
        path: 'configuracoes',
        element: (
          <RequireAuth roles={['coordenador']}>
            <SettingsPage />
          </RequireAuth>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
