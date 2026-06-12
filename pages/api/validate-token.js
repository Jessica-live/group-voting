// POST { token }
// Returns { valid: true } or { valid: false, reason }
// Also checks can_vote eligibility

import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body
  if (!token) return res.status(400).json({ valid: false, reason: 'No token provided' })

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('tokens')
    .select('is_used, can_vote')
    .eq('token', token.trim().toUpperCase())
    .single()

  if (error || !data) return res.status(200).json({ valid: false, reason: 'Token not found' })
  if (!data.can_vote) return res.status(200).json({ valid: false, reason: 'Your group is not currently eligible to vote. Please contact the administrator.' })
  if (data.is_used) return res.status(200).json({ valid: false, reason: 'This token has already been used. Each group may only vote once.' })

  return res.status(200).json({ valid: true })
}
