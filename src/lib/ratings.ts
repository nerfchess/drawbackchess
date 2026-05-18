// Persistent ratings via Supabase. Reads / writes the `player_ratings`
// table (see supabase-setup.sql). All operations are graceful: if the
// table doesn't exist (user hasn't run the setup SQL yet) we fall back to
// the default rating and never throw, so the app keeps working without
// rated games being persisted.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/multiplayer";
import { DEFAULT_RATING, type Rating, updateRating } from "@/lib/glicko";

let _client: any = null;
function client() {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

export interface PlayerRating extends Rating {
  id: string;
  name: string;
  gamesPlayed: number;
}

function rowToRating(row: any): PlayerRating | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    rating: row.rating ?? DEFAULT_RATING.rating,
    rd: row.rd ?? DEFAULT_RATING.rd,
    vol: row.vol ?? DEFAULT_RATING.vol,
    gamesPlayed: row.games_played ?? 0,
  };
}

export async function fetchRating(id: string): Promise<PlayerRating | null> {
  try {
    const { data, error } = await client()
      .from("player_ratings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[ratings] fetch error:", error.message);
      return null;
    }
    return rowToRating(data);
  } catch (e) {
    console.warn("[ratings] fetch failed:", e);
    return null;
  }
}

export async function fetchRatings(ids: string[]): Promise<Record<string, PlayerRating>> {
  const out: Record<string, PlayerRating> = {};
  if (ids.length === 0) return out;
  try {
    const { data, error } = await client()
      .from("player_ratings")
      .select("*")
      .in("id", ids);
    if (error) {
      console.warn("[ratings] fetch-many error:", error.message);
      return out;
    }
    for (const row of data ?? []) {
      const r = rowToRating(row);
      if (r) out[r.id] = r;
    }
  } catch (e) {
    console.warn("[ratings] fetch-many failed:", e);
  }
  return out;
}

export async function upsertRating(p: PlayerRating): Promise<void> {
  try {
    const { error } = await client()
      .from("player_ratings")
      .upsert(
        {
          id: p.id,
          name: p.name,
          rating: p.rating,
          rd: p.rd,
          vol: p.vol,
          games_played: p.gamesPlayed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    if (error) console.warn("[ratings] upsert error:", error.message);
  } catch (e) {
    console.warn("[ratings] upsert failed:", e);
  }
}

/**
 * Apply a Glicko-2 update for a finished game and persist both sides.
 * `myScore`: 1 = I won, 0.5 = draw, 0 = I lost.
 * Returns `{ me, opp }` with the new ratings, even if the database write
 * failed (so the UI can still show the local-only result).
 */
export async function recordGameResult(
  meId: string,
  meName: string,
  oppId: string,
  oppName: string,
  myScore: 0 | 0.5 | 1,
): Promise<{ me: PlayerRating; opp: PlayerRating; oldMe: Rating; oldOpp: Rating }> {
  const [mePrev, oppPrev] = await Promise.all([fetchRating(meId), fetchRating(oppId)]);

  const oldMe: Rating = mePrev ?? { ...DEFAULT_RATING };
  const oldOpp: Rating = oppPrev ?? { ...DEFAULT_RATING };

  const newMe = updateRating(oldMe, oldOpp, myScore);
  const oppScore = (1 - myScore) as 0 | 0.5 | 1;
  const newOpp = updateRating(oldOpp, oldMe, oppScore);

  const meRow: PlayerRating = {
    id: meId,
    name: meName,
    ...newMe,
    gamesPlayed: (mePrev?.gamesPlayed ?? 0) + 1,
  };
  const oppRow: PlayerRating = {
    id: oppId,
    name: oppName,
    ...newOpp,
    gamesPlayed: (oppPrev?.gamesPlayed ?? 0) + 1,
  };

  // Both sides write — eventual consistency is fine because each player
  // also writes from their own browser; we just take the latest.
  await Promise.all([upsertRating(meRow), upsertRating(oppRow)]);

  return { me: meRow, opp: oppRow, oldMe, oldOpp };
}
