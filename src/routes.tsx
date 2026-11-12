import { createBrowserRouter, Navigate } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { ComingSoonPage } from '@/features/home/ComingSoonPage'
import { HomePage } from '@/features/home/HomePage'

export const router = createBrowserRouter([
  // Telas públicas (não existe "criar conta")
  { path: '/login', element: <LoginPage /> },
  { path: '/esqueci-senha', element: <ForgotPasswordPage /> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  { path: '/trocar-senha', element: <ChangePasswordPage /> },

  // Telas internas
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'aprendizes',
        element: <ComingSoonPage title="Aprendizes" phase={2} description="Lista, cadastro e página de cada aprendiz chegam na fase 2." />,
      },
      {
        path: 'biblioteca',
        element: (
          <RequireAuth roles={['coordenador', 'supervisor']}>
            <ComingSoonPage title="Biblioteca de programas" phase={3} description="Modelos de programas com alvos sugeridos e critério de maestria chegam na fase 3." />
          </RequireAuth>
        ),
      },
      {
        path: 'configuracoes',
        element: (
          <RequireAuth roles={['coordenador']}>
            <ComingSoonPage title="Configurações" phase={2} description="Dados da clínica, equipe, níveis de ajuda e CIDs chegam nas fases 2 e 3." />
          </RequireAuth>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
