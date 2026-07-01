'use client'
import { ESTADOS, ESTADO_COLOR, type Pedido } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { fmtMoney, elapsedFrom } from '@/lib/format'
import { playSound } from '@/lib/sound'
import { Modal, useToast } from '@/components/ui'
import { IconBag, IconChat, IconMapPin } from '@/components/icons'

export type ToastFn = (msg: string, kind?: 'success' | 'error' | 'info') => void

/* ── Chip de estado (la alerta de pago tiene prioridad visual) ── */
export function StatusChip({ estado, alerta }: { estado: string; alerta?: string | null }) {
  const a = alerta || ''
  if (a === 'ESPERANDO QR') return <span className="chip chip-yellow">Esperando comprobante</span>
  if (a.includes('TRANSFERENCIA')) return <span className="chip chip-orange">Comprobante recibido</span>
  if (a === 'PAGO OK') return <span className="chip chip-green">Pago validado</span>
  return <span className={`chip ${ESTADO_COLOR[estado] || 'chip-gray'}`}>{estado}</span>
}

/* ── Badges auxiliares del pedido ── */
export function esPickup(p: Pedido): boolean {
  return /recoge|pickup/i.test(p.direccion || '')
}
export function esFueraHorario(p: Pedido): boolean {
  return /FUERA DE HORARIO/i.test(p.notas || '')
}
export function OrderBadges({ pedido }: { pedido: Pedido }) {
  return (
    <>
      {esFueraHorario(pedido) && <span className="chip chip-yellow" title="Pedido recibido fuera de horario">Fuera de horario</span>}
      {esPickup(pedido) && (
        <span className="chip chip-teal" title="Para llevar / recoger en el local">
          <IconBag style={{ width: 12, height: 12 }} /> Recoge en punto
        </span>
      )}
    </>
  )
}

/* ── Notificación al cliente (Edge Function: notify_status) ── */
export async function notifyStatus(id: string, estado: string, toast: ToastFn): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('webhook-pedidos', {
      body: { action: 'notify_status', id, estado },
    })
    if (error) { console.warn('notify_status error', error.message); return false }
    if (data && data.enviado) { toast('Notificación enviada al cliente', 'info'); return true }
    if (data && data.motivo === 'sin_user_ns') console.warn('Pedido sin user_ns: no se notifica')
    return false
  } catch (e) {
    console.warn('notify_status exception', (e as Error).message)
    return false
  }
}

/* ── Cambio de estado (portado de updateOrderStatus) ── */
export async function updateEstado(pedido: Pedido, nuevoEstado: string, toast: ToastFn, refresh: () => void) {
  if (!nuevoEstado) return
  const alerta = ['Entregado', 'Cancelado', 'En cocina', 'En camino'].includes(nuevoEstado) ? 'VISTO' : 'NUEVO'
  const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado, alerta }).eq('id', pedido.id)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  toast(`Estado actualizado: ${nuevoEstado}`, 'success')
  refresh()
  await notifyStatus(pedido.id, nuevoEstado, toast)
}

/* ── Validar pago (portado de validatePayment) ── */
export async function validarPago(pedido: Pedido, toast: ToastFn, refresh: () => void) {
  if (!confirm(`¿Confirmas que el pago de ${pedido.cliente || ''} por ${fmtMoney(pedido.total)} fue recibido y verificado?`)) return
  const { error } = await supabase.from('pedidos').update({ estado: 'En cocina', alerta: 'PAGO OK' }).eq('id', pedido.id)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  toast('Pago validado — pedido en cocina', 'success')
  playSound('validar')
  refresh()
  await notifyStatus(pedido.id, 'En cocina', toast)
}

/* ── Detalle de pedido ── */
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink3">{label}</div>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  )
}

export function OrderDetailModal({ pedido, onClose, onChanged }: {
  pedido: Pedido | null; onClose: () => void; onChanged: () => void
}) {
  return pedido ? <OrderDetailInner pedido={pedido} onClose={onClose} onChanged={onChanged} /> : null
}

