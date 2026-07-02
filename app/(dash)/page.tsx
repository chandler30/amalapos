'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede } from '@/lib/sede'
import { ESTADOS, PAGOS_ANTICIPADOS, type Pedido, type Alerta } from '@/lib/constants'
import { fmtMoney, elapsedFrom, hoyISO } from '@/lib/format'
import { playSound } from '@/lib/sound'
import { useToast, Spinner, EmptyState, PageHeader } from '@/components/ui'
import { IconClock, IconEye, IconMapPin } from '@/components/icons'
import { StatusChip, OrderBadges, OrderDetailModal, updateEstado, validarPago, esPickup } from '@/components/orders'

const POLL_MS = 15000

/* ── Strip de comprobante / pago anticipado (portado de getQrOrTransferBlock) ── */
function CompStrip({ pedido: o, onVer, onValidar }: { pedido: Pedido; onVer: () => void; onValidar: () => void }) {
  const alerta = o.alerta || ''
  if (alerta === 'PAGO OK') return null // ya validado

  if (alerta === 'ESPERANDO QR') {
    return (
      <div className="mt-2 flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
        style={{ borderColor: 'var(--yellow)', background: 'var(--yellow-soft)' }}>
        <IconClock className="shrink-0 text-yellow" style={{ width: 18, height: 18 }} />
        <div className="min-w-0">
          <div className="text-[12.5px] font-bold text-yellow">Esperando pago anticipado del cliente</div>
          <div className="text-[11.5px] text-ink3">El cliente está procesando el pago. Aguarda el comprobante.</div>
        </div>
      </div>
    )
  }

  if (alerta.includes('TRANSFERENCIA') || (PAGOS_ANTICIPADOS.includes(o.metodo_pago) && o.url_comprobante)) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2.5"
        style={{ borderColor: 'var(--orange)', background: 'var(--orange-soft)' }}>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold text-orange">Comprobante de pago recibido</div>
          <div className="text-[11.5px] text-ink3">
            Valor: <strong className="text-ink">{o.valor_comprobante ? fmtMoney(o.valor_comprobante) : '—'}</strong>
            {' · '}Cuenta: {o.cuenta_destino || '—'}
          </div>
        </div>
        {o.url_comprobante
          ? <button className="btn btn-primary btn-sm" onClick={onVer}>Ver y validar</button>
          : <button className="btn btn-primary btn-sm" onClick={onValidar}>Validar pago</button>}
      </div>
    )
  }

  if (PAGOS_ANTICIPADOS.includes(o.metodo_pago) && !['Entregado', 'Cancelado', 'En camino', 'En cocina'].includes(o.estado)) {
    return (
      <div className="mt-2 rounded-lg border border-dashed px-3 py-2 text-[12px] text-ink3" style={{ borderColor: 'var(--border)' }}>
        Pago por {o.metodo_pago} — esperando comprobante del cliente
      </div>
    )
  }
  return null
}

