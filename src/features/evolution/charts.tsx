// Gráficos de evolução (Recharts).
// Regras: um eixo só (nunca dois), linhas de 2px, pontos ≥ 8px com anel da cor
// do fundo, grade discreta, dica ao passar o dedo/mouse, e o número de
// tentativas sempre junto da porcentagem.
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { readableTextColor } from '@/features/programs/constants'

const AXIS = { stroke: 'var(--border)', fontSize: 12, tick: { fill: 'var(--muted-foreground)' } }

function TooltipBox({ children }: { children: ReactNode }) {
  return <div className="max-w-64 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">{children}</div>
}

export function ChartEmpty({ text = 'Sem sessões neste período.' }: { text?: string }) {
  return <div className="grid h-48 place-items-center rounded-xl border border-dashed text-base text-muted-foreground">{text}</div>
}

// ---- % de acerto independente por sessão ---------------------------------------------

export type PercentPoint = {
  key: string
  /** rótulo curto do eixo: "#7" */
  label: string
  /** linha de cima da dica: "Sessão #7 · 12/11/2026" */
  title: string
  pct: number | null
  correct: number
  total: number
  /** nível de ajuda vigente (gráfico por alvo) */
  level?: { abbreviation: string; name: string; color: string } | null
}

type LevelRun = { from: number; to: number; level: NonNullable<PercentPoint['level']> }

function levelRuns(points: PercentPoint[]): LevelRun[] {
  const runs: LevelRun[] = []
  points.forEach((p, i) => {
    if (!p.level) return
    const last = runs[runs.length - 1]
    if (last && last.level.abbreviation === p.level.abbreviation && last.to === i - 1) last.to = i
    else runs.push({ from: i, to: i, level: p.level })
  })
  return runs
}

type TipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }

function PercentTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as PercentPoint
  return (
    <TooltipBox>
      <p className="font-medium">{p.title}</p>
      <p>{p.total ? `${p.pct}% independente · ${p.correct} de ${p.total} tentativas` : 'sem tentativas'}</p>
      {p.level && (
        <p className="text-muted-foreground">
          Nível de ajuda: {p.level.abbreviation} ({p.level.name})
        </p>
      )}
    </TooltipBox>
  )
}

/**
 * Linha de % independente por sessão. Com `level` nos pontos (gráfico por alvo):
 * fundo colorido pelo nível vigente, sigla escrita em cada faixa e linhas
 * verticais onde o nível mudou.
 */
export function PercentChart({ points, criterion, height = 260, ariaLabel }: { points: PercentPoint[]; criterion?: number; height?: number; ariaLabel: string }) {
  if (points.length === 0) return <ChartEmpty />
  const data = points.map((p, i) => ({ ...p, i }))
  const runs = levelRuns(points)
  const changes = runs.slice(1).map((r) => r.from)
  const showEvery = Math.max(1, Math.ceil(points.length / 10))

  return (
    <figure aria-label={ariaLabel} className="w-full">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: runs.length ? 22 : 8, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            {runs.map((r) => (
              <ReferenceArea
                key={`${r.from}-${r.level.abbreviation}`}
                x1={r.from - 0.5}
                x2={r.to + 0.5}
                y1={0}
                y2={100}
                fill={r.level.color}
                fillOpacity={0.12}
                ifOverflow="hidden"
                label={{ value: r.level.abbreviation, position: 'insideTop', fill: 'var(--foreground)', fontSize: 12, fontWeight: 600, dy: -18 }}
              />
            ))}
            {changes.map((x) => (
              <ReferenceLine key={`chg-${x}`} x={x - 0.5} stroke="var(--muted-foreground)" strokeDasharray="4 3" strokeWidth={1.5} />
            ))}
            {criterion != null && (
              <ReferenceLine
                y={criterion}
                stroke="var(--muted-foreground)"
                strokeDasharray="2 4"
                label={{ value: `critério ${criterion}%`, position: 'insideBottomRight', fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
            )}
            <XAxis
              type="number"
              dataKey="i"
              domain={[-0.5, points.length - 0.5]}
              ticks={data.filter((_, i) => i % showEvery === 0).map((d) => d.i)}
              tickFormatter={(i: number) => data[i]?.label ?? ''}
              {...AXIS}
              tickLine={false}
            />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} {...AXIS} tickLine={false} axisLine={false} />
            <Tooltip content={(props) => <PercentTooltip active={props.active} payload={props.payload} />} cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }} />
            <Line
              type="linear"
              dataKey="pct"
              stroke="var(--primary)"
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; payload?: PercentPoint; index?: number }) =>
                props.cx == null || props.cy == null || props.payload?.pct == null ? (
                  <g key={`d-${props.index}`} />
                ) : (
                  <circle
                    key={`d-${props.index}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={5}
                    fill={props.payload.level?.color ?? 'var(--primary)'}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                )
              }
              activeDot={{ r: 7, stroke: 'var(--card)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {runs.length > 0 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {[...new Map(runs.map((r) => [r.level.abbreviation, r.level])).values()].map((l) => (
            <span key={l.abbreviation} className="inline-flex items-center gap-1.5">
              <span className="inline-grid h-5 min-w-8 place-items-center rounded px-1 text-xs font-semibold" style={{ backgroundColor: l.color, color: readableTextColor(l.color) }}>
                {l.abbreviation}
              </span>
              {l.name}
            </span>
          ))}
          {changes.length > 0 && <span>· linhas tracejadas = mudança de nível</span>}
        </figcaption>
      )}
    </figure>
  )
}

// ---- Frequência / duração por sessão --------------------------------------------------

export type MeasurePoint = { key: string; label: string; title: string; value: number; detail: string }

function MeasureTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as MeasurePoint
  return (
    <TooltipBox>
      <p className="font-medium">{p.title}</p>
      <p>{p.detail}</p>
    </TooltipBox>
  )
}

/** Barras de um valor por sessão (ocorrências, ou minutos). Um eixo só. */
export function MeasureChart({ points, unit, height = 220, ariaLabel }: { points: MeasurePoint[]; unit: string; height?: number; ariaLabel: string }) {
  if (points.length === 0) return <ChartEmpty />
  const showEvery = Math.max(1, Math.ceil(points.length / 10))
  return (
    <figure aria-label={ariaLabel} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -18 }} barCategoryGap={4}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" interval={showEvery - 1} {...AXIS} tickLine={false} />
          <YAxis allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} label={{ value: unit, angle: -90, position: 'insideLeft', offset: 24, fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <Tooltip content={(props) => <MeasureTooltip active={props.active} payload={props.payload} />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  )
}
