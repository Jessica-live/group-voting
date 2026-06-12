// Public endpoint — returns voting window status and times
// No auth needed — anyone can read this to check if voting is open

import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('settings')
    .select('voting_start, voting_end')
    .eq('id', 1)
    .single()

  if (error || !data) return res.status(200).json({ status: 'open', voting_start: null, voting_end: null })

  const now = new Date()
  const start = data.voting_start ? new Date(data.voting_start) : null
  const end   = data.voting_end   ? new Date(data.voting_end)   : null

  let status = 'open'
  if (start && now < start) status = 'not_started'
  else if (end && now > end) status = 'closed'

  return res.status(200).json({
    status,          // 'open' | 'not_started' | 'closed'
    voting_start: data.voting_start,
    voting_end:   data.voting_end,
    server_time:  now.toISOString(),
  })
}
