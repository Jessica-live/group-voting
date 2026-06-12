// pages/api/validate-token.js
// POST { token }
// Returns { valid: true } or { valid: false, reason }
// Does NOT return group_name to the browser — only whether the token is usable.

import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body
  if (!token) return res.status(400).json({ valid: false, reason: 'No token provided' })

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('tokens')
    .select('is_used')
    .eq('token', token.trim().toUpperCase())
    .single()

  if (error || !data) {
    return res.status(200).json({ valid: false, reason: 'Token not found' })
  }

  if (data.is_used) {
    return res.status(200).json({ valid: false, reason: 'Token already used' })
  }

  return res.status(200).json({ valid: true })
}
