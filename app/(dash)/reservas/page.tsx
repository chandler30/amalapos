'use client'
import { fmtHora12 } from '@/lib/format'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede } from '@/lib/sede'
import type { Reserva } from '@/lib/constants'
import { useToast, Spinner, EmptyState, PageHeader } from '@/components/ui'

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

/* Color del chip según estado (case-insensitive) */
const RES_CHIP: Record<string, string> = {
  NUEVA: 'chip-yellow',
  CONFIRMADA: 'chip-green',
  CANCELADA: 'chip-red',
  COMPLETADA: 'chip-gray',
}
function chipReserva(estado: string): string {
  return RES_CHIP[(estado || '').toUpperCase()] || 'chip-gray'
}

export default function ReservasPage() {
  const toast = useToast()
  const { sedeId } = useSede()
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [soloNuevas, setSoloNuevas] = useState(true)

  const fetchReservas = useCallback(async () => {
    if (!sedeId) return
    const { data, error } = await supabase.from('reservas').select('*').eq('sede_id', sedeId)
      .order('created_at', { ascending: false }).limit(200)
    if (!error && data) setReservas(data as Reserva[])
    setLoading(false)
  }, [sedeId])

  useEffect(() => {
    if (!sedeId) return
    setLoading(true)
    fetchReservas()
  }, [fetchReservas, sedeId])

  /* Portado de updateReservaStatus / confirmReserva / cancelReserva */
  async function actualizar(r: Reserva, estado: string) {
    const { error } = await supabase.from('reservas').update({ estado }).eq('id', r.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast(`Reserva ${estado.toLowerCase()}`, 'success')
    fetchReservas()
  }
  function confirmar(r: Reserva) { actualizar(r, 'CONFIRMADA') }
  function cancelar(r: Reserva) {
    if (!confirm('¿Cancelar esta reserva?')) return
    actualizar(r, 'Cancelada')
  }

  const nuevas = reservas.filter(r => (r.estado || '').toUpperCase() === 'NUEVA')
  const lista = soloNuevas ? nuevas : reservas

  return (
    <div>
      <PageHeader title="Reservas" sub="Gestión de reservas">
        {nuevas.length > 0 && <span className="chip chip-yellow">{nuevas.length} nuevas</span>}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <Pill active={soloNuevas} onClick={() => setSoloNuevas(true)}>Nuevas</Pill>
        <Pill active={!soloNuevas} onClick={() => setSoloNuevas(false)}>Todas</Pill>
      </div>

      {loading ? (
        <Spinner />
      ) : lista.length === 0 ? (
        <div className="card"><EmptyState text={soloNuevas ? 'Sin reservas nuevas' : 'Sin reservas'} /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[860px]">
            <thead>
              <tr>
                <th>#Reserva</th><th>Cliente</th><th>Teléfono</th><th>Fecha</th>
                <th className="text-center">Personas</th><th>Tipo</th><th>Notas</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(r => {
                const est = (r.estado || '').toUpperCase()
                const hora = fmtHora12(r.hora_reserva)
                const notas = [r.motivo, r.notas].filter(Boolean).join(' — ')
                return (
                  <tr key={r.id}>
                    <td className="disp whitespace-nowrap text-brand">{r.num_reserva || '—'}</td>
                    <td className="font-bold text-ink">{r.cliente || '—'}</td>
                    <td className="whitespace-nowrap text-[12px]">{r.telefono || '—'}</td>
                    <td className="whitespace-nowrap text-[12px]">{r.fecha_reserva || '—'} {hora}</td>
                    <td className="text-center">{r.personas || 1}</td>
                    <td className="whitespace-nowrap text-[12.5px]">{r.tipo || '—'}</td>
                    <td><div className="max-w-[200px] truncate text-[12px] text-ink3" title={notas}>{notas || '—'}</div></td>
                    <td><span className={`chip ${chipReserva(r.estado)}`}>{r.estado || '—'}</span></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {est === 'NUEVA' && (
                          <button className="btn btn-secondary btn-sm whitespace-nowrap" onClick={() => confirmar(r)}>Confirmar</button>
                        )}
                        {est !== 'CANCELADA' && est !== 'COMPLETADA' && (
                          <button className="btn btn-danger btn-sm whitespace-nowrap" onClick={() => cancelar(r)}>Cancelar</button>
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
    </div>
  )
}
