'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede } from '@/lib/sede'
import { ESTADOS, ESTADO_COLOR, METODOS_PAGO, PAGOS_ANTICIPADOS, type Pedido } from '@/lib/constants'
import { fmtMoney } from '@/lib/format'
import { EmptyState, PageHeader, Spinner } from '@/components/ui'

/* ── Colores (solo variables CSS) ── */
const CHIP_VAR: Record<string, string> = {
  'chip-yellow': 'var(--yellow)',
  'chip-orange': 'var(--orange)',
  'chip-green': 'var(--green)',
  'chip-blue': 'var(--blue)',
  'chip-teal': 'var(--teal)',
  'chip-red': 'var(--red)',
  'chip-gray': 'var(--ink3)',
}
const PAGO_COLOR: Record<string, string> = {
  Efectivo: 'var(--green)',
  'Datáfono': 'var(--teal)',
  Nequi: 'var(--orange)',
  Transferencia: 'var(--blue)',
  Llave: 'var(--yellow)',
}

type VBarDatum = { val: number; lbl: string; short: string; tip: string }
type HBarRow = { lbl: string; val: number; color: string; valTxt: string }

/* ── Barras verticales (ventas por día / pedidos por hora) ── */
function VBars({ data, gradient }: { data: VBarDatum[]; gradient: string }) {
  if (!data.length || data.every(d => d.val === 0))
    return <div className="py-8 text-center text-xs text-ink3">Sin datos en el período</div>
  const max = Math.max(1, ...data.map(d => d.val))
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: 150 }}>
        {data.map((d, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={d.tip}>
            <div className="mb-0.5 overflow-visible text-[9px] leading-none whitespace-nowrap text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>
              {d.short}
            </div>
            <div className="rbar-fill w-full" style={{ height: Math.max(2, Math.round((d.val / max) * 124)), background: gradient }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] border-t pt-1" style={{ borderColor: 'var(--border)' }}>
        {data.map((d, i) => (
          <div key={i} className="min-w-0 flex-1 truncate text-center text-[9px] text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>
            {d.lbl}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Barras horizontales (método de pago / estados) ── */
function HBars({ rows }: { rows: HBarRow[] }) {
  if (!rows.length) return <div className="py-4 text-xs text-ink3">Sin datos</div>
  const max = Math.max(1, ...rows.map(r => r.val))
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-32 shrink-0 truncate text-xs text-ink2 max-sm:w-24" title={r.lbl}>{r.lbl}</div>
          <div className="hbar-track flex-1">
            <div className="hbar-fill" style={{ width: `${Math.max(Math.round((r.val / max) * 100), 2)}%`, background: r.color }} />
          </div>
          <div className="w-20 shrink-0 text-right text-[11px] text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>{r.valTxt}</div>
        </div>
      ))}
    </div>
  )
}

/* ── KPI ── */
function Kpi({ label, value, color, delta }: { label: string; value: string | number; color?: string; delta?: number | null }) {
  return (
    <div className="card p-3">
      <div className="disp text-xl leading-tight" style={color ? { color } : undefined}>
        {value}
        {delta !== null && delta !== undefined && (
          <span className="ml-1.5 align-middle text-[11px] font-bold"
            style={{ color: delta >= 0 ? 'var(--green)' : 'var(--danger)', fontFamily: 'var(--font-body)' }}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[10px] font-bold tracking-wider text-ink3 uppercase">{label}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="disp mb-3 text-sm tracking-wide text-ink2 uppercase">{children}</h3>
}

export default function ReportesPage() {
  const { sedeId } = useSede()
  const [orders, setOrders] = useState<Pedido[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [range, setRange] = useState('7')
  const [fromD, setFromD] = useState('')
  const [toD, setToD] = useState('')
  const [payF, setPayF] = useState('all')
  const [statF, setStatF] = useState('all')

  const load = useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('pedidos').select('*')
      .eq('sede_id', sedeId)
      .order('created_at', { ascending: false })
      .limit(3000)
    if (err || !data) { setError(true); setOrders(null) }
    else { setError(false); setOrders(data as Pedido[]) }
    setLoading(false)
  }, [sedeId])

  useEffect(() => {
    if (!sedeId) return
    load()
  }, [load, sedeId])

  const report = useMemo(() => {
    if (!orders) return null

    /* ── Rango de fechas: fechas personalizadas tienen prioridad sobre el preset ── */
    let start: Date | null = null, end: Date | null = null, periodLabel = ''
    if (fromD || toD) {
      start = fromD ? new Date(fromD + 'T00:00:00') : null
      end = toD ? new Date(toD + 'T23:59:59') : null
      periodLabel = `${fromD || '…'} a ${toD || 'hoy'}`
    } else if (range === 'all') {
      periodLabel = 'Todo el tiempo'
    } else if (range === '1') {
      start = new Date(); start.setHours(0, 0, 0, 0); periodLabel = 'Hoy'
    } else {
      start = new Date(); start.setDate(start.getDate() - parseInt(range)); periodLabel = `Últimos ${range} días`
    }
    const s = start, e = end
    const inRange = orders.filter(o => {
      const t = new Date(o.created_at)
      return (!s || t >= s) && (!e || t <= e)
    })
    const view = inRange.filter(o =>
      (payF === 'all' || o.metodo_pago === payF) && (statF === 'all' || o.estado === statF))

    /* ── KPIs (Cancelados fuera de los ingresos) ── */
    const active = view.filter(o => o.estado !== 'Cancelado')
    const total = active.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    const count = active.length
    const cancelled = view.length - count
    const ticket = count > 0 ? Math.round(total / count) : 0
    const ticketMax = active.reduce((m, o) => Math.max(m, Number(o.total) || 0), 0)
    const contraEntrega = active.filter(o => o.metodo_pago === 'Efectivo' || o.metodo_pago === 'Datáfono').length
    const anticipados = active.filter(o => PAGOS_ANTICIPADOS.includes(o.metodo_pago)).length
    const tasa = view.length > 0 ? Math.round((count / view.length) * 100) : 0
    const domis = active.reduce((sum, o) => sum + (Number(o.costo_domicilio) || 0), 0)
    const unidades = active.reduce((sum, o) =>
      sum + (Number(o.cantidad) || (o.items ? o.items.split(',').filter(x => x.trim()).length : 0)), 0)
    const clientes = new Set(active.map(o => o.telefono || o.cliente || '')).size

    /* ── Delta % vs período anterior (solo presets por días) ── */
    let dCount: number | null = null, dTotal: number | null = null
    if (s && !fromD && !toD && range !== 'all') {
      const dur = Date.now() - s.getTime()
      const prevStart = new Date(s.getTime() - dur)
      const prev = orders
        .filter(o => { const t = new Date(o.created_at); return t >= prevStart && t < s })
        .filter(o => (payF === 'all' || o.metodo_pago === payF) && (statF === 'all' || o.estado === statF) && o.estado !== 'Cancelado')
      const pc = prev.length
      const pt = prev.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
      if (pc > 0) dCount = Math.round(((count - pc) / pc) * 100)
      if (pt > 0) dTotal = Math.round(((total - pt) / pt) * 100)
    }

    /* ── Ventas por día ── */
    const byDate: Record<string, { count: number; total: number }> = {}
    active.forEach(o => {
      const d = (o.fecha || o.created_at || '').slice(0, 10)
      if (!byDate[d]) byDate[d] = { count: 0, total: 0 }
      byDate[d].count++; byDate[d].total += Number(o.total) || 0
    })
    const dateAsc = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))
    const dateRows = [...dateAsc].reverse()
    const dateChart = dateAsc.slice(-30)

    /* ── Pedidos por hora ── */
    const byHour: number[] = Array.from({ length: 24 }, () => 0)
    active.forEach(o => {
      const h = parseInt((o.hora || '').slice(0, 2))
      if (!isNaN(h) && h >= 0 && h < 24) byHour[h]++
    })

    /* ── Top productos (split de items por coma) ── */
    const byProd: Record<string, number> = {}
    active.forEach(o => {
      (o.items || '').split(',').forEach(item => {
        const p = item.trim()
        if (!p) return
        byProd[p] = (byProd[p] || 0) + 1
      })
    })
    const prodRows = Object.entries(byProd).sort((a, b) => b[1] - a[1]).slice(0, 12)

    /* ── Top clientes ── */
    const byCli: Record<string, { n: number; t: number }> = {}
    active.forEach(o => {
      const k = o.cliente || o.telefono || '—'
      if (!byCli[k]) byCli[k] = { n: 0, t: 0 }
      byCli[k].n++; byCli[k].t += Number(o.total) || 0
    })
    const cliRows = Object.entries(byCli).sort((a, b) => b[1].t - a[1].t).slice(0, 10)

    /* ── Método de pago (una barra por método presente, con %) ── */
    const pagoCounts = METODOS_PAGO.map(m => [m, active.filter(o => o.metodo_pago === m).length] as const)
      .filter(([, n]) => n > 0)
    const totalPagos = pagoCounts.reduce((sum, [, n]) => sum + n, 0) || 1
    const pagoRows: HBarRow[] = pagoCounts.map(([m, n]) => ({
      lbl: m, val: n, color: PAGO_COLOR[m] || 'var(--ink3)',
      valTxt: `${n} · ${Math.round((n / totalPagos) * 100)}%`,
    }))

    /* ── Estado de pedidos ── */
    const estadoRows: HBarRow[] = ESTADOS
      .map(est => ({ est, n: view.filter(o => o.estado === est).length }))
      .filter(x => x.n > 0)
      .map(x => ({ lbl: x.est, val: x.n, color: CHIP_VAR[ESTADO_COLOR[x.est]] || 'var(--ink3)', valTxt: String(x.n) }))

    return {
      periodLabel, viewCount: view.length,
      count, total, ticket, ticketMax, tasa, cancelled, contraEntrega, anticipados,
      domis, unidades, clientes, dCount, dTotal,
      dateAsc, dateRows, dateChart, byHour, prodRows, cliRows, pagoRows, estadoRows,
    }
  }, [orders, range, fromD, toD, payF, statF])

  const r = report

  return (
    <div>
      <PageHeader title="Reportes" sub="Análisis de desempeño">
        <select className="input" style={{ width: 'auto' }} value={range} title="Rango"
          onChange={ev => { setFromD(''); setToD(''); setRange(ev.target.value) }}>
          <option value="1">Hoy</option>
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="all">Todo el tiempo</option>
        </select>
        <input type="date" className="input" style={{ width: 'auto' }} value={fromD} title="Desde"
          onChange={ev => setFromD(ev.target.value)} />
        <input type="date" className="input" style={{ width: 'auto' }} value={toD} title="Hasta"
          onChange={ev => setToD(ev.target.value)} />
        <select className="input" style={{ width: 'auto' }} value={payF} title="Método de pago"
          onChange={ev => setPayF(ev.target.value)}>
          <option value="all">Todo pago</option>
          {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={statF} title="Estado"
          onChange={ev => setStatF(ev.target.value)}>
          <option value="all">Todo estado</option>
          {ESTADOS.map(est => <option key={est} value={est}>{est}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={load}>↺ Actualizar</button>
      </PageHeader>

      {loading && (
        <div className="py-10 text-center text-sm text-ink3">
          <Spinner />
          Generando reporte...
        </div>
      )}

      {!loading && error && <EmptyState text="Error al cargar datos" />}

      {!loading && !error && r && (
        <div>
          {/* Contexto del período */}
          <div className="mb-4 text-xs text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>
            Período: {r.periodLabel} · {r.viewCount} pedidos
            {payF !== 'all' ? ` · ${payF}` : ''}
            {statF !== 'all' ? ` · ${statF}` : ''}
          </div>

          {/* KPIs */}
          <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            <Kpi label="Pedidos" value={r.count} color="var(--blue)" delta={r.dCount} />
            <Kpi label="Ingresos" value={fmtMoney(r.total, true)} color="var(--green)" delta={r.dTotal} />
            <Kpi label="Ticket Prom." value={fmtMoney(r.ticket, true)} color="var(--orange)" />
            <Kpi label="Ticket Máx." value={fmtMoney(r.ticketMax, true)} />
            <Kpi label="Tasa Éxito" value={`${r.tasa}%`} color="var(--teal)" />
            <Kpi label="Cancelados" value={r.cancelled} color="var(--danger)" />
            <Kpi label="Contra entrega" value={r.contraEntrega} color="var(--green)" />
            <Kpi label="Anticipados" value={r.anticipados} color="var(--yellow)" />
            <Kpi label="Domicilios" value={fmtMoney(r.domis, true)} />
            <Kpi label="Productos" value={r.unidades} />
            <Kpi label="Clientes" value={r.clientes} />
          </div>

          {/* Ventas por día */}
          <div className="card mb-3 p-4">
            <SectionTitle>Ventas por Día{r.dateAsc.length > 30 ? ' (últimos 30)' : ''}</SectionTitle>
            <VBars gradient="linear-gradient(180deg, var(--red), var(--danger))"
              data={r.dateChart.map(([d, v]) => ({
                val: v.total,
                lbl: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
                short: v.total >= 1000 ? `${Math.round(v.total / 1000)}k` : String(v.total),
                tip: `${d} · ${v.count} pedidos · ${fmtMoney(v.total)}`,
              }))} />
          </div>

          {/* Pedidos por hora / Método de pago / Estados */}
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <SectionTitle>Pedidos por Hora</SectionTitle>
              <VBars gradient="linear-gradient(180deg, var(--blue), var(--teal))"
                data={r.byHour.map((n, h) => ({
                  val: n,
                  lbl: h % 3 === 0 ? String(h) : '',
                  short: n ? String(n) : '',
                  tip: `${h}:00 · ${n} pedidos`,
                }))} />
            </div>
            <div className="card p-4">
              <SectionTitle>Método de Pago</SectionTitle>
              <HBars rows={r.pagoRows} />
              <div className="mt-5">
                <SectionTitle>Estado de Pedidos</SectionTitle>
                <HBars rows={r.estadoRows} />
              </div>
            </div>
          </div>

          {/* Top productos / Top clientes */}
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <SectionTitle>Top Productos</SectionTitle>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>#</th><th>Producto</th><th className="text-center!">Veces</th></tr></thead>
                  <tbody>
                    {r.prodRows.length ? r.prodRows.map(([p, c], i) => (
                      <tr key={p}>
                        <td className="text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>{i + 1}</td>
                        <td>{p}</td>
                        <td className="text-center text-brand" style={{ fontFamily: 'var(--font-mono)' }}>{c}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="py-4 text-center text-ink3">Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card p-4">
              <SectionTitle>Top Clientes</SectionTitle>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>#</th><th>Cliente</th><th className="text-center!">Pedidos</th><th>Gasto</th></tr></thead>
                  <tbody>
                    {r.cliRows.length ? r.cliRows.map(([k, v], i) => (
                      <tr key={k}>
                        <td className="text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>{i + 1}</td>
                        <td>{k}</td>
                        <td className="text-center" style={{ fontFamily: 'var(--font-mono)' }}>{v.n}</td>
                        <td className="disp text-green">{fmtMoney(v.t)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="py-4 text-center text-ink3">Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detalle por día */}
          <div className="card p-4">
            <SectionTitle>Detalle por Día</SectionTitle>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Fecha</th><th className="text-center!">Pedidos</th><th>Ingresos</th><th>Ticket Prom.</th></tr></thead>
                <tbody>
                  {r.dateRows.length ? r.dateRows.map(([d, v]) => (
                    <tr key={d}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d}</td>
                      <td className="text-center">{v.count}</td>
                      <td className="disp text-green">{fmtMoney(v.total)}</td>
                      <td className="text-ink2" style={{ fontFamily: 'var(--font-mono)' }}>{fmtMoney(Math.round(v.total / v.count))}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="py-4 text-center text-ink3">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
