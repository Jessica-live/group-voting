// Public endpoint — no auth needed — returns positions, candidates, vote totals
// Used by the public voting page instead of hitting Supabase directly

import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const db = supabaseAdmin()
  const [pos, cands, tots] = await Promise.all([
    db.from('positions').select('*').eq('is_active', true).order('sort_order'),
    db.from('candidates').select('*').order('name'),
    db.from('vote_totals').select('*'),
  ])

  return res.status(200).json({
    positions:  pos.data   || [],
    candidates: cands.data || [],
    totals:     tots.data  || [],
  })
}
