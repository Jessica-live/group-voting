// pages/admin.js  —  Password-protected admin dashboard
// Access at: your-app.vercel.app/admin
import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

const GROUPS = Array.from({ length: 50 }, (_, i) => ({ name: `Group ${i + 1}` }))

export default function Admin() {
  const [secret, setSecret]       = useState('')
  const [authed, setAuthed]       = useState(false)
  const [authErr, setAuthErr]     = useState('')
  const [data, setData]           = useState(null)
  const [tab, setTab]             = useState('tokens')  // tokens | positions | candidates
  const [msg, setMsg]             = useState('')

  // Add position form
  const [newPos, setNewPos]       = useState('')
  // Add candidate form
  const [newCandPos, setNewCandPos] = useState('')
  const [newCandName, setNewCandName] = useState('')
  const [newCandBio, setNewCandBio]  = useState('')

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-admin-secret': secret,
  }), [secret])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin?action=dashboard', { headers: headers() })
    if (res.status === 401) { setAuthed(false); setAuthErr('Session expired'); return }
    const d = await res.json()
    setData(d)
  }, [headers])

  const login = async () => {
    setAuthErr('')
    const res = await fetch('/api/admin?action=dashboard', { headers: headers() })
    if (res.ok) { setAuthed(true); const d = await res.json(); setData(d) }
    else setAuthErr('Incorrect password')
  }

  useEffect(() => { if (authed) load() }, [authed, load])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const generateTokens = async () => {
    if (!confirm('Generate tokens for all 50 groups? This cannot be undone.')) return
    const res = await fetch('/api/admin?action=generate-tokens', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ groups: GROUPS }),
    })
    const d = await res.json()
    if (d.tokens) { flash(`${d.tokens.length} tokens generated`); load() }
    else flash('Error: ' + d.error)
  }

  const addPosition = async () => {
    if (!newPos.trim()) return
    const res = await fetch('/api/admin?action=add-position', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ title: newPos.trim() }),
    })
    const d = await res.json()
    if (d.position) { setNewPos(''); flash('Position added'); load() }
    else flash('Error: ' + d.error)
  }

  const deletePosition = async (id) => {
    if (!confirm('Delete this position and all its candidates?')) return
    const res = await fetch('/api/admin?action=delete-position', {
      method: 'DELETE', headers: headers(),
      body: JSON.stringify({ id }),
    })
    const d = await res.json()
    if (d.ok) { flash('Position deleted'); load() }
  }

  const addCandidate = async () => {
    if (!newCandPos || !newCandName.trim()) return
    const res = await fetch('/api/admin?action=add-candidate', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ position_id: parseInt(newCandPos), name: newCandName.trim(), bio: newCandBio.trim() }),
    })
    const d = await res.json()
    if (d.candidate) { setNewCandName(''); setNewCandBio(''); flash('Candidate added'); load() }
    else flash('Error: ' + d.error)
  }

  const deleteCandidate = async (id) => {
    if (!confirm('Remove this candidate?')) return
    const res = await fetch('/api/admin?action=delete-candidate', {
      method: 'DELETE', headers: headers(),
      body: JSON.stringify({ id }),
    })
    const d = await res.json()
    if (d.ok) { flash('Candidate removed'); load() }
  }

  const resetToken = async (id) => {
    if (!confirm('Reset this token so the group can vote again?')) return
    const res = await fetch('/api/admin?action=reset-token', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ id }),
    })
    const d = await res.json()
    if (d.ok) { flash('Token reset'); load() }
  }

  const S = {  // styles
    input:  { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, color: '#1a1a1a', background: '#fff', width: '100%' },
    btn:    (color='#378ADD') => ({ padding: '8px 18px', borderRadius: 8, border: 'none', background: color, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }),
    card:   { background: '#fff', border: '1px solid #e8e8e4', borderRadius: 14, padding: '20px 22px', marginBottom: 16 },
    label:  { fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, display: 'block' },
    row:    { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  }

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#f8f8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ ...S.card, width: 340 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Admin login</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Enter the admin password set in your Vercel environment variables.</p>
        <input type="password" placeholder="Admin password" value={secret} onChange={e => setSecret(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()} style={{ ...S.input, marginBottom: 12 }} />
        {authErr && <p style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>{authErr}</p>}
        <button onClick={login} style={{ ...S.btn(), width: '100%', padding: '10px' }}>Sign in</button>
      </div>
    </div>
  )

  const usedCount = data?.tokens?.filter(t => t.is_used).length || 0
  const totalTokens = data?.tokens?.length || 0

  return (
    <>
      <Head><title>Admin — Voting System</title></Head>
      <div style={{ minHeight: '100vh', background: '#f8f8f6', fontFamily: 'system-ui' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e8e8e4', padding: '0 24px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
            <span style={{ fontWeight: 600, fontSize: 17, color: '#1a1a1a' }}>🛡️ Admin panel</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['tokens','positions','candidates'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '6px 16px', borderRadius: 8, border: tab === t ? '1.5px solid #378ADD' : '1px solid #ddd',
                  background: tab === t ? '#E6F1FB' : '#fff', color: tab === t ? '#185FA5' : '#555',
                  fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontSize: 13,
                }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
          </div>
        </header>

        {msg && <div style={{ background: '#EAF3DE', color: '#3B6D11', padding: '10px 24px', fontSize: 14, textAlign: 'center' }}>{msg}</div>}

        <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>

          {/* ── TOKENS TAB ─────────────────────────────────────── */}
          {tab === 'tokens' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Total tokens', value: totalTokens },
                  { label: 'Voted', value: usedCount },
                  { label: 'Remaining', value: totalTokens - usedCount },
                ].map(s => (
                  <div key={s.label} style={{ ...S.card, marginBottom: 0 }}>
                    <div style={{ fontSize: 26, fontWeight: 600, color: '#1a1a1a' }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {totalTokens === 0 ? (
                <div style={S.card}>
                  <p style={{ color: '#888', fontSize: 14, marginBottom: 14 }}>No tokens yet. Generate tokens for all 50 groups to begin.</p>
                  <button onClick={generateTokens} style={S.btn()}>Generate 50 tokens</button>
                </div>
              ) : (
                <div style={S.card}>
                  <span style={S.label}>Group tokens — you can see status, not vote choices</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 8 }}>
                    {data.tokens.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: t.is_used ? '#fafaf8' : '#f4fbf4', border: '1px solid ' + (t.is_used ? '#e8e8e4' : '#C0DD97') }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.is_used ? '#ccc' : '#639922', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#1a1a1a' }}>{t.token}</div>
                          <div style={{ fontSize: 11, color: '#aaa' }}>{t.group_name} · {t.is_used ? 'voted' : 'active'}</div>
                        </div>
                        {t.is_used && (
                          <button onClick={() => resetToken(t.id)} title="Reset token" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', color: '#888' }}>Reset</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── POSITIONS TAB ──────────────────────────────────── */}
          {tab === 'positions' && (
            <>
              <div style={S.card}>
                <span style={S.label}>Add a new position</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newPos} onChange={e => setNewPos(e.target.value)} placeholder="e.g. Events Chair"
                    onKeyDown={e => e.key === 'Enter' && addPosition()} style={{ ...S.input }} />
                  <button onClick={addPosition} style={S.btn()}>Add</button>
                </div>
              </div>
              {(data?.positions || []).map(p => (
                <div key={p.id} style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#1a1a1a' }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: '#aaa' }}>Sort order: {p.sort_order} · {p.is_active ? 'Active' : 'Hidden'}</div>
                  </div>
                  <button onClick={() => deletePosition(p.id)} style={S.btn('#E24B4A')}>Delete</button>
                </div>
              ))}
            </>
          )}

          {/* ── CANDIDATES TAB ─────────────────────────────────── */}
          {tab === 'candidates' && (
            <>
              <div style={S.card}>
                <span style={S.label}>Add a candidate</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select value={newCandPos} onChange={e => setNewCandPos(e.target.value)} style={{ ...S.input }}>
                    <option value="">Select position…</option>
                    {(data?.positions || []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  <input value={newCandName} onChange={e => setNewCandName(e.target.value)} placeholder="Full name" style={S.input} />
                  <input value={newCandBio} onChange={e => setNewCandBio(e.target.value)} placeholder="Short bio (optional)" style={S.input} />
                  <button onClick={addCandidate} style={S.btn()}>Add candidate</button>
                </div>
              </div>
              {(data?.positions || []).map(pos => {
                const cands = (data?.candidates || []).filter(c => c.position_id === pos.id)
                return (
                  <div key={pos.id} style={S.card}>
                    <span style={S.label}>{pos.title} ({cands.length} candidates)</span>
                    {cands.length === 0 && <p style={{ color: '#bbb', fontSize: 14 }}>No candidates yet</p>}
                    {cands.map(c => (
                      <div key={c.id} style={{ ...S.row, padding: '8px 0', borderBottom: '1px solid #f0f0ec' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, color: '#1a1a1a', fontSize: 14 }}>{c.name}</div>
                          {c.bio && <div style={{ fontSize: 12, color: '#aaa' }}>{c.bio}</div>}
                        </div>
                        <div style={{ fontWeight: 600, color: '#378ADD', fontSize: 15 }}>{(data?.totals || []).find(t => t.candidate_id === c.id)?.total || 0} votes</div>
                        <button onClick={() => deleteCandidate(c.id)} style={{ ...S.btn('#E24B4A'), padding: '5px 12px' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </main>
      </div>
    </>
  )
}
