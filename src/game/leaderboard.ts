// Online leaderboard (Supabase, shared project "houwelings-hub", tables sam_game_*).
// Only the public publishable key is used here: the table can be read by everyone,
// writing goes through two database functions that check the run (see supabase/sam_game_leaderboard.sql).
const URL = 'https://fjxlhvfimmlojjwuvbon.supabase.co';
const KEY = 'sb_publishable_5ZHXCGczOvH_X9bnE8ZE2g_sydqjk9C';
const headers = { apikey: KEY, 'Content-Type': 'application/json' };

export interface Entry { name: string; score: number; musician: string | null; created_at: string; id?: number }

async function rpc<T>(fn: string, body: unknown): Promise<T> {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${fn}: ${r.status}`);
  return r.json();
}

/** Called when a level starts: returns a ticket that the score must be sent with. */
export function startRun(level: string): Promise<string> {
  return rpc<string>('sam_game_start', { p_level: level });
}

export function submitScore(run: string, name: string, score: number, coins: number, deaths: number, musician: string): Promise<number> {
  return rpc<number>('sam_game_submit', { p_run: run, p_name: name, p_score: score, p_coins: coins, p_deaths: deaths, p_musician: musician });
}

export async function topScores(level: string, limit = 10): Promise<(Entry & { id: number })[]> {
  const q = `level=eq.${encodeURIComponent(level)}&select=id,name,score,musician,created_at&order=score.desc,created_at.asc&limit=${limit}`;
  const r = await fetch(`${URL}/rest/v1/sam_game_scores?${q}`, { headers });
  if (!r.ok) throw new Error(`top: ${r.status}`);
  return r.json();
}

/** Rank (1 = best) of a score that is already saved. */
export async function rankOf(level: string, score: number): Promise<number | null> {
  const r = await fetch(`${URL}/rest/v1/sam_game_scores?level=eq.${encodeURIComponent(level)}&score=gt.${score}&select=id`, {
    method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' },
  });
  const range = r.headers.get('content-range'); // like "0-4/5" or "*/0"
  const n = range ? Number(range.split('/')[1]) : NaN;
  return Number.isFinite(n) ? n + 1 : null;
}

const NAME_KEY = 'sam-game-name';
export function savedName(): string { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
export function saveName(n: string) { try { localStorage.setItem(NAME_KEY, n); } catch {} }
/** Same rules as the database: 1 to 16 letters, digits, spaces and a few signs. */
export function cleanName(n: string): string {
  return n.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} _.!?'-]/gu, '').trim().slice(0, 16);
}
