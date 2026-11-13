import { CirclePlay } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'
import { timeAgo } from '@/lib/dates'
import { useOpenSessions } from '@/offline/hooks'

/** Se o app fechou no meio de uma sessão, oferece continuar de onde parou. */
export function OpenSessionBanner() {
  const { profile } = useAuth()
  const open = useOpenSessions(profile?.id)
  const location = useLocation()
  if (!open.length) return null
  const s = open[0]
  if (location.pathname.endsWith('/sessao/nova')) return null
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary bg-primary/5 p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-base">
        <strong>Sessão em andamento</strong> com {s.learner_initials || s.learner_name}, iniciada {timeAgo(s.started_at)}.
        {open.length > 1 && ` (mais ${open.length - 1})`}
      </p>
      <Button asChild size="lg">
        <Link to={`/sessao/${s.id}`}>
          <CirclePlay aria-hidden /> Continuar
        </Link>
      </Button>
    </div>
  )
}
