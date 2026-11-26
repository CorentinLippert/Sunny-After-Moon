-- Sunny After Moon game leaderboard, in the Supabase project "houwelings-hub".
-- Applied as migration "sam_game_leaderboard". Separate tables (prefix sam_game_), nothing else is touched.
-- Reading: anyone (publishable key). Writing: only through sam_game_start / sam_game_submit, which check
-- that a level was really started, that at least the song length went by, and that name and score make sense.

create table public.sam_game_runs (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  started_at timestamptz not null default now(),
  used boolean not null default false
);
create index sam_game_runs_started on public.sam_game_runs (started_at);

create table public.sam_game_scores (
  id bigint generated always as identity primary key,
  level text not null check (level in ('balkan-booby')),
  name text not null check (char_length(name) between 1 and 16),
  score integer not null check (score between 0 and 100000),
  coins integer not null default 0 check (coins between 0 and 10000),
  deaths integer not null default 0 check (deaths between 0 and 1000),
  musician text check (char_length(musician) <= 16),
  created_at timestamptz not null default now()
);
create index sam_game_scores_top on public.sam_game_scores (level, score desc, created_at);

alter table public.sam_game_runs enable row level security;
alter table public.sam_game_scores enable row level security;
revoke all on public.sam_game_runs from anon, authenticated;
revoke all on public.sam_game_scores from anon, authenticated;
grant select on public.sam_game_scores to anon, authenticated;
create policy sam_game_scores_read on public.sam_game_scores for select to anon, authenticated using (true);

create or replace function public.sam_game_start(p_level text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_level is distinct from 'balkan-booby' then raise exception 'unknown level'; end if;
  if (select count(*) from public.sam_game_runs where started_at > now() - interval '1 minute') > 300 then
    raise exception 'too many runs, try again later';
  end if;
  delete from public.sam_game_runs where started_at < now() - interval '1 day';
  insert into public.sam_game_runs (level) values (p_level) returning id into v_id;
  return v_id;
end $$;

create or replace function public.sam_game_submit(p_run uuid, p_name text, p_score integer, p_coins integer, p_deaths integer, p_musician text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare r public.sam_game_runs; v_name text; v_secs double precision; v_id bigint;
begin
  select * into r from public.sam_game_runs where id = p_run for update;
  if not found or r.used then raise exception 'invalid run'; end if;
  update public.sam_game_runs set used = true where id = p_run;
  v_secs := extract(epoch from now() - r.started_at);
  -- the song takes 169 s to reach the finish line
  if v_secs < 160 or v_secs > 3 * 3600 then raise exception 'invalid run time'; end if;
  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) < 1 or char_length(v_name) > 16 or v_name !~ '^[[:alnum:] _.!?''-]+$' then
    raise exception 'invalid name';
  end if;
  if p_score is null or p_score < 0 or p_score > least(100000, 1000 + 160 * v_secs) then raise exception 'invalid score'; end if;
  if p_coins is null or p_coins < 0 or p_coins > 567 then raise exception 'invalid coins'; end if;
  if p_deaths is null or p_deaths < 0 or p_deaths > 1000 then raise exception 'invalid deaths'; end if;
  insert into public.sam_game_scores (level, name, score, coins, deaths, musician)
  values (r.level, v_name, p_score, p_coins, p_deaths, left(p_musician, 16))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.sam_game_start(text) from public;
revoke all on function public.sam_game_submit(uuid, text, integer, integer, integer, text) from public;
grant execute on function public.sam_game_start(text) to anon, authenticated;
grant execute on function public.sam_game_submit(uuid, text, integer, integer, integer, text) to anon, authenticated;
