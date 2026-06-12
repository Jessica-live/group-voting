// pages/api/vote.js
// POST { token, votes: [{candidate_id}] }
// Calls the atomic DB function — never logs which candidate a token chose.

import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, votes } = req.body

  if (!token || !Array.isArray(votes) || votes.length === 0) {
    return res.status(400).json({ error: 'Missing token or votes' })
  }

  // Basic input sanitisation
  const sanitisedVotes = votes
    .filter(v => Number.isInteger(v.candidate_id) && v.candidate_id > 0)
    .map(v => ({ candidate_id: v.candidate_id }))

  if (sanitisedVotes.length === 0) {
    return res.status(400).json({ error: 'No valid candidate selections' })
  }

  const db = supabaseAdmin()

  // The cast_vote function handles everything atomically
  const { data, error } = await db.rpc('cast_vote', {
    p_token: token.trim().toUpperCase(),
    p_votes: sanitisedVotes,
  })

  if (error) {
    console.error('cast_vote rpc error:', error.message)
    return res.status(500).json({ error: 'Internal error. Please try again.' })
  }

  if (!data.ok) {
    // Token not found or already used — return 400 so UI can show a message
    return res.status(400).json({ error: data.error })
  }

  return res.status(200).json({ ok: true })
}
