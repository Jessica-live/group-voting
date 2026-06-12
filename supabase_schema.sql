-- ============================================================
--  Voting System — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. POSITIONS  (President, VP, etc. — add more any time)
create table positions (
  id          serial primary key,
  title       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);

-- 2. CANDIDATES  (one row per person per position)
create table candidates (
  id          serial primary key,
  position_id int  not null references positions(id) on delete cascade,
  name        text not null,
  bio         text,
  created_at  timestamptz default now()
);

-- 3. VOTE TOTALS  (public — anyone can read; never reveals who voted for whom)
create table vote_totals (
  candidate_id  int primary key references candidates(id) on delete cascade,
  total         int not null default 0
);

-- 4. TOKENS  (one per group; admins can see status, NOT vote choices)
create table tokens (
  id          serial primary key,
  token       text unique not null,
  group_name  text not null,
  is_used     boolean not null default false,
  used_at     timestamptz,
  created_at  timestamptz default now()
);

-- 5. AUDIT LOG  (optional — stores that a token was used, never what was chosen)
--    Useful for detecting if someone tampers with the DB.
create table audit_log (
  id          serial primary key,
  event       text not null,   -- e.g. 'VOTE_CAST', 'TOKEN_CREATED'
  token_id    int  references tokens(id),
  created_at  timestamptz default now()
  -- NOTE: no candidate_id here — that is deliberate.
);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

alter table positions   enable row level security;
alter table candidates  enable row level security;
alter table vote_totals enable row level security;
alter table tokens      enable row level security;
alter table audit_log   enable row level security;

-- Public can read positions, candidates, vote totals (live tally)
create policy "Public read positions"   on positions   for select using (true);
create policy "Public read candidates"  on candidates  for select using (true);
create policy "Public read vote_totals" on vote_totals for select using (true);

-- Only service role (your API) can write to any table
create policy "Service write positions"   on positions   for all using (auth.role() = 'service_role');
create policy "Service write candidates"  on candidates  for all using (auth.role() = 'service_role');
create policy "Service write vote_totals" on vote_totals for all using (auth.role() = 'service_role');
create policy "Service write tokens"      on tokens      for all using (auth.role() = 'service_role');
create policy "Service write audit"       on audit_log   for all using (auth.role() = 'service_role');

-- ============================================================
--  ATOMIC VOTE FUNCTION  (runs as a single DB transaction)
--  This is the core of anonymity: token is invalidated AND
--  vote totals are incremented in ONE call — no separate
--  readable record links token → candidate.
-- ============================================================

create or replace function cast_vote(
  p_token      text,
  p_votes      jsonb   -- [{"candidate_id": 3}, {"candidate_id": 7}, ...]
)
returns jsonb
language plpgsql
security definer   -- runs as superuser inside the function only
as $$
declare
  v_token_row tokens%rowtype;
  v_vote       jsonb;
  v_cand_id    int;
begin
  -- 1. Lock and fetch the token row
  select * into v_token_row
  from tokens
  where token = p_token
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Token not found');
  end if;

  if v_token_row.is_used then
    return jsonb_build_object('ok', false, 'error', 'Token already used');
  end if;

  -- 2. Mark token as used (we do NOT store which candidates were chosen)
  update tokens
  set is_used = true, used_at = now()
  where id = v_token_row.id;

  -- 3. Increment each candidate's total
  for v_vote in select * from jsonb_array_elements(p_votes)
  loop
    v_cand_id := (v_vote->>'candidate_id')::int;

    insert into vote_totals (candidate_id, total)
    values (v_cand_id, 1)
    on conflict (candidate_id)
    do update set total = vote_totals.total + 1;
  end loop;

  -- 4. Write audit entry (token used — no vote details)
  insert into audit_log (event, token_id)
  values ('VOTE_CAST', v_token_row.id);

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
--  SEED DATA — 4 starting positions + sample candidates
-- ============================================================

insert into positions (title, sort_order) values
  ('President',       1),
  ('Vice President',  2),
  ('Secretary',       3),
  ('Treasurer',       4);

-- After inserting positions, add your real candidates like:
-- insert into candidates (position_id, name) values (1, 'Candidate Name');
-- Then run: insert into vote_totals (candidate_id) select id from candidates;