/* ── Tarjeta de pedido activo ── */
function OrderCard({ pedido: o, onVer, refresh }: { pedido: Pedido; onVer: () => void; refresh: () => void }) {
  const toast = useToast()
  const el = elapsedFrom(o.created_at)
  const tarde = el.mins > 45
  const hora = (o.hora || '').toString().substring(0, 5)
  const pickup = esPickup(o)
  const estados = ESTADOS.filter(s => (pickup ? s !== 'En camino' : s !== 'Listo para recoger'))

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="disp text-base text-brand">{o.num_pedido || '—'}</span>
        <StatusChip estado={o.estado} alerta={o.alerta} />
        <OrderBadges pedido={o} />
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold"
          style={{ color: tarde ? 'var(--danger)' : 'var(--ink3)' }} title="Tiempo desde que entró">
          <IconClock style={{ width: 13, height: 13 }} /> {el.label}
        </span>
        {hora && <span className="text-xs text-ink3">{hora}</span>}
      </div>

      <div className="mt-2">
        <div className="text-[15px] font-bold text-ink">{o.cliente || 'Sin nombre'}</div>
        <div className="text-xs text-ink3">{o.telefono || '—'}</div>
        <div className="mt-1 flex items-start gap-1 text-[13px] text-ink2">
          <IconMapPin className="mt-0.5 shrink-0 text-ink3" style={{ width: 14, height: 14 }} />
          <span>{o.direccion || '—'}</span>
        </div>
      </div>

      <div className="mt-2 border-t pt-2 text-[13px] leading-relaxed text-ink2" style={{ borderColor: 'var(--border)' }}>
        {o.items || '—'}
      </div>

      <CompStrip pedido={o} onVer={onVer} onValidar={() => validarPago(o, toast, refresh)} />

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="disp text-xl">{fmtMoney(o.total)}</span>
        <span className={`chip ${PAGOS_ANTICIPADOS.includes(o.metodo_pago) ? 'chip-blue' : 'chip-green'}`}>
          {o.metodo_pago || 'Efectivo'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className="input min-w-0 flex-1 py-1.5 text-[13px]" value=""
          onChange={e => { const v = e.target.value; if (v) updateEstado(o, v, toast, refresh) }}>
          <option value="">{o.estado}</option>
          {estados.filter(s => s !== o.estado).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={onVer}>
          <IconEye style={{ width: 15, height: 15 }} /> Ver
        </button>
      </div>
    </div>
  )
}

/* ── Página principal: dashboard en vivo ── */
export default function DashboardPage() {
  const toast = useToast()
  const { sedeId } = useSede()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState<Pedido | null>(null)
  const seenIds = useRef<Set<string> | null>(null)

  const fetchAll = useCallback(async () => {
    if (!sedeId) return
    const [ped, al] = await Promise.all([
      supabase.from('pedidos').select('*').eq('sede_id', sedeId).order('created_at', { ascending: false }).limit(100),
      supabase.from('alertas').select('*').eq('sede_id', sedeId).order('created_at', { ascending: false }).limit(100),
    ])
    if (!ped.error && ped.data) {
      const rows = ped.data as Pedido[]
      if (seenIds.current === null) {
        seenIds.current = new Set(rows.map(o => o.id))
      } else {
        const nuevos = rows.filter(o => !seenIds.current!.has(o.id))
        if (nuevos.length) {
          nuevos.forEach(o => seenIds.current!.add(o.id))
          if (nuevos.some(o => (o.alerta || '').includes('TRANSFERENCIA'))) playSound('alerta')
          else playSound('new')
        }
      }
      setPedidos(rows)
      setDetalle(d => (d ? rows.find(o => o.id === d.id) ?? d : d))
    }
    if (!al.error && al.data) setAlertas(al.data as Alerta[])
    setLoading(false)
  }, [sedeId])

  useEffect(() => {
    if (!sedeId) return
    seenIds.current = null // al cambiar de sede no sonar por pedidos ya existentes
    setLoading(true)
    fetchAll()
    const t = setInterval(fetchAll, POLL_MS)
    return () => clearInterval(t)
  }, [fetchAll, sedeId])

  const activos = pedidos.filter(o => !['Entregado', 'Cancelado'].includes(o.estado))

  /* Resumen del día */
  const hoy = hoyISO()
  const deHoy = pedidos.filter(o => o.fecha === hoy || (o.created_at || '').startsWith(hoy))
  const validosHoy = deHoy.filter(o => o.estado !== 'Cancelado')
  const anticipados = validosHoy.filter(o => PAGOS_ANTICIPADOS.includes(o.metodo_pago)).length
  const contraEntrega = validosHoy.length - anticipados
  const ventas = validosHoy.reduce((s, o) => s + (parseFloat(String(o.total)) || 0), 0)
  const ticket = validosHoy.length ? Math.round(ventas / validosHoy.length) : 0

  const alertasPend = alertas.filter(a => a.estado === 'PENDIENTE')

  async function atenderAlerta(id: string) {
    const { error } = await supabase.from('alertas').update({ estado: 'ATENDIDA' }).eq('id', id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Alerta marcada como atendida', 'success')
    fetchAll()
  }

  return (
    <div>
      <PageHeader title="Dashboard" sub="Operación en vivo — Amala Pizza & Tacos">
        <span className="chip chip-green">● En vivo</span>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Columna principal: pedidos activos ── */}
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="disp text-lg uppercase tracking-wide">Pedidos activos</h2>
            <span className="chip chip-blue">{activos.length}</span>
          </div>
          {loading ? (
            <Spinner />
          ) : activos.length === 0 ? (
            <div className="card"><EmptyState text="Sin pedidos activos — todo al día" /></div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {activos.map(o => (
                <OrderCard key={o.id} pedido={o} refresh={fetchAll} onVer={() => setDetalle(o)} />
              ))}
            </div>
          )}
        </div>

        {/* ── Columna derecha (pasa abajo en <lg) ── */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="card p-4">
            <h2 className="disp mb-3 text-lg uppercase tracking-wide">Resumen del día</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--bg2)' }}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink3">Pedidos</div>
                <div className="disp text-xl text-blue">{validosHoy.length}</div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--bg2)' }}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink3">Anticipado</div>
                <div className="disp text-xl text-yellow">{anticipados}</div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--bg2)' }}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink3">C. entrega</div>
                <div className="disp text-xl text-green">{contraEntrega}</div>
              </div>
            </div>
            <div className="mt-2 rounded-lg p-3" style={{ background: 'var(--bg2)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink3">Ventas del día</div>
              <div className="disp text-2xl text-green">{fmtMoney(ventas)}</div>
              <div className="mt-0.5 text-[11.5px] text-ink3">Ticket promedio: {fmtMoney(ticket)}</div>
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="disp text-lg uppercase tracking-wide">Alertas pendientes</h2>
              {alertasPend.length > 0 && <span className="chip chip-red">{alertasPend.length}</span>}
            </div>
            {alertasPend.length === 0 ? (
              <EmptyState text="Sin alertas pendientes" />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Cliente</th><th>Razón</th><th></th></tr>
                  </thead>
                  <tbody>
                    {alertasPend.map(a => (
                      <tr key={a.id}>
                        <td>
                          <div className="font-semibold text-ink">{a.cliente || '—'}</div>
                          <div className="text-[11px] text-ink3">{a.telefono || '—'}</div>
                        </td>
                        <td className="text-[12px]">{a.razon || '—'}</td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button className="btn btn-secondary btn-sm whitespace-nowrap" onClick={() => atenderAlerta(a.id)}>Atendido</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <OrderDetailModal pedido={detalle} onClose={() => setDetalle(null)} onChanged={fetchAll} />
    </div>
  )
}
