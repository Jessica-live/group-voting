import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, votes } = req.body
  if (!token || !Array.isArray(votes) || votes.length === 0)
    return res.status(400).json({ error: 'Missing token or votes' })

  const db = supabaseAdmin()

  // Check voting window
  const { data: settings } = await db.from('settings').select('voting_start, voting_end').eq('id', 1).single()
  if (settings) {
    const now = new Date()
    if (settings.voting_start && now < new Date(settings.voting_start))
      return res.status(400).json({ error: 'Voting has not started yet.' })
    if (settings.voting_end && now > new Date(settings.voting_end))
      return res.status(400).json({ error: 'Voting has closed.' })
  }

  const sanitisedVotes = votes
    .filter(v => Number.isInteger(v.candidate_id) && v.candidate_id > 0)
    .map(v => ({ candidate_id: v.candidate_id }))

  if (sanitisedVotes.length === 0)
    return res.status(400).json({ error: 'No valid candidate selections' })

  const { data, error } = await db.rpc('cast_vote', {
    p_token: token.trim().toUpperCase(),
    p_votes: sanitisedVotes,
  })

  if (error) return res.status(500).json({ error: 'Internal error. Please try again.' })
  if (!data.ok) return res.status(400).json({ error: data.error })

  return res.status(200).json({ ok: true })
}
