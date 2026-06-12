import { supabaseAdmin } from '../../lib/supabase'
import { randomBytes } from 'crypto'

function auth(req) {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

function generateToken(index) {
  const rand = randomBytes(3).toString('hex').toUpperCase()
  const idx  = String(index).padStart(3, '0')
  return `GRP-${idx}-${rand}`
}

export default async function handler(req, res) {
  if (!auth(req)) return res.status(401).json({ error: 'Unauthorised' })
  const db = supabaseAdmin()
  const { action } = req.query

  // GET dashboard
  if (req.method === 'GET' && action === 'dashboard') {
    const [tokens, positions, candidates, totals] = await Promise.all([
      db.from('tokens').select('*').order('id'),
      db.from('positions').select('*').order('sort_order'),
      db.from('candidates').select('*').order('position_id'),
      db.from('vote_totals').select('*'),
    ])
    return res.status(200).json({ tokens: tokens.data, positions: positions.data, candidates: candidates.data, totals: totals.data })
  }

  // Generate tokens for all PENDING groups
  if (req.method === 'POST' && action === 'generate-tokens') {
    const db2 = supabaseAdmin()
    // Get all pending tokens
    const { data: pending } = await db2.from('tokens').select('id').like('token', 'PENDING-%')
    if (pending && pending.length > 0) {
      // Update each pending token with a real token
      for (let i = 0; i < pending.length; i++) {
        const newToken = generateToken(i + 1)
        await db2.from('tokens').update({ token: newToken }).eq('id', pending[i].id)
      }
      return res.status(200).json({ ok: true, count: pending.length })
    }
    // If no pending, generate fresh from groups array
    const { groups } = req.body
    if (Array.isArray(groups)) {
      const rows = groups.map((g, i) => ({
        token: generateToken(i + 1),
        group_name: g.name,
        full_name: g.full_name || g.name,
        short_name: g.short_name || '',
        can_vote: g.can_vote !== false,
      }))
      const { data, error } = await db2.from('tokens').insert(rows).select('token,group_name,can_vote')
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ tokens: data })
    }
    return res.status(400).json({ error: 'No pending tokens or groups array found' })
  }

  // Toggle voting eligibility
  if (req.method === 'POST' && action === 'toggle-voting') {
    const { id, can_vote } = req.body
    const { error } = await db.from('tokens').update({ can_vote }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // Update group names
  if (req.method === 'POST' && action === 'update-group') {
    const { id, group_name, full_name, short_name } = req.body
    const { error } = await db.from('tokens').update({ group_name, full_name, short_name }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // Reset token (allow re-vote)
  if (req.method === 'POST' && action === 'reset-token') {
    const { id } = req.body
    const { error } = await db.from('tokens').update({ is_used: false, used_at: null }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // Add position
  if (req.method === 'POST' && action === 'add-position') {
    const { title, sort_order } = req.body
    if (!title) return res.status(400).json({ error: 'Title required' })
    const { data, error } = await db.from('positions').insert({ title, sort_order: sort_order || 99 }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ position: data })
  }

  // Delete position
  if (req.method === 'DELETE' && action === 'delete-position') {
    const { id } = req.body
    const { error } = await db.from('positions').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // Add candidate
  if (req.method === 'POST' && action === 'add-candidate') {
    const { position_id, name, bio } = req.body
    if (!position_id || !name) return res.status(400).json({ error: 'position_id and name required' })
    const { data: cand, error: ce } = await db.from('candidates').insert({ position_id, name, bio }).select().single()
    if (ce) return res.status(500).json({ error: ce.message })
    await db.from('vote_totals').insert({ candidate_id: cand.id, total: 0 })
    return res.status(200).json({ candidate: cand })
  }

  // Delete candidate
  if (req.method === 'DELETE' && action === 'delete-candidate') {
    const { id } = req.body
    const { error } = await db.from('candidates').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: 'Unknown action' })
}
