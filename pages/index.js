// pages/index.js  —  Public voting page (tally + ballot)
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

export default function Home() {
  const [tab, setTab]               = useState('tally')    // 'tally' | 'vote'
  const [positions, setPositions]   = useState([])
  const [candidates, setCandidates] = useState([])
  const [totals, setTotals]         = useState({})
  const [filterPos, setFilterPos]   = useState(null)

  // Voting state
  const [token, setToken]           = useState('')
  const [tokenValid, setTokenValid] = useState(null)  // null | true | false
  const [tokenMsg, setTokenMsg]     = useState('')
  const [selections, setSelections] = useState({})    // { positionId: candidateId }
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState('')

  // ── Load data ────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [{ data: pos }, { data: cands }, { data: tots }] = await Promise.all([
      supabase.from('positions').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('candidates').select('*').order('name'),
      supabase.from('vote_totals').select('*'),
    ])
    setPositions(pos || [])
    setCandidates(cands || [])
    const map = {}
    ;(tots || []).forEach(t => { map[t.candidate_id] = t.total })
    setTotals(map)
  }, [])

  useEffect(() => {
    loadData()
    // Real-time updates for the tally board
    const channel = supabase
      .channel('vote_totals_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_totals' }, () => {
        loadData()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadData])

  // ── Tally helpers ─────────────────────────────────────────
  const visiblePositions = filterPos
    ? positions.filter(p => p.id === filterPos)
    : positions

  const maxForPosition = (posId) => {
    const cands = candidates.filter(c => c.position_id === posId)
    return Math.max(1, ...cands.map(c => totals[c.id] || 0))
  }

  const totalVotesCast = Object.values(totals).reduce((a, b) => a + b, 0)

  // ── Token validation ──────────────────────────────────────
  const validateToken = async () => {
    setTokenMsg('')
    setTokenValid(null)
    const res = await fetch('/api/validate-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (data.valid) {
      setTokenValid(true)
      setTokenMsg('')
    } else {
      setTokenValid(false)
      setTokenMsg(data.reason || 'Invalid token')
    }
  }

  // ── Submit vote ───────────────────────────────────────────
  const submitVote = async () => {
    setError('')
    const allSelected = positions.every(p => selections[p.id])
    if (!allSelected) {
      setError('Please select one candidate for every position.')
      return
    }
    setSubmitting(true)
    const votes = Object.values(selections).map(candidate_id => ({ candidate_id }))
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, votes }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.ok) {
      setSubmitted(true)
    } else {
      setError(data.error || 'Something went wrong. Please try again.')
    }
  }

  // ── Initials helper ───────────────────────────────────────
  const initials = (name) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  const COLORS = ['#E6F1FB','#EAF3DE','#FAEEDA','#FBEAF0','#E1F5EE']
  const TEXT   = ['#0C447C','#27500A','#633806','#72243E','#085041']
  const candidateColor = (id) => ({
    bg: COLORS[id % COLORS.length],
    text: TEXT[id % TEXT.length],
  })

  return (
    <>
      <Head>
        <title>Club Elections</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#f8f8f6', fontFamily: 'system-ui, sans-serif' }}>
        {/* Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e8e8e4', padding: '0 24px' }}>
          <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 17, color: '#1a1a1a' }}>Club Elections</span>
              <span style={{ fontSize: 13, color: '#888', marginLeft: 10 }}>Anonymous · Transparent</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['tally','vote'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '6px 18px', borderRadius: 8,
                  border: tab === t ? '1.5px solid #378ADD' : '1px solid #ddd',
                  background: tab === t ? '#E6F1FB' : '#fff',
                  color: tab === t ? '#185FA5' : '#555',
                  fontWeight: tab === t ? 600 : 400,
                  cursor: 'pointer', fontSize: 14,
                }}>
                  {t === 'tally' ? '📊 Live tally' : '🗳️ Vote'}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>

          {/* ── TALLY TAB ──────────────────────────────────── */}
          {tab === 'tally' && (
            <div>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Total votes recorded', value: totalVotesCast },
                  { label: 'Positions open', value: positions.length },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ fontSize: 26, fontWeight: 600, color: '#1a1a1a' }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Position filter */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <button onClick={() => setFilterPos(null)} style={{
                  padding: '5px 14px', borderRadius: 99, fontSize: 13, cursor: 'pointer',
                  border: !filterPos ? '1.5px solid #378ADD' : '1px solid #ddd',
                  background: !filterPos ? '#E6F1FB' : '#fff',
                  color: !filterPos ? '#185FA5' : '#555',
                }}>All positions</button>
                {positions.map(p => (
                  <button key={p.id} onClick={() => setFilterPos(p.id)} style={{
                    padding: '5px 14px', borderRadius: 99, fontSize: 13, cursor: 'pointer',
                    border: filterPos === p.id ? '1.5px solid #378ADD' : '1px solid #ddd',
                    background: filterPos === p.id ? '#E6F1FB' : '#fff',
                    color: filterPos === p.id ? '#185FA5' : '#555',
                  }}>{p.title}</button>
                ))}
              </div>

              {/* Tally cards */}
              {visiblePositions.map(pos => {
                const cands = candidates.filter(c => c.position_id === pos.id)
                const mx = maxForPosition(pos.id)
                const sorted = [...cands].sort((a,b) => (totals[b.id]||0) - (totals[a.id]||0))
                return (
                  <div key={pos.id} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 14, padding: '20px 22px', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>{pos.title}</div>
                    {sorted.length === 0 && <p style={{ color: '#bbb', fontSize: 14 }}>No candidates yet</p>}
                    {sorted.map((c, idx) => {
                      const col = candidateColor(c.id)
                      const pct = mx > 0 ? Math.round(((totals[c.id]||0) / mx) * 100) : 0
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < sorted.length-1 ? '1px solid #f0f0ec' : 'none' }}>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: col.bg, color: col.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                            {initials(c.name)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', marginBottom: 5 }}>{c.name}</div>
                            <div style={{ height: 7, background: '#f0f0ec', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: '#378ADD', borderRadius: 99, transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', minWidth: 28, textAlign: 'right' }}>{totals[c.id] || 0}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── VOTE TAB ────────────────────────────────────── */}
          {tab === 'vote' && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Vote submitted</h2>
                  <p style={{ color: '#888', fontSize: 15 }}>Your choices have been recorded anonymously. Thank you for voting.</p>
                  <button onClick={() => { setTab('tally'); setSubmitted(false); setToken(''); setSelections({}); setTokenValid(null) }}
                    style={{ marginTop: 24, padding: '10px 24px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                    View live tally
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, marginBottom: 24, fontSize: 14, color: '#3B6D11' }}>
                    <span>🔒</span>
                    <span>Your club's identity is never linked to your vote choices. Once submitted, the connection is permanently severed.</span>
                  </div>

                  {/* Token entry */}
                  {tokenValid !== true && (
                    <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 14, padding: '22px', marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Step 1 — Enter your voting token</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={token}
                          onChange={e => { setToken(e.target.value.toUpperCase()); setTokenValid(null); setTokenMsg('') }}
                          placeholder="e.g. GRP-01-A3F8"
                          onKeyDown={e => e.key === 'Enter' && validateToken()}
                          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, fontFamily: 'monospace', color: '#1a1a1a', background: '#fff' }}
                        />
                        <button onClick={validateToken} disabled={!token.trim()} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                          Verify
                        </button>
                      </div>
                      {tokenMsg && <p style={{ marginTop: 10, fontSize: 14, color: '#A32D2D', background: '#FCEBEB', padding: '8px 12px', borderRadius: 7 }}>{tokenMsg}</p>}
                    </div>
                  )}

                  {/* Ballot */}
                  {tokenValid === true && (
                    <>
                      <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 14, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: '#3B6D11', fontSize: 18 }}>✓</span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 14 }}>Token verified</div>
                          <div style={{ fontSize: 13, color: '#888' }}>{token} — select one candidate per position below</div>
                        </div>
                      </div>

                      {positions.map(pos => {
                        const cands = candidates.filter(c => c.position_id === pos.id)
                        return (
                          <div key={pos.id} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 14, padding: '20px 22px', marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>{pos.title}</div>
                            {cands.map((c, idx) => {
                              const col = candidateColor(c.id)
                              const selected = selections[pos.id] === c.id
                              return (
                                <div key={c.id} onClick={() => setSelections(s => ({...s, [pos.id]: c.id}))}
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, marginBottom: idx < cands.length-1 ? 8 : 0,
                                    border: selected ? '2px solid #378ADD' : '1px solid #e8e8e4',
                                    background: selected ? '#E6F1FB' : '#fafaf8', cursor: 'pointer', transition: 'all 0.15s' }}>
                                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: col.bg, color: col.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
                                    {initials(c.name)}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a' }}>{c.name}</div>
                                    {c.bio && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{c.bio}</div>}
                                  </div>
                                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: selected ? 'none' : '2px solid #ccc', background: selected ? '#378ADD' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {selected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}

                      {error && <p style={{ color: '#A32D2D', background: '#FCEBEB', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 12 }}>{error}</p>}

                      <button onClick={submitVote} disabled={submitting || !positions.every(p => selections[p.id])}
                        style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: positions.every(p => selections[p.id]) ? '#378ADD' : '#ccc',
                          color: '#fff', fontWeight: 600, fontSize: 16, cursor: positions.every(p => selections[p.id]) ? 'pointer' : 'not-allowed' }}>
                        {submitting ? 'Submitting…' : 'Submit ballot'}
                      </button>
                      <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 10 }}>This action cannot be undone. Your token will be permanently invalidated.</p>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
