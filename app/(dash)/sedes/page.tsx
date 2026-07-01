'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede, type Sede } from '@/lib/sede'
import { EmptyState, Modal, PageHeader, Spinner, Switch, useToast } from '@/components/ui'
import { IconPencil, IconPlus } from '@/components/icons'

/* ── Helpers ── */
function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Contraseña aleatoria legible: sílabas pronunciables + dígitos (>= 10 chars)
function genPassword(): string {
  const cons = 'bcdfghjkmnprstvz'
  const voc = 'aeiou'
  const pick = (s: string) => s.charAt(Math.floor(Math.random() * s.length))
  let p = ''
  for (let i = 0; i < 4; i++) p += pick(cons) + pick(voc)
  return p.charAt(0).toUpperCase() + p.slice(1) + String(Math.floor(10 + Math.random() * 90))
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

/* ── Tipos ── */
interface SedeForm {
  id: string; nombre: string; slug: string; direccion: string
  whatsapp: string; horario: string; activa: boolean; copiarDe: string
}
const SEDE_VACIA: SedeForm = { id: '', nombre: '', slug: '', direccion: '', whatsapp: '', horario: '', activa: true, copiarDe: '' }

interface Usuario { id: string; email: string; nombre: string | null; rol: string; sede_id: string | null; created_at: string | null }
interface RawUser {
  user_id?: string; id?: string; email?: string; nombre?: string | null
  rol?: string; sede_id?: string | null; created_at?: string | null; fecha?: string | null
}

interface UserForm { nombre: string; email: string; password: string; sede_id: string; rol: 'sede' | 'admin' }
const USER_VACIO: UserForm = { nombre: '', email: '', password: '', sede_id: '', rol: 'sede' }

export default function SedesPage() {
  const toast = useToast()
  const { loading, sedes, rol, perfil, refreshSedes } = useSede()

  /* ── Estado: sedes ── */
  const [modalSede, setModalSede] = useState(false)
  const [form, setForm] = useState<SedeForm>(SEDE_VACIA)
  const [slugTocado, setSlugTocado] = useState(false)
  const [savingSede, setSavingSede] = useState(false)
  // Tras crear: aviso con el slug para el bot + resultado de la copia
  const [creada, setCreada] = useState<{ slug: string; msgCopia: string } | null>(null)

  /* ── Estado: usuarios ── */
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [modalUser, setModalUser] = useState(false)
  const [uForm, setUForm] = useState<UserForm>(USER_VACIO)
  const [savingUser, setSavingUser] = useState(false)
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null)
  const [resetUser, setResetUser] = useState<Usuario | null>(null)
  const [nuevaPass, setNuevaPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  const nombreSede = useMemo(() => {
    const m = new Map<string, string>()
    sedes.forEach(s => m.set(s.id, s.nombre))
    return m
  }, [sedes])

  const fetchUsuarios = useCallback(async () => {
    setLoadingUsers(true)
    const { data, error } = await supabase.functions.invoke('admin-api', { body: { action: 'list_users' } })
    if (error) { toast('Error cargando usuarios: ' + error.message, 'error'); setLoadingUsers(false); return }
    if (data?.status === 'error') { toast(String(data.mensaje || 'Error cargando usuarios'), 'error'); setLoadingUsers(false); return }
    const raw = (data?.usuarios ?? data?.users ?? data?.data ?? []) as RawUser[]
    setUsuarios(raw.map(u => ({
      id: String(u.user_id ?? u.id ?? ''),
      email: String(u.email ?? ''),
      nombre: u.nombre ?? null,
      rol: String(u.rol ?? 'sede'),
      sede_id: u.sede_id ?? null,
      created_at: u.created_at ?? u.fecha ?? null,
    })))
    setLoadingUsers(false)
  }, [toast])

  useEffect(() => {
    if (!loading && rol === 'admin') fetchUsuarios()
  }, [loading, rol, fetchUsuarios])

  async function copiar(txt: string) {
    try { await navigator.clipboard.writeText(txt); toast('Copiado al portapapeles', 'success') }
    catch { toast('No se pudo copiar', 'error') }
  }

  /* ── Sedes: acciones ── */
  function abrirNuevaSede() {
    setForm(SEDE_VACIA); setSlugTocado(false); setCreada(null); setModalSede(true)
  }
  function abrirEditarSede(s: Sede) {
    setForm({
      id: s.id, nombre: s.nombre, slug: s.slug, direccion: s.direccion || '',
      whatsapp: s.whatsapp || '', horario: s.horario || '', activa: s.activa, copiarDe: '',
    })
    setSlugTocado(true); setCreada(null); setModalSede(true)
  }

  async function guardarSede() {
    const nombre = form.nombre.trim()
    const slug = slugify(form.slug.trim() || nombre)
    if (!nombre || !slug) { toast('Completa nombre y slug', 'error'); return }
    const row = {
      nombre, slug,
      direccion: form.direccion.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      horario: form.horario.trim() || null,
      activa: form.activa,
    }
    setSavingSede(true)
    if (form.id) {
      const { error } = await supabase.from('sedes').update(row).eq('id', form.id)
      setSavingSede(false)
      if (error) { toast('Error: ' + error.message, 'error'); return }
      toast('Sede actualizada', 'success')
      setModalSede(false)
      await refreshSedes()
      return
    }
    const { data, error } = await supabase.from('sedes').insert(row).select().single()
    if (error || !data) {
      setSavingSede(false)
      toast('Error creando sede: ' + (error?.message || 'sin respuesta'), 'error')
      return
    }
    const nueva = data as Sede
    let msgCopia = ''
    if (form.copiarDe) {
      const { data: r, error: e2 } = await supabase.functions.invoke('admin-api', {
        body: { action: 'duplicar_sede', origen_id: form.copiarDe, destino_id: nueva.id },
      })
      if (e2) msgCopia = 'Error copiando menú y tarifas: ' + e2.message
      else msgCopia = String(r?.mensaje || (r?.status === 'ok' ? 'Menú y tarifas copiados' : 'No se pudo copiar el menú'))
    }
    setSavingSede(false)
    toast('Sede creada', 'success')
    setCreada({ slug: nueva.slug, msgCopia })
    await refreshSedes()
  }

  async function toggleActiva(s: Sede) {
    const { error } = await supabase.from('sedes').update({ activa: !s.activa }).eq('id', s.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast(s.activa ? `Sede ${s.nombre} desactivada` : `Sede ${s.nombre} activada`, 'success')
    await refreshSedes()
  }

  /* ── Usuarios: acciones ── */
  function abrirNuevoUsuario() {
    setUForm({ ...USER_VACIO, password: genPassword() })
    setCredenciales(null)
    setModalUser(true)
  }

  async function crearUsuario() {
    const nombre = uForm.nombre.trim()
    const email = uForm.email.trim().toLowerCase()
    if (!nombre || !email) { toast('Completa nombre y email', 'error'); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Email inválido', 'error'); return }
    if (uForm.password.length < 8) { toast('La contraseña debe tener mínimo 8 caracteres', 'error'); return }
    if (uForm.rol === 'sede' && !uForm.sede_id) { toast('Selecciona la sede del usuario', 'error'); return }
    setSavingUser(true)
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'create_user', email, password: uForm.password, nombre, sede_id: uForm.sede_id || null, rol: uForm.rol },
    })
    setSavingUser(false)
    if (error || data?.status !== 'ok') {
      toast('Error: ' + (error?.message || String(data?.mensaje || 'no se pudo crear el usuario')), 'error')
      return
    }
    toast(String(data?.mensaje || 'Usuario creado'), 'success')
    setCredenciales({ email, password: uForm.password })
    fetchUsuarios()
  }

  async function cambiarPassword() {
    if (!resetUser) return
    if (nuevaPass.length < 8) { toast('La contraseña debe tener mínimo 8 caracteres', 'error'); return }
    setSavingPass(true)
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'reset_password', user_id: resetUser.id, password: nuevaPass },
    })
    setSavingPass(false)
    if (error || data?.status !== 'ok') {
      toast('Error: ' + (error?.message || String(data?.mensaje || 'no se pudo cambiar la contraseña')), 'error')
      return
    }
    toast(String(data?.mensaje || `Contraseña actualizada para ${resetUser.email}`), 'success')
    setResetUser(null)
  }

  async function eliminarUsuario(u: Usuario) {
    if (u.id === perfil?.user_id) return
    if (!confirm(`¿Eliminar al usuario ${u.email}? Esta acción no se puede deshacer.`)) return
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'delete_user', user_id: u.id },
    })
    if (error || data?.status !== 'ok') {
      toast('Error: ' + (error?.message || String(data?.mensaje || 'no se pudo eliminar')), 'error')
      return
    }
    toast(String(data?.mensaje || 'Usuario eliminado'), 'success')
    fetchUsuarios()
  }

  /* ── Guardas ── */
  if (loading) return <Spinner />
  if (rol !== 'admin') {
    return (
      <div className="card mx-auto mt-12 max-w-md p-8 text-center">
        <h2 className="disp text-xl uppercase tracking-wide">Solo administradores</h2>
        <p className="mt-2 text-sm text-ink3">No tienes permisos para ver esta sección.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Sedes" sub="Administración de sedes y usuarios">
        <button className="btn btn-primary" onClick={abrirNuevaSede}>
          <IconPlus width={16} height={16} /> Nueva sede
        </button>
      </PageHeader>

      {/* ── A) Sedes ── */}
      {sedes.length === 0 ? (
        <EmptyState text="Sin sedes registradas. Crea la primera con “Nueva sede”." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sedes.map(s => (
            <div key={s.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="disp truncate text-lg uppercase tracking-wide">{s.nombre}</h3>
                  <span className="font-mono text-xs text-ink3">{s.slug}</span>
                </div>
                <span className={`chip ${s.activa ? 'chip-green' : 'chip-gray'}`}>{s.activa ? 'Activa: SÍ' : 'Activa: NO'}</span>
              </div>
              <div className="mt-3 flex-1 space-y-1.5 text-sm text-ink2">
                <p><span className="font-semibold text-ink3">Dirección:</span> {s.direccion || '—'}</p>
                <p><span className="font-semibold text-ink3">WhatsApp:</span> {s.whatsapp || '—'}</p>
                <p><span className="font-semibold text-ink3">Horario:</span> {s.horario || '—'}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => abrirEditarSede(s)}>
                  <IconPencil width={14} height={14} /> Editar
                </button>
                <button className={`btn btn-sm ${s.activa ? 'btn-danger' : 'btn-secondary'}`} onClick={() => toggleActiva(s)}>
                  {s.activa ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── B) Usuarios ── */}
      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="disp text-2xl uppercase tracking-wide max-sm:text-xl">Usuarios</h2>
          <p className="mt-0.5 text-xs uppercase tracking-widest text-ink3">Acceso al panel por sede</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevoUsuario}>
          <IconPlus width={16} height={16} /> Nuevo usuario
        </button>
      </div>

      {loadingUsers ? <Spinner /> : usuarios.length === 0 ? (
        <EmptyState text="Sin usuarios registrados." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[720px]">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Sede</th>
                <th>Fecha</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const esYo = u.id === perfil?.user_id
                return (
                  <tr key={u.id}>
                    <td className="font-semibold text-ink">{u.email}{esYo && <span className="ml-1.5 text-xs text-ink3">(tú)</span>}</td>
                    <td>{u.nombre || '—'}</td>
                    <td>
                      <span className={`chip ${u.rol === 'admin' ? 'chip-red' : 'chip-blue'}`}>
                        {u.rol === 'admin' ? 'Admin' : 'Sede'}
                      </span>
                    </td>
                    <td>{u.sede_id ? (nombreSede.get(u.sede_id) || '—') : (u.rol === 'admin' ? 'Todas' : '—')}</td>
                    <td className="text-ink3">{fmtFecha(u.created_at)}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button className="btn btn-secondary btn-sm" onClick={() => { setResetUser(u); setNuevaPass(genPassword()) }}>
                          Cambiar contraseña
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={esYo}
                          title={esYo ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                          style={esYo ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                          onClick={() => eliminarUsuario(u)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal sede (crear / editar) ── */}
      <Modal
        open={modalSede}
        onClose={() => { setModalSede(false); setCreada(null) }}
        title={creada ? 'Sede creada' : form.id ? 'Editar sede' : 'Nueva sede'}
        footer={creada ? (
          <button className="btn btn-primary" onClick={() => { setModalSede(false); setCreada(null) }}>Entendido</button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => setModalSede(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarSede} disabled={savingSede}>
              {savingSede ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear sede'}
            </button>
          </>
        )}
      >
        {creada ? (
          <div className="space-y-3">
            <p className="text-sm text-ink2">La sede fue creada correctamente.</p>
            {creada.msgCopia && (
              <div className="rounded-lg border px-3 py-2 text-sm text-ink2" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
                {creada.msgCopia}
              </div>
            )}
            <div className="rounded-lg px-3 py-3 text-sm font-semibold" style={{ background: 'var(--yellow-soft)', color: 'var(--yellow)' }}>
              El bot de esta sede debe enviar &quot;sede&quot;: &quot;{creada.slug}&quot; en sus funciones de Meteor.
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => copiar(creada.slug)}>Copiar slug</button>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="lbl" htmlFor="sd-nombre">Nombre</label>
              <input id="sd-nombre" className="input w-full" type="text" placeholder="Amala Bocagrande"
                value={form.nombre}
                onChange={e => {
                  const nombre = e.target.value
                  setForm(f => ({ ...f, nombre, slug: !slugTocado && !f.id ? slugify(nombre) : f.slug }))
                }} />
            </div>
            <div className="mb-3">
              <label className="lbl" htmlFor="sd-slug">Slug (identificador para el bot)</label>
              <input id="sd-slug" className="input w-full font-mono" type="text" placeholder="amala-bocagrande"
                value={form.slug}
                onChange={e => { setSlugTocado(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })) }} />
            </div>
            <div className="mb-3">
              <label className="lbl" htmlFor="sd-dir">Dirección</label>
              <input id="sd-dir" className="input w-full" type="text" placeholder="Cra. 3 #6-120, Bocagrande"
                value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <div>
                <label className="lbl" htmlFor="sd-wa">WhatsApp</label>
                <input id="sd-wa" className="input w-full" type="text" placeholder="573001234567"
                  value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
              </div>
              <div>
                <label className="lbl" htmlFor="sd-hor">Horario</label>
                <input id="sd-hor" className="input w-full" type="text" placeholder="Lun–Dom 12:00 pm – 10:00 pm"
                  value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
              </div>
            </div>
            <div className="mb-3 flex items-center gap-3">
              <Switch id="sd-activa" checked={form.activa} onChange={v => setForm(f => ({ ...f, activa: v }))} />
              <label className="lbl !mb-0" htmlFor="sd-activa">Sede activa</label>
            </div>
            {!form.id && (
              <div>
                <label className="lbl" htmlFor="sd-copiar">Copiar menú y tarifas desde… (opcional)</label>
                <select id="sd-copiar" className="input w-full" value={form.copiarDe}
                  onChange={e => setForm(f => ({ ...f, copiarDe: e.target.value }))}>
                  <option value="">No copiar</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal nuevo usuario ── */}
      <Modal
        open={modalUser}
        onClose={() => { setModalUser(false); setCredenciales(null) }}
        title={credenciales ? 'Usuario creado' : 'Nuevo usuario'}
        footer={credenciales ? (
          <button className="btn btn-primary" onClick={() => { setModalUser(false); setCredenciales(null) }}>Listo</button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => setModalUser(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={crearUsuario} disabled={savingUser}>
              {savingUser ? 'Creando…' : 'Crear usuario'}
            </button>
          </>
        )}
      >
        {credenciales ? (
          <div className="space-y-3">
            <p className="text-sm text-ink2">Guarda estas credenciales ahora: la contraseña no se volverá a mostrar.</p>
            <div className="rounded-lg border px-3 py-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
              <p><span className="font-semibold text-ink3">Email:</span> <span className="font-mono">{credenciales.email}</span></p>
              <p className="mt-1"><span className="font-semibold text-ink3">Contraseña:</span> <span className="font-mono font-bold text-ink">{credenciales.password}</span></p>
            </div>
            <button className="btn btn-secondary btn-sm"
              onClick={() => copiar(`${credenciales.email} / ${credenciales.password}`)}>
              Copiar credenciales
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="lbl" htmlFor="us-nombre">Nombre</label>
              <input id="us-nombre" className="input w-full" type="text" placeholder="María Pérez"
                value={uForm.nombre} onChange={e => setUForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="mb-3">
              <label className="lbl" htmlFor="us-email">Email</label>
              <input id="us-email" className="input w-full" type="email" placeholder="sede@amala.com"
                value={uForm.email} onChange={e => setUForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="mb-3">
              <label className="lbl" htmlFor="us-pass">Contraseña (mínimo 8 caracteres)</label>
              <div className="flex gap-2">
                <input id="us-pass" className="input w-full font-mono" type="text"
                  value={uForm.password} onChange={e => setUForm(f => ({ ...f, password: e.target.value }))} />
                <button className="btn btn-secondary shrink-0" onClick={() => setUForm(f => ({ ...f, password: genPassword() }))}>
                  Generar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <div>
                <label className="lbl" htmlFor="us-sede">Sede</label>
                <select id="us-sede" className="input w-full" value={uForm.sede_id}
                  onChange={e => setUForm(f => ({ ...f, sede_id: e.target.value }))}>
                  <option value="">{uForm.rol === 'admin' ? 'Todas (admin)' : 'Selecciona sede…'}</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="us-rol">Rol</label>
                <select id="us-rol" className="input w-full" value={uForm.rol}
                  onChange={e => setUForm(f => ({ ...f, rol: e.target.value === 'admin' ? 'admin' : 'sede' }))}>
                  <option value="sede">Usuario de sede</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* ── Modal cambiar contraseña ── */}
      <Modal
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        title="Cambiar contraseña"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setResetUser(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={cambiarPassword} disabled={savingPass}>
              {savingPass ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink2">
          Nueva contraseña para <span className="font-semibold text-ink">{resetUser?.email}</span>. Cópiala antes de guardar: no se volverá a mostrar.
        </p>
        <label className="lbl" htmlFor="rp-pass">Nueva contraseña (mínimo 8 caracteres)</label>
        <div className="flex gap-2">
          <input id="rp-pass" className="input w-full font-mono" type="text"
            value={nuevaPass} onChange={e => setNuevaPass(e.target.value)} />
          <button className="btn btn-secondary shrink-0" onClick={() => setNuevaPass(genPassword())}>Generar</button>
          <button className="btn btn-secondary shrink-0" onClick={() => copiar(nuevaPass)}>Copiar</button>
        </div>
      </Modal>
    </div>
  )
}
