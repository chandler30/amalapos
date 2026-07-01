// Campaneo agradable (Web Audio): arpegio con decaimiento tipo campana.
let AudioCtx: AudioContext | null = null
function getAC(): AudioContext {
  if (!AudioCtx) AudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return AudioCtx
}

export function getSoundVol(): number {
  const v = parseFloat(localStorage.getItem('sound_vol') || '')
  return isNaN(v) ? 1.2 : v
}
export function setSoundVol(v: number) { localStorage.setItem('sound_vol', String(v)) }
export function getSoundOn(): boolean { return localStorage.getItem('sound_on') !== '0' }
export function setSoundOn(on: boolean) { localStorage.setItem('sound_on', on ? '1' : '0') }

function tone(freq: number, start: number, dur: number, vol: number) {
  const c = getAC()
  const o = c.createOscillator(), g = c.createGain()
  o.type = 'sine'; o.frequency.value = freq
  const t = c.currentTime + start
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(c.destination)
  o.start(t); o.stop(t + dur + 0.05)
}

function chime(notes: number[], reps: number, gap: number, dur: number, vol: number) {
  if (!getSoundOn()) return
  try {
    const c = getAC(); if (c.state === 'suspended') c.resume()
    const v = Math.min(2, vol * getSoundVol())
    for (let r = 0; r < reps; r++) {
      const base = r * (notes.length * gap + 0.22)
      notes.forEach((f, i) => {
        tone(f, base + i * gap, dur, v)
        tone(f * 2, base + i * gap, dur * 0.6, v * 0.22)
      })
    }
  } catch { /* audio no disponible */ }
}

export function playSound(type: 'new' | 'alerta' | 'validar' | 'reserva') {
  if (type === 'new') chime([784, 1047, 1319], 2, 0.13, 0.45, 0.62)
  else if (type === 'alerta') chime([1175, 784], 2, 0.17, 0.4, 0.6)
  else if (type === 'validar') chime([784, 1047, 1319, 1568], 1, 0.1, 0.35, 0.55)
  else chime([523, 659, 784], 1, 0.18, 0.45, 0.5)
}
