'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede } from '@/lib/sede'
import { PageHeader, Spinner, EmptyState, Switch, useToast } from '@/components/ui'

type Conversacion = {
  id: string
  user_ns: string
  cliente: string | null
  telefono: string | null
  estado: 'abierta' | 'pedido_realizado' | 'nudge_enviado' | 'cerrada'
  iniciada_at: string
  ultima_actividad_at: string
  num_pedido: string | null
  nudge_count: number
  nudge_at: string | null
  nudge_desactivado: boolean
}

const ESTADO_UI: Record<Conversacion['estado'], { label: string; chip: string }> = {
  abierta: { label: 'En conversación', chip: 'chip-blue' },
  pedido_realizado: { label: 'Pidió ✓', chip: 'chip-green' },
  nudge_enviado: { label: 'Reenganchado', chip: 'chip-yellow' },
  cerrada: { label: 'Se fue sin pedir', chip: 'chip-gray' },
}

function fmtFechaHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' }) +
    ' · ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })
}

function haceMin(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

export default function SeguimientoPage() {
  const toast = useToast()
  const { sedeId } = useSede()
  const [convs, setConvs] = useState<Conversacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | Conversacion['estado']>('todas')

  const cargar = useCallback(async () => {
    if (!sedeId) return
    const desde = new Date(Date.now() - 7 * 24 * 3600e3).toISOString()
    const { data, error } = await supabase.from('conversaciones').select('*')
      .eq('sede_id', sedeId).gte('iniciada_at', desde)
      .order('iniciada_at', { ascending: false }).limit(300)
    if (!error && data) setConvs(data as Conversacion[])
    setLoading(false)
  }, [sedeId])

  useEffect(() => {
    setLoading(true)
    cargar()
    const t = setInterval(cargar, 30000)
    return () => clearInterval(t)
  }, [cargar])

  async function toggleNudge(c: Conversacion, permitir: boolean) {
    setConvs(prev => prev.map(x => x.id === c.id ? { ...x, nudge_desactivado: !permitir } : x))
    const { error } = await supabase.from('conversaciones')
      .update({ nudge_desactivado: !permitir }).eq('id', c.id)
    if (error) {
      setConvs(prev => prev.map(x => x.id === c.id ? { ...x, nudge_desactivado: c.nudge_desactivado } : x))
      toast('Error al guardar: ' + error.message, 'error')
      return
    }
    toast(permitir ? 'Seguimiento activado para este cliente' : 'Seguimiento desactivado para este cliente', 'success')
  }

  const filtradas = convs.filter(c => filtro === 'todas' || c.estado === filtro)
  const hoy = convs.filter(c => new Date(c.iniciada_at).toDateString() === new Date().toDateString())
  const pidieron = hoy.filter(c => c.estado === 'pedido_realizado').length

  return (
    <div>
      <PageHeader title="Seguimiento" sub={`Hoy: ${hoy.length} conversaciones · ${pidieron} pidieron`}>
        <select className="input !w-auto" value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)}>
          <option value="todas">Todas (7 días)</option>
          <option value="abierta">En conversación</option>
          <option value="pedido_realizado">Pidieron</option>
          <option value="nudge_enviado">Reenganchados</option>
          <option value="cerrada">Se fueron sin pedir</option>
        </select>
      </PageHeader>

      <p className="mb-4 text-xs leading-relaxed text-ink3">
        Cada fila es una conversación (desde que el cliente saluda). Si a los 10 minutos no ha pedido, el sistema
        despierta a Amalita para reengancharlo; si su pedido queda esperando comprobante, se le recuerda a los 15 minutos.
        Apaga el switch de un cliente para que NO se le envíe ningún seguimiento en esa conversación.
      </p>

      {loading ? (
        <Spinner />
      ) : filtradas.length === 0 ? (
        <div className="card"><EmptyState text="Sin conversaciones registradas todavía. Aparecen cuando un cliente saluda a Amalita." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[860px]">
            <thead>
              <tr>
                <th>Cliente</th><th>Estado</th><th>Saludó</th><th>Última actividad</th>
                <th>Pedido</th><th>Reenganche</th><th className="text-center">Seguimiento</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => {
                const ui = ESTADO_UI[c.estado] || ESTADO_UI.cerrada
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="font-bold text-ink">{c.cliente || 'Sin nombre'}</div>
                      <div className="text-[11px] text-ink3">{c.telefono || c.user_ns}</div>
                    </td>
                    <td><span className={`chip ${ui.chip}`}>{ui.label}</span></td>
                    <td className="whitespace-nowrap text-[12px]">
                      {fmtFechaHora(c.iniciada_at)}
                      <div className="text-[11px] text-ink3">{haceMin(c.iniciada_at)}</div>
                    </td>
                    <td className="whitespace-nowrap text-[12px]">{haceMin(c.ultima_actividad_at)}</td>
                    <td className="whitespace-nowrap text-[12px]">{c.num_pedido || '—'}</td>
                    <td className="whitespace-nowrap text-[12px]">
                      {c.nudge_count > 0 && c.nudge_at ? `Enviado ${haceMin(c.nudge_at)}` : '—'}
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-2">
                        <Switch checked={!c.nudge_desactivado} onChange={v => toggleNudge(c, v)} />
                        {c.nudge_desactivado && <span className="chip chip-red">Apagado</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
