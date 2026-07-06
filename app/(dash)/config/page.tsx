'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSede } from '@/lib/sede'
import { PageHeader, Spinner, Switch, useToast } from '@/components/ui'
import { getSoundVol, setSoundVol, playSound } from '@/lib/sound'
import { IconSun, IconMoon } from '@/components/icons'

const ESTADOS_MSG = ['En cocina', 'En camino', 'Listo para recoger', 'Entregado', 'Cancelado'] as const
type MsgCfg = { texto: string; activo: boolean }

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card mb-5 p-5">
      <h3 className="disp mb-3 text-lg uppercase tracking-wide">{titulo}</h3>
      {children}
    </section>
  )
}

export default function ConfigPage() {
  const toast = useToast()
  const { sedeId } = useSede()

  /* ── Mensajes automáticos ── */
  const [msgs, setMsgs] = useState<Record<string, MsgCfg>>(
    Object.fromEntries(ESTADOS_MSG.map(e => [e, { texto: '', activo: true }]))
  )
  const [guardandoMsgs, setGuardandoMsgs] = useState(false)

  useEffect(() => {
    if (!sedeId) return
    ;(async () => {
      // Reset a valores por defecto al cambiar de sede (por si la nueva no tiene config)
      setMsgs(Object.fromEntries(ESTADOS_MSG.map(e => [e, { texto: '', activo: true }])))
      const { data } = await supabase.from('config').select('valor')
        .eq('clave', 'mensajes_estado').eq('sede_id', sedeId).maybeSingle()
      if (!data?.valor) return
      let parsed: Record<string, unknown> = {}
      try { parsed = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor } catch { return }
      setMsgs(prev => {
        const next = { ...prev }
        for (const estado of ESTADOS_MSG) {
          const raw = parsed[estado]
          if (typeof raw === 'string') next[estado] = { texto: raw, activo: true }
          else if (raw && typeof raw === 'object') {
            const o = raw as { texto?: string; activo?: boolean }
            next[estado] = { texto: o.texto || '', activo: o.activo !== false }
          }
        }
        return next
      })
    })()
  }, [sedeId])

  async function guardarMensajes() {
    if (!sedeId) { toast('Selecciona una sede primero', 'error'); return }
    setGuardandoMsgs(true)
    const { error } = await supabase.from('config').upsert(
      { clave: 'mensajes_estado', sede_id: sedeId, valor: JSON.stringify(msgs), updated_at: new Date().toISOString() },
      { onConflict: 'clave,sede_id' }
    )
    setGuardandoMsgs(false)
    if (error) { toast('Error al guardar: ' + error.message, 'error'); return }
    toast('Mensajes guardados', 'success')
  }

  /* ── Seguimiento automático (nudges) ── */
  type SegCfg = { reenganche: boolean; recordatorio_pago: boolean; reenganche_min: number; recordatorio_pago_min: number }
  const SEG_DEFAULT: SegCfg = { reenganche: true, recordatorio_pago: true, reenganche_min: 10, recordatorio_pago_min: 15 }
  const [seg, setSeg] = useState<SegCfg>(SEG_DEFAULT)
  const [guardandoSeg, setGuardandoSeg] = useState(false)
  const clampMin = (n: unknown, def: number) => {
    const x = Number(n)
    return Number.isFinite(x) && x >= 2 && x <= 240 ? Math.round(x) : def
  }

  useEffect(() => {
    if (!sedeId) return
    ;(async () => {
      setSeg(SEG_DEFAULT)
      const { data } = await supabase.from('config').select('valor')
        .eq('clave', 'seguimiento').eq('sede_id', sedeId).maybeSingle()
      if (!data?.valor) return
      let v: Record<string, unknown> = {}
      try { v = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor } catch { return }
      setSeg({
        reenganche: v.reenganche !== false,
        recordatorio_pago: v.recordatorio_pago !== false,
        reenganche_min: clampMin(v.reenganche_min, 10),
        recordatorio_pago_min: clampMin(v.recordatorio_pago_min, 15),
      })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId])

  async function guardarSeguimiento(next: SegCfg) {
    if (!sedeId) { toast('Selecciona una sede primero', 'error'); return }
    const limpio: SegCfg = {
      ...next,
      reenganche_min: clampMin(next.reenganche_min, 10),
      recordatorio_pago_min: clampMin(next.recordatorio_pago_min, 15),
    }
    setSeg(limpio)
    setGuardandoSeg(true)
    const { error } = await supabase.from('config').upsert(
      { clave: 'seguimiento', sede_id: sedeId, valor: JSON.stringify(limpio), updated_at: new Date().toISOString() },
      { onConflict: 'clave,sede_id' }
    )
    setGuardandoSeg(false)
    if (error) { toast('Error al guardar: ' + error.message, 'error'); return }
    toast('Seguimiento actualizado', 'success')
  }

  /* ── Sonido ── */
  const [vol, setVol] = useState(1.2)
  useEffect(() => { setVol(getSoundVol()) }, [])

  /* ── Cuenta ── */
  const [email, setEmail] = useState('')
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [cambiando, setCambiando] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
  }, [])

  async function cambiarPassword() {
    if (pass1.length < 8) { toast('La contraseña debe tener mínimo 8 caracteres', 'error'); return }
    if (pass1 !== pass2) { toast('Las contraseñas no coinciden', 'error'); return }
    setCambiando(true)
    const { error } = await supabase.auth.updateUser({ password: pass1 })
    setCambiando(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setPass1(''); setPass2('')
    toast('Contraseña actualizada', 'success')
  }

  return (
    <div>
      <PageHeader title="Configuración" sub="Mensajes, seguimiento, sonido y cuenta" />

      <Seccion titulo="Mensajes automáticos al cliente">
        {!sedeId ? <Spinner /> : (
        <>
        <p className="mb-4 text-xs leading-relaxed text-ink3">
          Se envían por WhatsApp al cliente cuando cambias el estado del pedido. Usa{' '}
          <code className="text-brand">{'{pedido}'}</code> (número de pedido) y{' '}
          <code className="text-brand">{'{cliente}'}</code> (nombre). Apaga el switch para NO enviar aviso en ese estado.
        </p>
        <div className="grid gap-4">
          {ESTADOS_MSG.map(estado => (
            <div key={estado}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="lbl !mb-0">{estado}</label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink2">
                  <Switch checked={msgs[estado].activo} onChange={v => setMsgs(m => ({ ...m, [estado]: { ...m[estado], activo: v } }))} />
                  Enviar
                </label>
              </div>
              <textarea className="input w-full" rows={2} value={msgs[estado].texto}
                placeholder={`Mensaje para "${estado}"…`}
                onChange={e => setMsgs(m => ({ ...m, [estado]: { ...m[estado], texto: e.target.value } }))} />
            </div>
          ))}
        </div>
        <button className="btn btn-primary mt-4" disabled={guardandoMsgs} onClick={guardarMensajes}>
          {guardandoMsgs ? 'Guardando…' : 'Guardar'}
        </button>
        </>
        )}
      </Seccion>

      <Seccion titulo="Seguimiento automático (Amalita)">
        {!sedeId ? <Spinner /> : (
        <>
        <p className="mb-4 text-xs leading-relaxed text-ink3">
          Amalita reengancha sola a los clientes. <b>Tú decides los minutos de espera</b> de cada seguimiento (entre 2 y 240).
          También puedes apagarlo para un cliente puntual desde la página <b>Seguimiento</b>.
          {guardandoSeg && ' Guardando…'}
        </p>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
            <span className="min-w-[220px] flex-1">
              <span className="block text-sm font-bold text-ink">Reenganche por inactividad</span>
              <span className="block text-xs text-ink3">Saludó y no pidió → Amalita le pregunta si continúa con el pedido o pide en otra ocasión</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-ink2">
              <span>Tras</span>
              <input type="number" min={2} max={240} className="input !w-20 text-center"
                value={seg.reenganche_min}
                onChange={e => setSeg(s => ({ ...s, reenganche_min: Number(e.target.value) }))}
                onBlur={() => guardarSeguimiento(seg)} />
              <span>min</span>
              <Switch checked={seg.reenganche} onChange={v => guardarSeguimiento({ ...seg, reenganche: v })} />
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
            <span className="min-w-[220px] flex-1">
              <span className="block text-sm font-bold text-ink">Recordatorio de comprobante</span>
              <span className="block text-xs text-ink3">Pedido en &quot;Pendiente de pago&quot; sin comprobante → Amalita se lo recuerda</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-ink2">
              <span>Tras</span>
              <input type="number" min={2} max={240} className="input !w-20 text-center"
                value={seg.recordatorio_pago_min}
                onChange={e => setSeg(s => ({ ...s, recordatorio_pago_min: Number(e.target.value) }))}
                onBlur={() => guardarSeguimiento(seg)} />
              <span>min</span>
              <Switch checked={seg.recordatorio_pago} onChange={v => guardarSeguimiento({ ...seg, recordatorio_pago: v })} />
            </span>
          </div>
        </div>
        </>
        )}
      </Seccion>

      <Seccion titulo="Sonido de alertas">
        <p className="mb-3 text-xs text-ink3">
          Volumen del aviso cuando entra un pedido o alerta. Súbelo si hay mucho ruido en la cocina.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <input type="range" min={0.5} max={2} step={0.1} value={vol}
            className="min-w-[200px] flex-1"
            style={{ accentColor: 'var(--red)' }}
            onChange={e => { const v = parseFloat(e.target.value); setVol(v); setSoundVol(v) }} />
          <span className="w-12 text-right font-mono text-sm font-bold text-brand">{Math.round(vol * 100)}%</span>
          <button className="btn btn-secondary" onClick={() => playSound('new')}>Probar 🔊</button>
        </div>
      </Seccion>

      <Seccion titulo="Cuenta">
        <div className="mb-4">
          <label className="lbl">Correo</label>
          <div className="text-sm text-ink">{email || '—'}</div>
        </div>
        <div className="grid max-w-lg gap-3">
          <div>
            <label className="lbl">Nueva contraseña</label>
            <input className="input w-full" type="password" value={pass1} onChange={e => setPass1(e.target.value)}
              placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </div>
          <div>
            <label className="lbl">Confirmar contraseña</label>
            <input className="input w-full" type="password" value={pass2} onChange={e => setPass2(e.target.value)}
              placeholder="Repite la contraseña" autoComplete="new-password" />
          </div>
          <div>
            <button className="btn btn-primary" disabled={cambiando} onClick={cambiarPassword}>
              {cambiando ? 'Cambiando…' : 'Cambiar contraseña'}
            </button>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Apariencia">
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink2">
          Usa el botón
          <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1">
            <IconSun width={14} height={14} /> / <IconMoon width={14} height={14} />
          </span>
          en la barra superior para cambiar entre modo claro y oscuro. La preferencia se guarda en este dispositivo.
        </p>
      </Seccion>
    </div>
  )
}
