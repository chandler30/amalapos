'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede } from '@/lib/sede'
import { MENU_CATS, type MenuItem } from '@/lib/constants'
import { fmtMoney } from '@/lib/format'
import { EmptyState, Modal, PageHeader, Spinner, Switch, useToast } from '@/components/ui'
import { IconCheckCircle, IconClock, IconPencil, IconPlus, IconXCircle } from '@/components/icons'

function normStr(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function pastHora(hf: string | null): boolean {
  if (!hf) return false
  const d = new Date()
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const p = String(hf).split(':')
  return nowMin > (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0)
}

interface MenuForm {
  id: string; nombre: string; categoria: string; precio: string; tipo: string
  sabores: string; descripcion: string; modificaciones: string; hora_fin: string; activo: boolean
}
const FORM_VACIO: MenuForm = {
  id: '', nombre: '', categoria: MENU_CATS[0], precio: '', tipo: '',
  sabores: '', descripcion: '', modificaciones: '', hora_fin: '', activo: true,
}

export default function MenuPage() {
  const toast = useToast()
  const { sedeId } = useSede()
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<MenuForm>(FORM_VACIO)
  const [saving, setSaving] = useState(false)

  const fetchMenu = useCallback(async () => {
    if (!sedeId) return
    const { data, error } = await supabase.from('menu').select('*').eq('sede_id', sedeId).order('categoria').order('nombre')
    if (error) toast('Error cargando el menú: ' + error.message, 'error')
    else setItems((data as MenuItem[]) || [])
    setLoading(false)
  }, [toast, sedeId])

  useEffect(() => {
    if (!sedeId) return
    setLoading(true)
    fetchMenu()
  }, [fetchMenu, sedeId])

  const grupos = useMemo(() => {
    const q = normStr(busqueda)
    let filtrados = items
    if (q) filtrados = items.filter(m => normStr(`${m.nombre || ''} ${m.categoria || ''} ${m.descripcion || ''}`).includes(q))
    const g: Record<string, MenuItem[]> = {}
    filtrados.forEach(m => { (g[m.categoria] = g[m.categoria] || []).push(m) })
    const cats = MENU_CATS.filter(c => g[c]).concat(Object.keys(g).filter(c => !MENU_CATS.includes(c)))
    return cats.map(cat => ({
      cat,
      rows: [...g[cat]].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    }))
  }, [items, busqueda])

  async function toggleItem(m: MenuItem) {
    const nuevo = m.activo === false
    const { error } = await supabase.from('menu').update({ activo: nuevo }).eq('id', m.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast(nuevo ? 'Producto activado' : 'Producto marcado como agotado', 'success')
    await fetchMenu()
  }

  function abrirAgregar() {
    setForm(FORM_VACIO)
    setModalOpen(true)
  }

  function abrirEditar(m: MenuItem) {
    setForm({
      id: m.id,
      nombre: m.nombre || '',
      categoria: m.categoria || MENU_CATS[0],
      precio: m.precio != null ? String(m.precio) : '',
      tipo: m.tipo || '',
      sabores: m.sabores || '',
      descripcion: m.descripcion || '',
      modificaciones: m.modificaciones || '',
      hora_fin: (m.hora_fin || '').slice(0, 5),
      activo: m.activo !== false,
    })
    setModalOpen(true)
  }

  async function guardar() {
    const row = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      precio: parseInt(form.precio) || 0,
      tipo: form.tipo.trim() || null,
      sabores: form.sabores.trim() || null,
      descripcion: form.descripcion.trim() || null,
      modificaciones: form.modificaciones.trim() || null,
      hora_fin: form.hora_fin || null,
      activo: form.activo,
    }
    if (!row.nombre) { toast('Falta el nombre', 'error'); return }
    if (!sedeId) { toast('Selecciona una sede primero', 'error'); return }
    setSaving(true)
    const { error } = form.id
      ? await supabase.from('menu').update(row).eq('id', form.id)
      : await supabase.from('menu').insert({ ...row, sede_id: sedeId })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setModalOpen(false)
    toast(form.id ? 'Producto actualizado' : 'Producto agregado', 'success')
    await fetchMenu()
  }

  async function borrar() {
    if (!form.id) return
    if (!confirm(`¿Eliminar "${form.nombre}" del menú?`)) return
    const { error } = await supabase.from('menu').delete().eq('id', form.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setModalOpen(false)
    toast('Producto eliminado', 'success')
    await fetchMenu()
  }

  const set = (k: keyof MenuForm) => (v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <PageHeader title="Menú" sub="Productos y disponibilidad">
        <button className="btn btn-primary" onClick={abrirAgregar}>
          <IconPlus width={16} height={16} /> Agregar producto
        </button>
      </PageHeader>

      <input
        className="input mb-4 w-full"
        type="text"
        placeholder="Buscar producto, categoría o descripción…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />

      {loading ? <Spinner /> : grupos.length === 0 ? (
        <EmptyState text="Sin productos." />
      ) : (
        grupos.map(({ cat, rows }) => (
          <div key={cat}>
            <div className="disp mt-5 mb-2 text-[15px] uppercase tracking-wide text-ink2">
              {cat} <span className="text-xs font-normal text-ink3">({rows.length})</span>
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
              {rows.map(m => {
                const fueraHora = pastHora(m.hora_fin)
                const agotado = m.activo === false
                return (
                  <div key={m.id} className="card px-3.5 py-3" style={agotado || fueraHora ? { opacity: 0.5 } : undefined}>
                    <div className="text-[13px] font-semibold leading-tight text-ink">
                      {m.nombre}
                      {agotado
                        ? <span className="ml-1 text-[10px] font-semibold text-danger">(agotado)</span>
                        : fueraHora
                          ? <span className="ml-1 text-[10px] font-semibold text-yellow">(fuera de hora)</span>
                          : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[15px] font-bold text-brand">{m.precio != null ? fmtMoney(m.precio) : '—'}</span>
                      <div className="flex gap-1.5">
                        {agotado ? (
                          <button className="btn btn-secondary btn-sm !p-1.5" style={{ color: 'var(--green)' }}
                            onClick={() => toggleItem(m)} title="Activar producto">
                            <IconCheckCircle width={17} height={17} />
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-sm !p-1.5" style={{ color: 'var(--red)' }}
                            onClick={() => toggleItem(m)} title="Marcar como agotado">
                            <IconXCircle width={17} height={17} />
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm !p-1.5" onClick={() => abrirEditar(m)} title="Editar">
                          <IconPencil width={16} height={16} />
                        </button>
                      </div>
                    </div>
                    {m.sabores && <div className="mt-1.5 text-[11px] text-ink3">Sabores: {m.sabores}</div>}
                    {m.hora_fin && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-yellow">
                        <IconClock width={12} height={12} /> Disponible hasta {String(m.hora_fin).slice(0, 5)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Editar producto' : 'Agregar producto'}
        footer={
          <>
            {form.id && (
              <button className="btn btn-danger mr-auto" onClick={borrar}>Borrar</button>
            )}
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="mb-3">
          <label className="lbl" htmlFor="am-nombre">Nombre</label>
          <input id="am-nombre" className="input w-full" type="text" placeholder="Pizza Amala"
            value={form.nombre} onChange={e => set('nombre')(e.target.value)} />
        </div>
        <div className="mb-3 flex gap-2.5 max-sm:flex-col">
          <div className="flex-1">
            <label className="lbl" htmlFor="am-categoria">Categoría</label>
            <select id="am-categoria" className="input w-full" value={form.categoria}
              onChange={e => set('categoria')(e.target.value)}>
              {MENU_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="w-[140px] max-sm:w-full">
            <label className="lbl" htmlFor="am-precio">Precio ($)</label>
            <input id="am-precio" className="input w-full" type="number" placeholder="36900"
              value={form.precio} onChange={e => set('precio')(e.target.value)} />
          </div>
        </div>
        <div className="mb-3 flex gap-2.5 max-sm:flex-col">
          <div className="flex-1">
            <label className="lbl" htmlFor="am-tipo">Tipo</label>
            <input id="am-tipo" className="input w-full" type="text" placeholder="Personal / Compartir"
              value={form.tipo} onChange={e => set('tipo')(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="lbl" htmlFor="am-sabores">Sabores (separa con coma)</label>
            <input id="am-sabores" className="input w-full" type="text" placeholder="Pepsi, Uva, Manzana"
              value={form.sabores} onChange={e => set('sabores')(e.target.value)} />
          </div>
        </div>
        <div className="mb-3">
          <label className="lbl" htmlFor="am-desc">Descripción</label>
          <input id="am-desc" className="input w-full" type="text" placeholder="Mozzarella, pepperoni y jalapeños"
            value={form.descripcion} onChange={e => set('descripcion')(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="lbl" htmlFor="am-mod">Modificaciones permitidas</label>
          <input id="am-mod" className="input w-full" type="text" placeholder="cambio de acompañamientos…"
            value={form.modificaciones} onChange={e => set('modificaciones')(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="lbl" htmlFor="am-horafin">Disponible hasta (hora límite, opcional)</label>
          <input id="am-horafin" className="input w-[160px]" type="time"
            value={form.hora_fin} onChange={e => set('hora_fin')(e.target.value)} />
          <div className="mt-1 text-[11px] text-ink3">
            Pasada esta hora, el bot lo marca como no disponible automáticamente. Vacío = sin límite.
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Switch id="am-activo" checked={form.activo} onChange={v => set('activo')(v)} />
          <label className="cursor-pointer text-sm text-ink2" htmlFor="am-activo"
            onClick={() => set('activo')(!form.activo)}>
            Activo (visible para el bot)
          </label>
        </div>
      </Modal>
    </div>
  )
}
