'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Alerta } from '@/lib/constants'
import { useToast, Spinner, EmptyState, PageHeader } from '@/components/ui'
import { IconChat } from '@/components/icons'

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

export default function AlertasPage() {
  const toast = useToast()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [soloPendientes, setSoloPendientes] = useState(true)

  const fetchAlertas = useCallback(async () => {
    const { data, error } = await supabase.from('alertas').select('*')
      .order('created_at', { ascending: false }).limit(200)
    if (!error && data) setAlertas(data as Alerta[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAlertas() }, [fetchAlertas])

  /* Portado de attendAlert */
  async function atender(a: Alerta) {
    const { error } = await supabase.from('alertas').update({ estado: 'ATENDIDA' }).eq('id', a.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Alerta marcada como atendida', 'success')
    fetchAlertas()
  }

  const pendientes = alertas.filter(a => a.estado === 'PENDIENTE')
  const lista = soloPendientes ? pendientes : alertas

  return (
    <div>
      <PageHeader title="Alertas" sub="Clientes que requieren atención">
        {pendientes.length > 0 && <span className="chip chip-red">{pendientes.length} pendientes</span>}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <Pill active={soloPendientes} onClick={() => setSoloPendientes(true)}>Pendientes</Pill>
        <Pill active={!soloPendientes} onClick={() => setSoloPendientes(false)}>Todas</Pill>
      </div>

      {loading ? (
        <Spinner />
      ) : lista.length === 0 ? (
        <div className="card"><EmptyState text={soloPendientes ? 'Sin alertas pendientes' : 'Sin alertas'} /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[720px]">
            <thead>
              <tr>
                <th>Cliente</th><th>Teléfono</th><th>Razón</th><th>Estado</th><th>Fecha</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(a => {
                const pendiente = a.estado === 'PENDIENTE'
                return (
                  <tr key={a.id}>
                    <td className="font-bold text-ink">{a.cliente || '—'}</td>
                    <td className="whitespace-nowrap text-[12px]">{a.telefono || '—'}</td>
                    <td><div className="max-w-[280px] text-[12.5px]" title={a.razon || ''}>{a.razon || '—'}</div></td>
                    <td><span className={`chip ${pendiente ? 'chip-red' : 'chip-green'}`}>{a.estado}</span></td>
                    <td className="whitespace-nowrap text-[11.5px] text-ink3">
                      {a.created_at ? new Date(a.created_at).toLocaleString('es-CO') : '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {pendiente && (
                          <button className="btn btn-secondary btn-sm whitespace-nowrap" onClick={() => atender(a)}>Atendido</button>
                        )}
                        {a.chat_link && (
                          <a href={a.chat_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm whitespace-nowrap" title="Abrir chat">
                            <IconChat style={{ width: 14, height: 14 }} /> Chat
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
    </div>
  )
}
