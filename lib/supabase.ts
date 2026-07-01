import { createClient } from '@supabase/supabase-js'

// La anon key es pública por diseño (la seguridad real la da Auth + RLS).
// Se puede sobreescribir con env vars en Vercel.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://jclqjsuchjpyfhowtzwj.supabase.co'
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbHFqc3VjaGpweWZob3d0endqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDE5MDIsImV4cCI6MjA5ODUxNzkwMn0.uYAAc7Fa6qgcElhEtxXzRLsuxnhv65g7lkELuNTiNsI'

export const supabase = createClient(url, anon)
