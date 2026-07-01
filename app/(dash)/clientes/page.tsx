'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/lib/constants'
import { fmtMoney } from '@/lib/format'
import { Spinner, EmptyState, PageHeader } from '@/components/ui'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    async function fetchClientes() {
      const { data, error } = await supabase.from('clientes').select('*')
        .order('gasto_total', { ascending: false }).limit(500)
      if (!error && data) setClientes(data as Cliente[])
      setLoading(false)
    }
    fetchClientes()
  }, [])

  const ql = q.trim().toLowerCase()
  const filtrados = clientes.filter(c => !ql || (
    (c.nombre || '').toLowerCase().includes(ql) ||
    (c.telefono || '').includes(ql) ||
    (c.cedula || '').includes(ql)
  ))

  return (
    <div>
      <PageHeader title="Clientes" sub={`${clientes.length} registrados`}>
        <input className="input w-64 max-sm:w-full" type="text" placeholder="Buscar nombre, teléfono o cédula…"
          value={q} onChange={e => setQ(e.target.value)} />
      </PageHeader>

      {loading ? (
        <Spinner />
      ) : filtrados.length === 0 ? (
        <div className="card"><EmptyState text="Sin clientes" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[720px]">
            <thead>
              <tr>
                <th>Nombre</th><th>Cédula</th><th>Teléfono</th><th>Canal</th>
                <th className="text-center">Pedidos</th><th>Gasto total</th><th>Última visita</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id}>
                  <td className="font-bold text-ink">{c.nombre || '—'}</td>
                  <td className="whitespace-nowrap text-[12px]">{c.cedula || '—'}</td>
                  <td className="whitespace-nowrap text-[12px]">{c.telefono || '—'}</td>
                  <td><span className="chip chip-gray">{c.canal || '—'}</span></td>
                  <td className="text-center">{c.total_pedidos || 0}</td>
                  <td className="disp whitespace-nowrap text-green">{fmtMoney(c.gasto_total)}</td>
                  <td className="whitespace-nowrap text-[11.5px] text-ink3">
                    {c.ultima_visita ? new Date(c.ultima_visita).toLocaleDateString('es-CO') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
