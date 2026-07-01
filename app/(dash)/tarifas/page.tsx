'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede } from '@/lib/sede'
import type { Tarifa } from '@/lib/constants'
import { fmtMoney } from '@/lib/format'
import { EmptyState, Modal, PageHeader, Spinner, useToast } from '@/components/ui'
import { IconPencil, IconPlus, IconTrash } from '@/components/icons'

function normStr(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

interface TarifaForm { id: string; barrio: string; precio: string; zona: string }
const FORM_VACIO: TarifaForm = { id: '', barrio: '', precio: '', zona: '' }

export default function TarifasPage() {
  const toast = useToast()
  const { sedeId } = useSede()
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TarifaForm>(FORM_VACIO)
  const [saving, setSaving] = useState(false)

  const fetchTarifas = useCallback(async () => {
    if (!sedeId) return
    const { data, error } = await supabase.from('tarifas_barrios').select('*').eq('sede_id', sedeId).order('barrio')
    if (error) toast('Error cargando tarifas: ' + error.message, 'error')
    else setTarifas((data as Tarifa[]) || [])
    setLoading(false)
  }, [toast, sedeId])

  useEffect(() => {
    if (!sedeId) return
    setLoading(true)
    fetchTarifas()
  }, [fetchTarifas, sedeId])

  const filtradas = useMemo(() => {
    const q = normStr(busqueda)
    if (!q) return tarifas
    return tarifas.filter(t => normStr(`${t.barrio || ''} ${t.zona || ''}`).includes(q))
  }, [tarifas, busqueda])

  function abrirAgregar() {
    setForm(FORM_VACIO)
    setModalOpen(true)
  }

  function abrirEditar(t: Tarifa) {
    setForm({
      id: t.id,
      barrio: t.barrio || '',
      precio: t.precio != null ? String(t.precio) : '',
      zona: t.zona || '',
    })
    setModalOpen(true)
  }

  async function guardar() {
    const row = {
      barrio: form.barrio.trim().toUpperCase(),
      precio: parseInt(form.precio) || 0,
      zona: form.zona.trim() || null,
    }
    if (!row.barrio || !row.precio) { toast('Completa barrio y precio', 'error'); return }
    if (!sedeId) { toast('Selecciona una sede primero', 'error'); return }
    setSaving(true)
    const { error } = form.id
      ? await supabase.from('tarifas_barrios').update(row).eq('id', form.id)
      : await supabase.from('tarifas_barrios').insert({ ...row, sede_id: sedeId })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setModalOpen(false)
    toast(form.id ? 'Tarifa actualizada' : 'Barrio agregado', 'success')
    await fetchTarifas()
  }

  async function borrar(t: Tarifa) {
    if (!confirm(`¿Estás seguro de que deseas eliminar la tarifa de ${t.barrio}?`)) return
    const { error } = await supabase.from('tarifas_barrios').delete().eq('id', t.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Tarifa eliminada', 'success')
    if (modalOpen) setModalOpen(false)
    await fetchTarifas()
  }

  return (
    <div>
      <PageHeader title="Tarifas" sub="Costos de domicilio por barrio">
        <button className="btn btn-primary" onClick={abrirAgregar}>
          <IconPlus width={16} height={16} /> Agregar barrio
        </button>
      </PageHeader>

      <input
        className="input mb-4 w-full"
        type="text"
        placeholder="Buscar barrio o zona…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />

      {loading ? <Spinner /> : filtradas.length === 0 ? (
        <EmptyState text={busqueda ? 'Barrio no encontrado. Verifica el nombre con el cliente.' : 'Sin tarifas registradas.'} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[520px]">
            <thead>
              <tr>
                <th>Barrio</th>
                <th>Precio</th>
                <th>Zona / Nota</th>
                <th className="w-24 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(t => (
                <tr key={t.id}>
                  <td className="font-semibold text-ink">{t.barrio}</td>
                  <td className="font-bold text-brand">{fmtMoney(t.precio)}</td>
                  <td className="text-ink3">{t.zona || '—'}</td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <button className="btn btn-secondary btn-sm !p-1.5" onClick={() => abrirEditar(t)} title="Editar tarifa">
                        <IconPencil width={16} height={16} />
                      </button>
                      <button className="btn btn-danger btn-sm !p-1.5" onClick={() => borrar(t)} title="Eliminar tarifa">
                        <IconTrash width={16} height={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Editar tarifa' : 'Agregar barrio'}
        footer={
          <>
            {form.id && (
              <button className="btn btn-danger mr-auto"
                onClick={() => borrar({ id: form.id, barrio: form.barrio, precio: parseInt(form.precio) || 0, zona: form.zona || null })}>
                Borrar
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="mb-3">
          <label className="lbl" htmlFor="tf-barrio">Barrio</label>
          <input id="tf-barrio" className="input w-full" type="text" placeholder="CRESPO"
            value={form.barrio} onChange={e => setForm(f => ({ ...f, barrio: e.target.value }))} />
        </div>
        <div className="mb-3">
          <label className="lbl" htmlFor="tf-precio">Precio ($)</label>
          <input id="tf-precio" className="input w-full" type="number" placeholder="6000"
            value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
        </div>
        <div>
          <label className="lbl" htmlFor="tf-zona">Zona / Nota (opcional)</label>
          <input id="tf-zona" className="input w-full" type="text"
            placeholder="p. ej. Serena del Mar: confirmar recargo con el domiciliario"
            value={form.zona} onChange={e => setForm(f => ({ ...f, zona: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
