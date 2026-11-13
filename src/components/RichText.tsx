import { Bold, List, ListOrdered } from 'lucide-react'
import { Fragment, useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * Texto rico SIMPLES para o procedimento dos programas:
 *   **negrito**, linhas com "- " viram lista, linhas com "1. " viram lista numerada.
 * Guardado como texto puro no banco (nada de HTML: sem risco de código malicioso).
 */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

export function RichTextView({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text?.trim()) return null
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={blocks.length} className={list.ordered ? 'list-decimal space-y-1 pl-6' : 'list-disc space-y-1 pl-6'}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    )
    list = null
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-•]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flush()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1])
      continue
    }
    flush()
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>)
  }
  flush()
  return <div className={className ?? 'space-y-2 text-base'}>{blocks}</div>
}

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function wrapBold() {
    const el = ref.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const selected = value.slice(s, e) || 'texto'
    const next = `${value.slice(0, s)}**${selected}**${value.slice(e)}`
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + 2, s + 2 + selected.length)
    })
  }

  function prefixLines(ordered: boolean) {
    const el = ref.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const lineEnd = value.indexOf('\n', e) === -1 ? value.length : value.indexOf('\n', e)
    const lines = value.slice(lineStart, lineEnd).split('\n')
    const done = lines.map((l, i) => (ordered ? `${i + 1}. ` : '- ') + l.replace(/^\s*([-•]|\d+[.)])\s+/, '')).join('\n')
    onChange(value.slice(0, lineStart) + done + value.slice(lineEnd))
    requestAnimationFrame(() => el.focus())
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1" role="toolbar" aria-label="Formatação">
        <Button type="button" variant="outline" size="sm" onClick={wrapBold} aria-label="Negrito" title="Negrito">
          <Bold aria-hidden /> Negrito
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => prefixLines(false)} aria-label="Lista" title="Lista">
          <List aria-hidden /> Lista
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => prefixLines(true)} aria-label="Lista numerada" title="Lista numerada">
          <ListOrdered aria-hidden /> Passos
        </Button>
      </div>
      <Textarea id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-40" />
      {value.trim() && (
        <details className="rounded-lg border bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">Ver como vai ficar</summary>
          <RichTextView text={value} className="mt-2 space-y-2 text-base" />
        </details>
      )}
    </div>
  )
}
