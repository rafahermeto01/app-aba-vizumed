import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'

/**
 * Mini-gráfico das últimas sessões (sem eixos). Para Tentativa: % de acerto
 * independente (0–100). Para Frequência/Duração: total por sessão.
 */
export function MiniChart({ values, percent }: { values: number[]; percent: boolean }) {
  if (values.length === 0) {
    return <div className="grid h-12 w-28 place-items-center rounded-md bg-muted/50 text-xs text-muted-foreground">sem sessões</div>
  }
  const data = values.map((v, i) => ({ i, v }))
  return (
    <div className="h-12 w-28" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }} accessibilityLayer={false}>
          <YAxis hide domain={percent ? [0, 100] : [0, 'dataMax']} />
          <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2.5, fill: 'var(--primary)' }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
