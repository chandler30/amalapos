'use client'
import { fmtHora12 } from '@/lib/format'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede } from '@/lib/sede'
import type { Promo } from '@/lib/constants'
import { Modal, PageHeader, Spinner, EmptyState, Switch, useToast } from '@/components/ui'
import { IconPencil, IconPlus, IconX } from '@/components/icons'

const DIA_LETRA: Record<string, string> = { '1': 'L', '2': 'M', '3': 'X', '4': 'J', '5': 'V', '6': 'S', '0': 'D' }
const DIAS_OPTS = [
  { v: '1', l: 'Lun' }, { v: '2', l: 'Mar' }, { v: '3', l: 'Mié' }, { v: '4', l: 'Jue' },
  { v: '5', l: 'Vie' }, { v: '6', l: 'Sáb' }, { v: '0', l: 'Dom' },
]

function promoHorarioTexto(p: Promo): string {
  const dias = (p.dias || '').split(',').map(s => s.trim()).filter(Boolean)
  let d = dias.length ? dias.map(x => DIA_LETRA[x] || x).join('·') : 'Todos los días'
  if (p.activa_festivos) d += ' +festivos'
  let h = ''
  if (p.hora_inicio || p.hora_fin) h = ` · ${fmtHora12(p.hora_inicio || '00:00')}–${fmtHora12(p.hora_fin || '23:59')}`
  return d + h
}

type ItemRow = { nombre: string; precio: string }
type PromoForm = {
  codigo: string; nombre: string; descripcion: string; imagen_url: string
  dias: string[]; hora_inicio: string; hora_fin: string
  activa_festivos: boolean; activa: boolean; items: ItemRow[]
}
const FORM_VACIO: PromoForm = {
  codigo: '', nombre: '', descripcion: '', imagen_url: '',
  dias: [], hora_inicio: '', hora_fin: '', activa_festivos: false, activa: true, items: [],
}

