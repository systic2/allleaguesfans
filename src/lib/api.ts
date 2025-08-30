import { supabase } from "./supabaseClient";
import type { League, Team, Player, SearchRow } from "./types";

export async function fetchLeagues(): Promise<League[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .order("tier", { ascending: true })
    .order("name");
  if (error) throw error;
  return data as League[];
}

export async function fetchTeamsByLeague(leagueId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("league_id", leagueId)
    .order("name");
  if (error) throw error;
  return data as Team[];
}

export async function fetchPlayersByTeam(teamId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamId)
    .order("name");
  if (error) throw error;
  return data as Player[];
}

export async function fetchPlayer(playerId: string): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();
  if (error) throw error;
  return data as Player;
}

export async function searchByName(q: string): Promise<SearchRow[]> {
  if (!q.trim()) return [];
  const { data, error } = await supabase
    .from("search_index")
    .select("*")
    .ilike("name", `%${q}%`)
    .limit(10);
  if (error) throw error;
  return data as SearchRow[];
}
