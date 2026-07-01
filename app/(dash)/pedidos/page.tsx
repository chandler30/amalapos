'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ESTADOS, PAGOS_ANTICIPADOS, type Pedido } from '@/lib/constants'
import { fmtMoney, hoyISO } from '@/lib/format'
import { useToast, Spinner, EmptyState, PageHeader } from '@/components/ui'
import { IconChat, IconEye } from '@/components/icons'
import { OrderBadges, OrderDetailModal, updateEstado } from '@/components/orders'

const POLL_MS = 30000

/* ── Píldora de filtro ── */
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`cursor-pointer whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors ${active ? 'text-white' : 'text-ink2 hover:text-ink'}`}
      style={active
        ? { background: 'var(--red)', borderColor: 'var(--red)' }
        : { background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {children}
    </button>
  )
}

/* ── Chip de alerta de pago (portado de alertaCell) ── */
function AlertaChip({ alerta }: { alerta: string | null }) {
  const a = alerta || ''
  if (a === 'ESPERANDO QR') return <span className="chip chip-teal">QR Pendiente</span>
  if (a.includes('TRANSFERENCIA')) return <span className="chip chip-yellow">Comprobante</span>
  if (a === 'PAGO OK') return <span className="chip chip-green">Pago OK</span>
  return null
}

const FILTROS: { key: string; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'today', label: 'Hoy' },
  ...ESTADOS.map(s => ({ key: s as string, label: s as string })),
]

export default function PedidosPage() {
  const toast = useToast()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('all')
  const [q, setQ] = useState('')
  const [detalle, setDetalle] = useState<Pedido | null>(null)

  const fetchPedidos = useCallback(async () => {
    const { data, error } = await supabase.from('pedidos').select('*')
      .order('created_at', { ascending: false }).limit(300)
    if (!error && data) {
      const rows = data as Pedido[]
      setPedidos(rows)
      setDetalle(d => (d ? rows.find(o => o.id === d.id) ?? d : d))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPedidos()
    const t = setInterval(fetchPedidos, POLL_MS)
    return () => clearInterval(t)
  }, [fetchPedidos])

  /* Filtrado (portado de renderOrdersTable) */
  const hoy = hoyISO()
  const ql = q.trim().toLowerCase()
  const filtrados = pedidos.filter(o => {
    if (ql && !(
      (o.cliente || '').toLowerCase().includes(ql) ||
      (o.num_pedido || '').toLowerCase().includes(ql) ||
      (o.telefono || '').includes(ql)
    )) return false
    if (filtro === 'all') return true
    if (filtro === 'today') return o.fecha === hoy || (o.created_at || '').startsWith(hoy)
    return o.estado === filtro
  })

  return (
    <div>
      <PageHeader title="Pedidos" sub="Historial completo">
        <input className="input w-64 max-sm:w-full" type="text" placeholder="Buscar cliente, #pedido o teléfono…"
          value={q} onChange={e => setQ(e.target.value)} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map(f => (
          <Pill key={f.key} active={filtro === f.key} onClick={() => setFiltro(f.key)}>{f.label}</Pill>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : filtrados.length === 0 ? (
        <div className="card"><EmptyState text="Sin pedidos" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[900px]">
            <thead>
              <tr>
                <th>#Pedido</th><th>Fecha</th><th>Cliente</th><th>Dirección</th><th>Items</th>
                <th>Total</th><th>Pago</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(o => {
                const hora = (o.hora || '').toString().substring(0, 5)
                return (
                  <tr key={o.id}>
                    <td className="disp whitespace-nowrap text-brand">{o.num_pedido || '—'}</td>
                    <td className="whitespace-nowrap text-[11.5px] text-ink3">{o.fecha || ''} {hora}</td>
                    <td className="font-semibold text-ink">
                      <div>{o.cliente || '—'}</div>
                      <div className="text-[11px] font-normal text-ink3">{o.telefono || '—'}</div>
                    </td>
                    <td><div className="max-w-[160px] truncate" title={o.direccion || ''}>{o.direccion || '—'}</div></td>
                    <td><div className="max-w-[200px] truncate" title={o.items || ''}>{o.items || '—'}</div></td>
                    <td className="disp whitespace-nowrap">{fmtMoney(o.total)}</td>
                    <td>
                      <div className="flex max-w-[180px] flex-wrap items-center gap-1">
                        <span className={`chip ${PAGOS_ANTICIPADOS.includes(o.metodo_pago) ? 'chip-blue' : 'chip-green'}`}>
                          {o.metodo_pago || 'Efectivo'}
                        </span>
                        <AlertaChip alerta={o.alerta} />
                        <OrderBadges pedido={o} />
                      </div>
                    </td>
                    <td>
                      <select className="input w-40 py-1.5 text-[12.5px]" value=""
                        onChange={e => { const v = e.target.value; if (v) updateEstado(o, v, toast, fetchPedidos) }}>
                        <option value="">{o.estado}</option>
                        {ESTADOS.filter(s => s !== o.estado).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button className="btn btn-secondary btn-sm" title="Ver detalle" onClick={() => setDetalle(o)}>
                          <IconEye style={{ width: 15, height: 15 }} /> Ver
                        </button>
                        {o.inbox_url && (
                          <a href={o.inbox_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" title="Abrir chat">
                            <IconChat style={{ width: 15, height: 15 }} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <OrderDetailModal pedido={detalle} onClose={() => setDetalle(null)} onChanged={fetchPedidos} />
    </div>
  )
}