function OrderDetailInner({ pedido: o, onClose, onChanged }: { pedido: Pedido; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const el = elapsedFrom(o.created_at)
  const items = (o.items || '').split(',').map(s => s.trim()).filter(Boolean)

  return (
    <Modal open onClose={onClose} title={`Pedido ${o.num_pedido || ''}`} wide
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          {o.inbox_url && (
            <a href={o.inbox_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <IconChat style={{ width: 16, height: 16 }} /> Abrir chat
            </a>
          )}
        </>
      }>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusChip estado={o.estado} alerta={o.alerta} />
        <OrderBadges pedido={o} />
        <span className="ml-auto text-xs text-ink3">Hace {el.label}</span>
      </div>

      {esPickup(o) && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-semibold text-teal"
          style={{ borderColor: 'var(--teal)', background: 'var(--teal-soft)' }}>
          <IconBag style={{ width: 16, height: 16, flexShrink: 0 }} /> Pedido para recoger en el punto
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
        <Field label="Cliente">{o.cliente || '—'}</Field>
        <Field label="Teléfono">{o.telefono || '—'}</Field>
        <Field label="Cédula">{o.cedula || '—'}</Field>
        <Field label="Método de pago"><span className="chip chip-gray">{o.metodo_pago || 'Efectivo'}</span></Field>
        <Field label="Dirección" full>{o.direccion || '—'}</Field>
        {o.ubicacion && (
          <Field label="Ubicación" full>
            <a href={o.ubicacion} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-blue underline break-all">
              <IconMapPin style={{ width: 14, height: 14, flexShrink: 0 }} /> Ver ubicación (Google Maps)
            </a>
          </Field>
        )}
        {o.referencia && <Field label="Referencia" full>{o.referencia}</Field>}
        <Field label="Items" full>
          {items.length ? (
            <div>
              {items.map((it, i) => (
                <div key={i} className="border-b py-1 last:border-b-0" style={{ borderColor: 'var(--border)' }}>{it}</div>
              ))}
            </div>
          ) : '—'}
        </Field>
      </div>

      <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
        <div className="flex justify-between py-0.5"><span className="text-ink2">Subtotal</span><span>{fmtMoney(o.subtotal)}</span></div>
        <div className="flex justify-between py-0.5"><span className="text-ink2">Domicilio</span><span>{fmtMoney(o.costo_domicilio)}</span></div>
        <div className="mt-1 flex justify-between border-t pt-2 font-bold" style={{ borderColor: 'var(--border)' }}>
          <span>Total</span><span className="disp text-lg text-brand">{fmtMoney(o.total)}</span>
        </div>
      </div>

      {o.notas && (
        <div className="mt-3 rounded-lg border border-dashed px-3 py-2.5 text-[12.5px] leading-relaxed text-ink2"
          style={{ borderColor: 'var(--border)' }}>
          {o.notas}
        </div>
      )}

      {o.url_comprobante && (
        <div className="mt-4">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink3">Comprobante de pago</div>
          {(o.valor_comprobante || o.cuenta_destino) && (
            <div className="mt-1 text-xs text-ink2">
              Valor: <strong className="text-ink">{o.valor_comprobante ? fmtMoney(o.valor_comprobante) : '—'}</strong>
              {' · '}Cuenta: {o.cuenta_destino || '—'}
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.url_comprobante} alt="Comprobante de pago"
            className="mt-2 max-h-[45vh] w-auto max-w-full rounded-lg border" style={{ borderColor: 'var(--border)' }} />
          {o.alerta !== 'PAGO OK' && (
            <button className="btn btn-primary mt-3"
              onClick={() => validarPago(o, toast, () => { onChanged(); onClose() })}>
              Validar pago
            </button>
          )}
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-ink3">Cambiar estado</div>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.filter(s => s !== o.estado).map(s => (
            <button key={s} className="btn btn-secondary btn-sm"
              onClick={() => updateEstado(o, s, toast, () => { onChanged(); onClose() })}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
