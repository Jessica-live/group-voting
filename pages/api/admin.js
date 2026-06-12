// pages/api/admin.js
// Protected by ADMIN_SECRET env var — set this in Vercel env vars.
// All write operations go through here.

import { supabaseAdmin } from '../../lib/supabase'
import { randomBytes } from 'crypto'

function auth(req) {
  const secret = req.headers['x-admin-secret']
  return secret === process.env.ADMIN_SECRET
}

function generateToken(groupName, index) {
  const rand = randomBytes(3).toString('hex').toUpperCase()
  const idx  = String(index).padStart(2, '0')
  return `GRP-${idx}-${rand}`
}

export default async function handler(req, res) {
  if (!auth(req)) return res.status(401).json({ error: 'Unauthorised' })

  const db = supabaseAdmin()
  const { action } = req.query

  // ── GET /api/admin?action=dashboard ────────────────────────
  if (req.method === 'GET' && action === 'dashboard') {
    const [tokens, positions, candidates, totals] = await Promise.all([
      db.from('tokens').select('id,token,group_name,is_used,created_at').order('id'),
      db.from('positions').select('*').order('sort_order'),
      db.from('candidates').select('*').order('position_id'),
      db.from('vote_totals').select('*'),
    ])
    return res.status(200).json({
      tokens:     tokens.data,
      positions:  positions.data,
      candidates: candidates.data,
      totals:     totals.data,
    })
  }

  // ── POST /api/admin?action=generate-tokens ──────────────────
  if (req.method === 'POST' && action === 'generate-tokens') {
    const { groups } = req.body  // [{ name: "Group 1" }, ...]
    if (!Array.isArray(groups) || groups.length === 0)
      return res.status(400).json({ error: 'Provide groups array' })

    const rows = groups.map((g, i) => ({
      token:      generateToken(g.name, i + 1),
      group_name: g.name,
    }))

    const { data, error } = await db.from('tokens').insert(rows).select('token,group_name')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ tokens: data })
  }

  // ── POST /api/admin?action=add-position ────────────────────
  if (req.method === 'POST' && action === 'add-position') {
    const { title, sort_order } = req.body
    if (!title) return res.status(400).json({ error: 'Title required' })

    const { data, error } = await db
      .from('positions')
      .insert({ title, sort_order: sort_order || 99 })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ position: data })
  }

  // ── DELETE /api/admin?action=delete-position ───────────────
  if (req.method === 'DELETE' && action === 'delete-position') {
    const { id } = req.body
    const { error } = await db.from('positions').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── POST /api/admin?action=add-candidate ───────────────────
  if (req.method === 'POST' && action === 'add-candidate') {
    const { position_id, name, bio } = req.body
    if (!position_id || !name)
      return res.status(400).json({ error: 'position_id and name required' })

    const { data: cand, error: ce } = await db
      .from('candidates')
      .insert({ position_id, name, bio })
      .select()
      .single()

    if (ce) return res.status(500).json({ error: ce.message })

    // Create the vote_totals row immediately (starts at 0)
    await db.from('vote_totals').insert({ candidate_id: cand.id, total: 0 })

    return res.status(200).json({ candidate: cand })
  }

  // ── DELETE /api/admin?action=delete-candidate ──────────────
  if (req.method === 'DELETE' && action === 'delete-candidate') {
    const { id } = req.body
    const { error } = await db.from('candidates').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── POST /api/admin?action=reset-token ─────────────────────
  if (req.method === 'POST' && action === 'reset-token') {
    // Use this if a group had a technical issue — resets their token so they can vote again
    const { id } = req.body
    const { error } = await db
      .from('tokens')
      .update({ is_used: false, used_at: null })
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: 'Unknown action' })
}
