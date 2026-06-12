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

  if (req.method === 'GET' && action === 'dashboard') {
    const [t, p, c, v] = await Promise.all([
      db.from('tokens').select('*').order('id'),
      db.from('positions').select('*').order('sort_order'),
      db.from('candidates').select('*').order('position_id'),
      db.from('vote_totals').select('*'),
    ])
    // Return errors explicitly so we can debug
    if (t.error || p.error || c.error || v.error) {
      return res.status(200).json({
        tokens: t.data,
        positions: p.data,
        candidates: c.data,
        totals: v.data,
        _errors: {
          tokens: t.error?.message,
          positions: p.error?.message,
          candidates: c.error?.message,
          totals: v.error?.message,
        },
        _env: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0,30),
          keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0,20),
        }
      })
    }
    return res.status(200).json({ tokens: t.data, positions: p.data, candidates: c.data, totals: v.data })
  }

  if (req.method === 'POST' && action === 'generate-tokens') {
    const { data: pending } = await db.from('tokens').select('id').like('token', 'PENDING-%')
    if (pending && pending.length > 0) {
      for (let i = 0; i < pending.length; i++) {
        await db.from('tokens').update({ token: generateToken(i + 1) }).eq('id', pending[i].id)
      }
      return res.status(200).json({ ok: true, count: pending.length })
    }
    return res.status(400).json({ error: 'No pending tokens found' })
  }

  if (req.method === 'POST' && action === 'toggle-voting') {
    const { id, can_vote } = req.body
    const { error } = await db.from('tokens').update({ can_vote }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'POST' && action === 'update-group') {
    const { id, group_name, full_name, short_name } = req.body
    const { error } = await db.from('tokens').update({ group_name, full_name, short_name }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'POST' && action === 'reset-token') {
    const { id } = req.body
    const { error } = await db.from('tokens').update({ is_used: false, used_at: null }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'POST' && action === 'add-position') {
    const { title, sort_order } = req.body
    if (!title) return res.status(400).json({ error: 'Title required' })
    const { data, error } = await db.from('positions').insert({ title, sort_order: sort_order || 99 }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ position: data })
  }

  if (req.method === 'DELETE' && action === 'delete-position') {
    const { id } = req.body
    const { error } = await db.from('positions').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'POST' && action === 'add-candidate') {
    const { position_id, name, bio } = req.body
    if (!position_id || !name) return res.status(400).json({ error: 'position_id and name required' })
    const { data: cand, error: ce } = await db.from('candidates').insert({ position_id, name, bio }).select().single()
    if (ce) return res.status(500).json({ error: ce.message })
    await db.from('vote_totals').insert({ candidate_id: cand.id, total: 0 })
    return res.status(200).json({ candidate: cand })
  }

  if (req.method === 'DELETE' && action === 'delete-candidate') {
    const { id } = req.body
    const { error } = await db.from('candidates').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: 'Unknown action' })
}
