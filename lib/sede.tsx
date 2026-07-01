'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export interface Sede {
  id: string; nombre: string; slug: string; direccion: string | null
  whatsapp: string | null; horario: string | null; activa: boolean
}
export interface Perfil { user_id: string; sede_id: string | null; rol: 'admin' | 'sede'; nombre: string | null; email: string | null }

interface SedeCtx {
  loading: boolean
  sedes: Sede[]
  sedeId: string | null            // sede seleccionada (admin puede cambiarla; usuario de sede queda fijo)
  setSedeId: (id: string) => void
  sede: Sede | null
  rol: 'admin' | 'sede'
  perfil: Perfil | null
  refreshSedes: () => Promise<void>
}

const Ctx = createContext<SedeCtx>({
  loading: true, sedes: [], sedeId: null, setSedeId: () => {}, sede: null, rol: 'sede', perfil: null,
  refreshSedes: async () => {},
})
export function useSede() { return useContext(Ctx) }

export function SedeProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [sedes, setSedes] = useState<Sede[]>([])
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [sedeId, setSedeIdState] = useState<string | null>(null)

  const refreshSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').order('created_at')
    setSedes((data as Sede[]) || [])
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) { setLoading(false); return }
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from('perfiles').select('*').eq('user_id', u.user.id).maybeSingle(),
        supabase.from('sedes').select('*').order('created_at'),
      ])
      const lista = (s as Sede[]) || []
      setSedes(lista)
      const pf = (p as Perfil) || null
      setPerfil(pf)
      if (pf?.rol === 'admin') {
        const saved = localStorage.getItem('sede_sel')
        const valida = lista.find(x => x.id === saved)
        setSedeIdState(valida ? valida.id : (pf.sede_id || lista[0]?.id || null))
      } else {
        setSedeIdState(pf?.sede_id || lista[0]?.id || null)
      }
      setLoading(false)
    })()
  }, [])

  function setSedeId(id: string) {
    setSedeIdState(id)
    localStorage.setItem('sede_sel', id)
  }

  const sede = sedes.find(s => s.id === sedeId) || null
  const rol: 'admin' | 'sede' = perfil?.rol === 'admin' ? 'admin' : 'sede'

  return (
    <Ctx.Provider value={{ loading, sedes, sedeId, setSedeId, sede, rol, perfil, refreshSedes }}>
      {children}
    </Ctx.Provider>
  )
}
