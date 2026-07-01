export function fmtMoney(v: number | string | null | undefined, short = false): string {
  const n = parseFloat(String(v ?? 0)) || 0
  if (short && n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (short && n >= 10_000) return '$' + Math.round(n / 1000) + 'k'
  return '$' + n.toLocaleString('es-CO')
}

export function elapsedFrom(createdAt: string): { label: string; mins: number } {
  const ms = Date.now() - new Date(createdAt).getTime()
  const mins = Math.max(0, Math.floor(ms / 60000))
  if (mins < 60) return { label: `${mins}m`, mins }
  const h = Math.floor(mins / 60)
  return { label: `${h}h ${mins % 60}m`, mins }
}

export function hoyISO(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
