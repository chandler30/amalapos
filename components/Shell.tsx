'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSoundOn, setSoundOn } from '@/lib/sound'
import { SedeProvider, useSede } from '@/lib/sede'
import { ToastProvider } from './ui'
import {
  IconHome, IconReceipt, IconUsers, IconTag, IconBook, IconSparkles,
  IconChart, IconBell, IconCalendar, IconCog, IconSun, IconMoon,
  IconSpeaker, IconSpeakerOff, IconLogout, IconMapPin, IconChat,
} from './icons'

const NAV = [
  { href: '/', label: 'Dashboard', icon: IconHome },
  { href: '/pedidos', label: 'Pedidos', icon: IconReceipt },
  { href: '/seguimiento', label: 'Seguimiento', icon: IconChat },
  { href: '/clientes', label: 'Clientes', icon: IconUsers },
  { href: '/tarifas', label: 'Tarifas', icon: IconTag },
  { href: '/menu', label: 'Menú', icon: IconBook },
  { href: '/promos', label: 'Promos', icon: IconSparkles },
  { href: '/reportes', label: 'Reportes', icon: IconChart },
  { href: '/alertas', label: 'Alertas', icon: IconBell },
  { href: '/reservas', label: 'Reservas', icon: IconCalendar },
  { href: '/sedes', label: 'Sedes', icon: IconMapPin, adminOnly: true },
  { href: '/config', label: 'Config', icon: IconCog },
]

function ShellInner({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { sedes, sedeId, setSedeId, sede, rol, loading: sedeLoading } = useSede()
  const [dark, setDark] = useState(false)
  const [sound, setSound] = useState(true)
  const [clock, setClock] = useState('--:--:--')

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    setSound(getSoundOn())
    const t = setInterval(() => {
      setClock(new Date().toLocaleTimeString('es-CO', { hour12: true, timeZone: 'America/Bogota' }))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }
  function toggleSound() { const n = !sound; setSound(n); setSoundOn(n) }
  async function logout() { await supabase.auth.signOut(); router.replace('/login') }

  const nav = NAV.filter(n => !n.adminOnly || rol === 'admin')

  return (
    <div className="flex h-screen flex-col">
      <div className="checker shrink-0" />
      {/* Topbar */}
      <header className="flex shrink-0 items-center gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-baseline gap-2">
          <span className="brandfont text-2xl leading-none" style={{ color: 'var(--red)' }}>AMALA</span>
          <span className="disp text-[10px] uppercase tracking-[0.25em] max-sm:hidden" style={{ color: 'var(--green)' }}>Pizza &amp; Tacos</span>
        </div>
        {/* Sede: selector para admin, etiqueta para usuario de sede */}
        {!sedeLoading && (rol === 'admin' ? (
          <select value={sedeId ?? ''} onChange={e => setSedeId(e.target.value)}
            className="input !w-auto !py-1.5 text-[13px] font-bold" title="Sede activa" style={{ maxWidth: 170 }}>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        ) : (
          sede && <span className="chip chip-green">{sede.nombre}</span>
        ))}
        <span className="font-mono text-sm text-ink3 max-md:hidden" style={{ fontFamily: 'var(--font-jbmono)' }}>{clock}</span>
        <div className="flex-1" />
        <button onClick={toggleSound} className="btn btn-secondary btn-sm" title={sound ? 'Silenciar alertas' : 'Activar sonido'}>
          {sound ? <IconSpeaker width={16} height={16} /> : <IconSpeakerOff width={16} height={16} />}
        </button>
        <button onClick={toggleTheme} className="btn btn-secondary btn-sm" title={dark ? 'Modo claro' : 'Modo oscuro'}>
          {dark ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
        </button>
        <button onClick={logout} className="btn btn-secondary btn-sm" title="Cerrar sesión">
          <IconLogout width={16} height={16} />
          <span className="max-sm:hidden">Salir</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar (barra inferior en móvil) */}
        <nav className="flex w-[86px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r py-3 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-50 max-md:h-[64px] max-md:w-full max-md:flex-row max-md:overflow-x-auto max-md:overflow-y-hidden max-md:border-r-0 max-md:border-t max-md:px-2 max-md:py-1"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href}
                className="flex w-[68px] shrink-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center transition-colors max-md:w-[62px]"
                style={active ? { background: 'var(--red-soft)', color: 'var(--red)' } : { color: 'var(--ink3)' }}>
                <Icon width={19} height={19} />
                <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
              </Link>
            )
          })}
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto p-6 max-md:pb-20 max-sm:p-4">{children}</main>
      </div>
    </div>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  // Guardia de autenticación
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login')
    })
    return () => sub.subscription.unsubscribe()
  }, [router])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="brandfont text-4xl" style={{ color: 'var(--red)' }}>AMALA</div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <SedeProvider>
        <ShellInner>{children}</ShellInner>
      </SedeProvider>
    </ToastProvider>
  )
}