export default function PromosPage() {
  const toast = useToast()
  const { sedeId } = useSede()
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PromoForm>(FORM_VACIO)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!sedeId) return
    const { data, error } = await supabase.from('promociones').select('*').eq('sede_id', sedeId).order('created_at')
    if (error) { toast('Error cargando promociones: ' + error.message, 'error') }
    setPromos((data as Promo[]) || [])
    setLoading(false)
  }, [toast, sedeId])

  useEffect(() => {
    if (!sedeId) return
    setLoading(true)
    load()
  }, [load, sedeId])

  const set = <K extends keyof PromoForm>(k: K, v: PromoForm[K]) => setForm(f => ({ ...f, [k]: v }))

  function abrirNueva() {
    setEditId(null)
    setForm(FORM_VACIO)
    setOpen(true)
  }

  function abrirEditar(p: Promo) {
    setEditId(p.id)
    setForm({
      codigo: p.codigo || '', nombre: p.nombre || '', descripcion: p.descripcion || '',
      imagen_url: p.imagen_url || '',
      dias: (p.dias || '').split(',').map(s => s.trim()).filter(Boolean),
      hora_inicio: (p.hora_inicio || '').slice(0, 5), hora_fin: (p.hora_fin || '').slice(0, 5),
      activa_festivos: !!p.activa_festivos, activa: !!p.activa,
      items: (p.items || []).map(it => ({ nombre: it.nombre || '', precio: String(it.precio ?? '') })),
    })
    setOpen(true)
  }

  function toggleDia(v: string) {
    setForm(f => ({ ...f, dias: f.dias.includes(v) ? f.dias.filter(d => d !== v) : [...f.dias, v] }))
  }

  function setItem(i: number, campo: 'nombre' | 'precio', valor: string) {
    setForm(f => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)) }))
  }

  async function guardar() {
    const codigo = form.codigo.trim(), nombre = form.nombre.trim()
    if (!codigo || !nombre) { toast('Código y nombre son requeridos', 'error'); return }
    if (!sedeId) { toast('Selecciona una sede primero', 'error'); return }
    setSaving(true)
    const promoData = {
      codigo, nombre,
      descripcion: form.descripcion.trim(),
      imagen_url: form.imagen_url.trim() || null,
      dias: form.dias.length ? form.dias.join(',') : null,
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      activa_festivos: form.activa_festivos,
      activa: form.activa,
      items: form.items
        .map(it => ({ nombre: it.nombre.trim(), precio: parseInt(it.precio) || 0 }))
        .filter(it => it.nombre),
    }
    const res = editId
      ? await supabase.from('promociones').update(promoData).eq('id', editId)
      : await supabase.from('promociones').insert({ ...promoData, sede_id: sedeId })
    setSaving(false)
    if (res.error) { toast('Error: ' + res.error.message, 'error'); return }
    setOpen(false)
    toast(editId ? 'Promoción actualizada' : 'Promoción creada', 'success')
    load()
  }

  async function toggleActiva(p: Promo) {
    const { error } = await supabase.from('promociones').update({ activa: !p.activa }).eq('id', p.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    load()
  }

  async function borrar() {
    if (!editId) return
    if (!confirm(`¿Eliminar la promoción "${form.nombre}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('promociones').delete().eq('id', editId)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setOpen(false)
    toast('Promoción eliminada', 'success')
    load()
  }

  return (
    <div>
      <PageHeader title="Promociones" sub="Días, horarios y festivos configurables">
        <button className="btn btn-primary" onClick={abrirNueva}><IconPlus width={16} height={16} /> Nueva promo</button>
      </PageHeader>

      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : promos.length === 0 ? <EmptyState text="Sin promociones" /> : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Promo</th>
                <th>Programación</th>
                <th>Activa</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {promos.map(p => (
                <tr key={p.id}>
                  <td className="font-semibold">
                    <div className="flex items-center gap-2.5">
                      {p.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagen_url} alt={p.nombre} className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-bg2 text-[10px] text-ink3">IMG</div>
                      )}
                      <div>
                        <div className="text-ink">{p.nombre || '—'}</div>
                        <div className="font-mono text-[11px] text-ink3">{p.codigo || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-xs text-ink2 whitespace-nowrap">{promoHorarioTexto(p)}</td>
                  <td><span className={`chip ${p.activa ? 'chip-green' : 'chip-red'}`}>{p.activa ? 'SÍ' : 'NO'}</span></td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <button className="btn btn-secondary btn-sm" title="Editar" onClick={() => abrirEditar(p)}>
                        <IconPencil width={14} height={14} />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleActiva(p)}>
                        {p.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Editar promoción' : 'Nueva promoción'}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <div>{editId && <button className="btn btn-danger" onClick={borrar}>Borrar</button>}</div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        }>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div>
              <label className="lbl">Código</label>
              <input className="input w-full" value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="PROMO_SAB" />
            </div>
            <div>
              <label className="lbl">Nombre</label>
              <input className="input w-full" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Especial Sábados" />
            </div>
          </div>
          <div>
            <label className="lbl">Descripción (sin precios)</label>
            <textarea className="input w-full" rows={2} value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Tagline corto, ej: Almuerzos de lunes a viernes" />
          </div>
          <div>
            <label className="lbl">Imagen (URL)</label>
            <input className="input w-full" value={form.imagen_url} onChange={e => set('imagen_url', e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="lbl">Productos de la promo (nombre + precio)</label>
            <div className="grid gap-1.5">
              {form.items.map((it, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className="input min-w-0 flex-1" style={{ width: 'auto' }} value={it.nombre} onChange={e => setItem(i, 'nombre', e.target.value)} placeholder="Nombre del producto" />
                  <input className="input" style={{ width: 110, flex: '0 0 110px' }} type="number" value={it.precio} onChange={e => setItem(i, 'precio', e.target.value)} placeholder="Precio" />
                  <button type="button" className="btn btn-secondary btn-sm" title="Quitar"
                    onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}>
                    <IconX width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm mt-1.5"
              onClick={() => setForm(f => ({ ...f, items: [...f.items, { nombre: '', precio: '' }] }))}>
              <IconPlus width={14} height={14} /> Agregar producto
            </button>
            <div className="mt-1 text-[11px] text-ink3">La IA usa estos precios cuando el pedido sale de la promo.</div>
          </div>
          <div>
            <label className="lbl">Días activos (vacío = todos los días)</label>
            <div className="flex flex-wrap gap-3">
              {DIAS_OPTS.map(d => (
                <label key={d.v} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink2">
                  <input type="checkbox" checked={form.dias.includes(d.v)} onChange={() => toggleDia(d.v)} /> {d.l}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div>
              <label className="lbl">Activa desde</label>
              <input className="input w-full" type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} />
            </div>
            <div>
              <label className="lbl">Activa hasta</label>
              <input className="input w-full" type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink2">Activa también en festivos</span>
            <Switch checked={form.activa_festivos} onChange={v => set('activa_festivos', v)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink2">Promoción activa</span>
            <Switch checked={form.activa} onChange={v => set('activa', v)} />
          </div>
          <div className="text-[11px] text-ink3">Horas vacías = activa todo el día.</div>
        </div>
      </Modal>
    </div>
  )
}
