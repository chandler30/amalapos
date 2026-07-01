'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) { setError('Correo o contraseña incorrectos'); return }
    router.replace('/')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="checker" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="brandfont text-6xl leading-none" style={{ color: 'var(--red)' }}>AMALA</div>
            <div className="disp mt-2 text-xs uppercase tracking-[0.35em]" style={{ color: 'var(--green)' }}>Pizza &amp; Tacos</div>
            <div className="mt-1 text-xs uppercase tracking-widest text-ink3">Sistema POS · Crespo, Cartagena</div>
          </div>
          <form onSubmit={onSubmit} className="card p-6">
            <label className="lbl" htmlFor="email">Correo</label>
            <input id="email" type="email" required autoComplete="email" className="input mb-4"
              placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} />
            <label className="lbl" htmlFor="password">Contraseña</label>
            <input id="password" type="password" required autoComplete="current-password" className="input mb-5"
              placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <div className="mb-4 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: 'var(--red-soft)', color: 'var(--danger)' }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-60">
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-ink3">Acceso solo para el equipo de Amala 🍕🌮</p>
        </div>
      </div>
    </div>
  )
}
