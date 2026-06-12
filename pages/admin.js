import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'

export default function Admin() {
  const [secret, setSecret]     = useState('')
  const [authed, setAuthed]     = useState(false)
  const [authErr, setAuthErr]   = useState('')
  const [data, setData]         = useState(null)
  const [tab, setTab]           = useState('clubs')
  const [msg, setMsg]           = useState('')
  const [search, setSearch]     = useState('')
  const [editingClub, setEditingClub] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Add club form
  const [newClubFull, setNewClubFull]   = useState('')
  const [newClubShort, setNewClubShort] = useState('')
  const [newClubEligible, setNewClubEligible] = useState(true)

  // Voting window
  const [votingStart, setVotingStart] = useState('')
  const [votingEnd, setVotingEnd]     = useState('')
  const [windowSaved, setWindowSaved] = useState(false)

  // Add position form
  const [newPos, setNewPos] = useState('')

  // Add candidate form
  const [newCandPos, setNewCandPos]     = useState('')
  const [newCandName, setNewCandName]   = useState('')
  const [newCandBio, setNewCandBio]     = useState('')
  const [newCandClub, setNewCandClub]   = useState('')       // selected club name
  const [clubSearch, setClubSearch]     = useState('')       // search text in dropdown
  const [showClubDrop, setShowClubDrop] = useState(false)   // dropdown open?
  const dropRef = useRef(null)

  const headers = useCallback(() => ({ 'Content-Type': 'application/json', 'x-admin-secret': secret }), [secret])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin?action=dashboard', { headers: headers() })
    if (res.status === 401) { setAuthed(false); return }
    setData(await res.json())
  }, [headers])

  const login = async () => {
    setAuthErr('')
    const res = await fetch('/api/admin?action=dashboard', { headers: headers() })
    if (res.ok) { setAuthed(true); const d = await res.json(); setData(d); loadWindow(d) }
    else setAuthErr('Incorrect password')
  }

  useEffect(() => { if (authed) load() }, [authed, load])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowClubDrop(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const loadWindow = async () => {
    const res = await fetch('/api/admin?action=voting-window', { headers: headers() })
    if (!res.ok) return
    const d = await res.json()
    if (d.voting_start) setVotingStart(d.voting_start.slice(0,16))
    if (d.voting_end)   setVotingEnd(d.voting_end.slice(0,16))
  }

  const saveWindow = async () => {
    const res = await fetch('/api/admin?action=voting-window', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        voting_start: votingStart ? new Date(votingStart).toISOString() : null,
        voting_end:   votingEnd   ? new Date(votingEnd).toISOString()   : null,
      })
    })
    const d = await res.json()
    if (d.ok) { setWindowSaved(true); setTimeout(() => setWindowSaved(false), 3000); flash('Voting window saved') }
    else flash('Error: ' + d.error)
  }

  const clearWindow = async () => {
    const res = await fetch('/api/admin?action=voting-window', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ voting_start: null, voting_end: null })
    })
    if ((await res.json()).ok) { setVotingStart(''); setVotingEnd(''); flash('Voting window cleared — voting is now always open') }
  }

  const generateTokens = async () => {
    if (!confirm('Generate real tokens for all pending clubs?')) return
    const res = await fetch('/api/admin?action=generate-tokens', { method: 'POST', headers: headers(), body: JSON.stringify({}) })
    const d = await res.json()
    if (d.ok || d.tokens) { flash('Tokens generated successfully'); load() }
    else flash('Error: ' + d.error)
  }

  const toggleVoting = async (id, current) => {
    const res = await fetch('/api/admin?action=toggle-voting', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ id, can_vote: !current })
    })
    if ((await res.json()).ok) { flash('Voting eligibility updated'); load() }
  }

  const startEdit = (g) => {
    setEditingClub(g.id)
    setEditForm({ group_name: g.group_name, full_name: g.full_name || g.group_name, short_name: g.short_name || '' })
  }

  const saveEdit = async (id) => {
    const res = await fetch('/api/admin?action=update-group', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ id, ...editForm })
    })
    if ((await res.json()).ok) { setEditingClub(null); flash('Club updated'); load() }
  }

  const resetToken = async (id) => {
    if (!confirm('Reset this token so the club can vote again?')) return
    const res = await fetch('/api/admin?action=reset-token', { method: 'POST', headers: headers(), body: JSON.stringify({ id }) })
    if ((await res.json()).ok) { flash('Token reset'); load() }
  }

  const addClub = async () => {
    if (!newClubFull.trim()) return
    const res = await fetch('/api/admin?action=add-club', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ full_name: newClubFull.trim(), short_name: newClubShort.trim(), can_vote: newClubEligible })
    })
    const d = await res.json()
    if (d.ok) { setNewClubFull(''); setNewClubShort(''); setNewClubEligible(true); flash('Club added — token generated'); load() }
    else flash('Error: ' + d.error)
  }

  const addPosition = async () => {
    if (!newPos.trim()) return
    const res = await fetch('/api/admin?action=add-position', { method: 'POST', headers: headers(), body: JSON.stringify({ title: newPos.trim() }) })
    const d = await res.json()
    if (d.position) { setNewPos(''); flash('Position added'); load() }
  }

  const deletePosition = async (id) => {
    if (!confirm('Delete this position and all its candidates?')) return
    await fetch('/api/admin?action=delete-position', { method: 'DELETE', headers: headers(), body: JSON.stringify({ id }) })
    flash('Position deleted'); load()
  }

  const addCandidate = async () => {
    if (!newCandPos || !newCandName.trim()) return
    const res = await fetch('/api/admin?action=add-candidate', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ position_id: parseInt(newCandPos), name: newCandName.trim(), bio: newCandBio.trim(), club_name: newCandClub })
    })
    const d = await res.json()
    if (d.candidate) { setNewCandName(''); setNewCandBio(''); setNewCandClub(''); setClubSearch(''); flash('Candidate added'); load() }
    else flash('Error: ' + d.error)
  }

  const deleteCandidate = async (id) => {
    if (!confirm('Remove this candidate?')) return
    await fetch('/api/admin?action=delete-candidate', { method: 'DELETE', headers: headers(), body: JSON.stringify({ id }) })
    flash('Candidate removed'); load()
  }

  const S = {
    card:  { background: '#fff', border: '1px solid #e8e8e4', borderRadius: 14, padding: '20px 22px', marginBottom: 16 },
    input: { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, color: '#1a1a1a', background: '#fff' },
    btn:   (c='#378ADD') => ({ padding: '7px 16px', borderRadius: 8, border: 'none', background: c, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }),
    label: { fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, display: 'block' },
  }

  const tokens = data?.tokens || []
  const filteredTokens = tokens.filter(t =>
    !search || t.full_name?.toLowerCase().includes(search.toLowerCase()) || t.short_name?.toLowerCase().includes(search.toLowerCase())
  )

  // Clubs list for candidate search dropdown
  const allClubs = tokens.map(t => t.full_name || t.group_name).filter(Boolean).sort()
  const filteredClubs = allClubs.filter(c => c.toLowerCase().includes(clubSearch.toLowerCase()))

  const canVoteCount = tokens.filter(t => t.can_vote).length
  const votedCount   = tokens.filter(t => t.is_used).length
  const pendingCount = tokens.filter(t => t.token?.startsWith('PENDING')).length

  if (!authed) return (
    <div style={{ minHeight:'100vh', background:'#f8f8f6', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui' }}>
      <div style={{ ...S.card, width:340 }}>
        <h2 style={{ fontSize:18, fontWeight:600, marginBottom:4 }}>Admin login</h2>
        <p style={{ fontSize:13, color:'#888', marginBottom:20 }}>Club Elections admin panel</p>
        <input type="password" placeholder="Admin password" value={secret} onChange={e => setSecret(e.target.value)}
          onKeyDown={e => e.key==='Enter' && login()} style={{ ...S.input, width:'100%', marginBottom:12 }} />
        {authErr && <p style={{ color:'#A32D2D', fontSize:13, marginBottom:10 }}>{authErr}</p>}
        <button onClick={login} style={{ ...S.btn(), width:'100%', padding:10 }}>Sign in</button>
      </div>
    </div>
  )

  return (
    <>
      <Head><title>Admin — Club Elections</title></Head>
      <div style={{ minHeight:'100vh', background:'#f8f8f6', fontFamily:'system-ui' }}>
        <header style={{ background:'#fff', borderBottom:'1px solid #e8e8e4', padding:'0 24px' }}>
          <div style={{ maxWidth:1000, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
            <span style={{ fontWeight:600, fontSize:17 }}>🛡️ Admin panel</span>
            <div style={{ display:'flex', gap:6 }}>
              {['clubs','positions','candidates','window'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding:'6px 16px', borderRadius:8, fontSize:13, cursor:'pointer',
                  border: tab===t ? '1.5px solid #378ADD' : '1px solid #ddd',
                  background: tab===t ? '#E6F1FB' : '#fff',
                  color: tab===t ? '#185FA5' : '#555', fontWeight: tab===t ? 600 : 400,
                }}>
                  {t === 'clubs' ? '🏏 Clubs' : t === 'positions' ? '📋 Positions' : t === 'candidates' ? '🙋 Candidates' : '🕐 Voting Window'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {msg && <div style={{ background:'#EAF3DE', color:'#3B6D11', padding:'10px 24px', fontSize:14, textAlign:'center' }}>{msg}</div>}

        <main style={{ maxWidth:1000, margin:'0 auto', padding:'28px 24px' }}>

          {/* ── CLUBS TAB ─────────────────────────────────────── */}
          {tab === 'clubs' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
                {[
                  { label:'Total clubs', value: tokens.length },
                  { label:'Eligible to vote', value: canVoteCount, color:'#3B6D11' },
                  { label:'Not eligible', value: tokens.length - canVoteCount, color:'#A32D2D' },
                  { label:'Voted so far', value: votedCount, color:'#185FA5' },
                ].map(s => (
                  <div key={s.label} style={{ ...S.card, marginBottom:0 }}>
                    <div style={{ fontSize:26, fontWeight:600, color: s.color||'#1a1a1a' }}>{s.value}</div>
                    <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={S.card}>
                <span style={S.label}>Add a new club</span>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <input value={newClubFull} onChange={e => setNewClubFull(e.target.value)}
                    placeholder="Full club name e.g. Brisbane Sikh United"
                    style={{ ...S.input, flex:2, minWidth:200 }} />
                  <input value={newClubShort} onChange={e => setNewClubShort(e.target.value)}
                    placeholder="Short name e.g. BSU" style={{ ...S.input, width:130 }} />
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, color:'#555', cursor:'pointer' }}>
                    <input type="checkbox" checked={newClubEligible} onChange={e => setNewClubEligible(e.target.checked)} />
                    Eligible to vote
                  </label>
                  <button onClick={addClub} style={S.btn('#639922')}>Add club</button>
                </div>
              </div>

              <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search clubs..." style={{ ...S.input, width:240 }} />
                {pendingCount > 0 && (
                  <button onClick={generateTokens} style={S.btn('#639922')}>
                    Generate tokens for {pendingCount} pending clubs
                  </button>
                )}
                <span style={{ fontSize:13, color:'#888', marginLeft:'auto' }}>{filteredTokens.length} of {tokens.length} clubs shown</span>
              </div>

              <div style={{ background:'#E6F1FB', border:'1px solid #B5D4F4', borderRadius:10, padding:'10px 16px', fontSize:13, color:'#0C447C', marginBottom:16 }}>
                💡 Toggle the <strong>Eligible</strong> switch to control who can vote. Click <strong>Edit</strong> to update club names.
              </div>

              <div style={S.card}>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ borderBottom:'2px solid #e8e8e4' }}>
                        {['#','Full name','Short name','Token','Status','Eligible','Voted','Actions'].map(h => (
                          <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:'#888', fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTokens.map((t) => (
                        <tr key={t.id} style={{ borderBottom:'1px solid #f0f0ec', background: editingClub===t.id ? '#f8f4ff' : 'transparent' }}>
                          <td style={{ padding:'8px 10px', color:'#aaa', fontSize:12 }}>{tokens.indexOf(t)+1}</td>
                          {editingClub === t.id ? (
                            <>
                              <td style={{ padding:'8px 10px' }}>
                                <input value={editForm.full_name} onChange={e => setEditForm(f=>({...f,full_name:e.target.value}))}
                                  style={{ ...S.input, width:'100%', fontSize:13 }} />
                              </td>
                              <td style={{ padding:'8px 10px' }}>
                                <input value={editForm.short_name} onChange={e => setEditForm(f=>({...f,short_name:e.target.value}))}
                                  style={{ ...S.input, width:100, fontSize:13 }} />
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding:'8px 10px', fontWeight:500, color:'#1a1a1a', maxWidth:280 }}>{t.full_name || t.group_name}</td>
                              <td style={{ padding:'8px 10px', color:'#555', fontFamily:'monospace', fontSize:12 }}>{t.short_name || '—'}</td>
                            </>
                          )}
                          <td style={{ padding:'8px 10px' }}>
                            {t.token?.startsWith('PENDING')
                              ? <span style={{ background:'#FAEEDA', color:'#854F0B', fontSize:11, padding:'2px 8px', borderRadius:6, fontWeight:600 }}>PENDING</span>
                              : <span style={{ fontFamily:'monospace', fontSize:12, color:'#555' }}>{t.token}</span>}
                          </td>
                          <td style={{ padding:'8px 10px' }}>
                            {t.can_vote
                              ? <span style={{ background:'#EAF3DE', color:'#3B6D11', fontSize:11, padding:'2px 8px', borderRadius:6, fontWeight:600 }}>Eligible</span>
                              : <span style={{ background:'#FCEBEB', color:'#A32D2D', fontSize:11, padding:'2px 8px', borderRadius:6, fontWeight:600 }}>Not eligible</span>}
                          </td>
                          <td style={{ padding:'8px 10px', textAlign:'center' }}>
                            <div onClick={() => toggleVoting(t.id, t.can_vote)} style={{ width:40, height:22, borderRadius:99, cursor:'pointer', transition:'all 0.2s', background: t.can_vote ? '#639922' : '#ddd', position:'relative', display:'inline-block' }}>
                              <div style={{ position:'absolute', top:3, left: t.can_vote ? 21 : 3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'all 0.2s' }} />
                            </div>
                          </td>
                          <td style={{ padding:'8px 10px', textAlign:'center' }}>
                            {t.is_used ? <span style={{ color:'#3B6D11', fontSize:16 }}>✓</span> : <span style={{ color:'#ccc', fontSize:12 }}>—</span>}
                          </td>
                          <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                            {editingClub === t.id ? (
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => saveEdit(t.id)} style={{ ...S.btn('#639922'), padding:'4px 10px' }}>Save</button>
                                <button onClick={() => setEditingClub(null)} style={{ ...S.btn('#888'), padding:'4px 10px' }}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => startEdit(t)} style={{ ...S.btn('#378ADD'), padding:'4px 10px' }}>Edit</button>
                                {t.is_used && <button onClick={() => resetToken(t.id)} style={{ ...S.btn('#888'), padding:'4px 10px' }}>Reset</button>}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── POSITIONS TAB ──────────────────────────────────── */}
          {tab === 'positions' && (
            <>
              <div style={S.card}>
                <span style={S.label}>Add a new position</span>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={newPos} onChange={e => setNewPos(e.target.value)} placeholder="e.g. Events Chair"
                    onKeyDown={e => e.key==='Enter' && addPosition()} style={{ ...S.input, flex:1 }} />
                  <button onClick={addPosition} style={S.btn()}>Add position</button>
                </div>
              </div>
              {(data?.positions||[]).map(p => (
                <div key={p.id} style={{ ...S.card, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight:500, color:'#1a1a1a' }}>{p.title}</div>
                    <div style={{ fontSize:12, color:'#aaa', marginTop:2 }}>Sort order: {p.sort_order}</div>
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
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

                  {/* Position select */}
                  <select value={newCandPos} onChange={e => setNewCandPos(e.target.value)} style={S.input}>
                    <option value="">Select position…</option>
                    {(data?.positions||[]).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>

                  {/* Name */}
                  <input value={newCandName} onChange={e => setNewCandName(e.target.value)}
                    placeholder="Candidate full name" style={S.input} />

                  {/* Club searchable dropdown */}
                  <div ref={dropRef} style={{ position:'relative' }}>
                    <div style={{ position:'relative' }}>
                      <input
                        value={newCandClub || clubSearch}
                        onChange={e => { setClubSearch(e.target.value); setNewCandClub(''); setShowClubDrop(true) }}
                        onFocus={() => setShowClubDrop(true)}
                        placeholder="🔍  Search and select club name…"
                        style={{ ...S.input, width:'100%', paddingRight:32 }}
                      />
                      {newCandClub && (
                        <button onClick={() => { setNewCandClub(''); setClubSearch('') }}
                          style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#aaa' }}>✕</button>
                      )}
                    </div>
                    {showClubDrop && filteredClubs.length > 0 && !newCandClub && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #ddd', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', zIndex:100, maxHeight:220, overflowY:'auto', marginTop:4 }}>
                        {filteredClubs.map(club => (
                          <div key={club} onClick={() => { setNewCandClub(club); setClubSearch(''); setShowClubDrop(false) }}
                            style={{ padding:'10px 14px', cursor:'pointer', fontSize:14, color:'#1a1a1a', borderBottom:'1px solid #f5f5f5' }}
                            onMouseEnter={e => e.currentTarget.style.background='#f0f7ff'}
                            onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                            {club}
                          </div>
                        ))}
                      </div>
                    )}
                    {newCandClub && (
                      <div style={{ marginTop:4, fontSize:13, color:'#3B6D11', padding:'4px 8px', background:'#EAF3DE', borderRadius:6, display:'inline-block' }}>
                        ✓ {newCandClub}
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  <input value={newCandBio} onChange={e => setNewCandBio(e.target.value)}
                    placeholder="Short bio (optional)" style={S.input} />

                  <button onClick={addCandidate} style={S.btn()}>Add candidate</button>
                </div>
              </div>

              {/* Candidate list per position */}
              {(data?.positions||[]).map(pos => {
                const cands = (data?.candidates||[]).filter(c => c.position_id === pos.id)
                return (
                  <div key={pos.id} style={S.card}>
                    <span style={S.label}>{pos.title} ({cands.length} candidates)</span>
                    {cands.length === 0 && <p style={{ color:'#bbb', fontSize:14 }}>No candidates yet</p>}
                    {cands.map(c => (
                      <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f0f0ec' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:500, color:'#1a1a1a', fontSize:14 }}>{c.name}</div>
                          {c.club_name && (
                            <div style={{ fontSize:12, color:'#185FA5', marginTop:2, background:'#E6F1FB', display:'inline-block', padding:'1px 8px', borderRadius:99 }}>
                              {c.club_name}
                            </div>
                          )}
                          {c.bio && <div style={{ fontSize:12, color:'#aaa', marginTop:3 }}>{c.bio}</div>}
                        </div>
                        <div style={{ fontWeight:600, color:'#378ADD', fontSize:15 }}>
                          {(data?.totals||[]).find(t => t.candidate_id === c.id)?.total || 0} votes
                        </div>
                        <button onClick={() => deleteCandidate(c.id)} style={{ ...S.btn('#E24B4A'), padding:'5px 12px' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}
          {/* ── VOTING WINDOW TAB ────────────────────────────── */}
          {tab === 'window' && (
            <>
              <div style={{ ...S.card, maxWidth: 560 }}>
                <span style={S.label}>Set the voting time window</span>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
                  Clubs can only submit votes between the start and end times you set here. Leave both blank to allow voting at any time.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ ...S.label, marginBottom: 6 }}>Voting opens (start time)</label>
                    <input type="datetime-local" value={votingStart} onChange={e => setVotingStart(e.target.value)}
                      style={{ ...S.input, width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ ...S.label, marginBottom: 6 }}>Voting closes (end time)</label>
                    <input type="datetime-local" value={votingEnd} onChange={e => setVotingEnd(e.target.value)}
                      style={{ ...S.input, width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button onClick={saveWindow} style={{ ...S.btn('#378ADD'), flex: 1, padding: 10 }}>
                      {windowSaved ? '✓ Saved!' : 'Save window'}
                    </button>
                    <button onClick={clearWindow} style={{ ...S.btn('#888'), padding: '10px 20px' }}>
                      Clear (always open)
                    </button>
                  </div>
                </div>
              </div>

              {/* Current status card */}
              <div style={{ ...S.card, maxWidth: 560, background: '#f8f8f6' }}>
                <span style={S.label}>Current status</span>
                {!votingStart && !votingEnd ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#639922', display: 'inline-block' }} />
                    <span style={{ color: '#3B6D11', fontWeight: 500 }}>Voting is always open</span>
                  </div>
                ) : (() => {
                  const now = new Date()
                  const start = votingStart ? new Date(votingStart) : null
                  const end   = votingEnd   ? new Date(votingEnd)   : null
                  const isOpen = (!start || now >= start) && (!end || now <= end)
                  const notStarted = start && now < start
                  const closed = end && now > end
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, marginBottom: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: notStarted ? '#F5A623' : closed ? '#E24B4A' : '#639922', display: 'inline-block' }} />
                        <span style={{ fontWeight: 600, color: notStarted ? '#854F0B' : closed ? '#A32D2D' : '#3B6D11' }}>
                          {notStarted ? 'Voting not yet open' : closed ? 'Voting is closed' : 'Voting is open'}
                        </span>
                      </div>
                      {votingStart && <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>🟢 Opens: <strong>{new Date(votingStart).toLocaleString()}</strong></p>}
                      {votingEnd   && <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>🔴 Closes: <strong>{new Date(votingEnd).toLocaleString()}</strong></p>}
                    </div>
                  )
                })()}
              </div>
            </>
          )}

        </main>
      </div>
    </>
  )
}
