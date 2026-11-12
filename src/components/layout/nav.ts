import { BookOpen, House, Settings, Users, type LucideIcon } from 'lucide-react'

import type { UserRole } from '@/features/auth/AuthProvider'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  roles: UserRole[]
}

const ALL: UserRole[] = ['coordenador', 'supervisor', 'aplicador']

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: House, roles: ALL },
  { to: '/aprendizes', label: 'Aprendizes', icon: Users, roles: ALL },
  { to: '/biblioteca', label: 'Biblioteca', icon: BookOpen, roles: ['coordenador', 'supervisor'] },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, roles: ['coordenador'] },
]

export const navFor = (role: UserRole) => NAV_ITEMS.filter((i) => i.roles.includes(role))
