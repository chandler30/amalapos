'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { IconX } from './icons'

/* ── Toast ── */
type Toast = { id: number; msg: string; kind: 'success' | 'error' | 'info' }
const ToastCtx = createContext<(msg: string, kind?: Toast['kind']) => void>(() => {})
export function useToast() { return useContext(ToastCtx) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((msg: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="card px-4 py-3 text-sm font-semibold shadow-lg"
            style={{ borderLeft: `4px solid var(--${t.kind === 'success' ? 'green' : t.kind === 'error' ? 'danger' : 'blue'})` }}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ── Modal ── */
export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 max-sm:items-end max-sm:p-0"
      style={{ background: 'var(--scrim)' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[92vh] flex flex-col max-sm:rounded-b-none`}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="disp text-lg uppercase tracking-wide">{title}</h3>
          <button onClick={onClose} className="text-ink3 hover:text-ink cursor-pointer" aria-label="Cerrar"><IconX /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>{footer}</div>}
      </div>
    </div>
  )
}

/* ── Switch ── */
export function Switch({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  return (
    <span className="switch">
      <input type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="slider" onClick={() => onChange(!checked)} />
    </span>
  )
}

/* ── Spinner / Empty ── */
export function Spinner() {
  return <div className="mx-auto my-8 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
}
export function EmptyState({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-ink3">{text}</div>
}

/* ── Page header ── */
export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
      <div>
        <h1 className="disp text-3xl uppercase tracking-wide max-sm:text-2xl">{title}</h1>
        {sub && <p className="mt-0.5 text-xs uppercase tracking-widest text-ink3">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
