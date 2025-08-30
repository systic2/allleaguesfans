export type League = {
  id: string;
  name: string;
  country: string | null;
  tier: number | null;
  logo_url: string | null;
};
export type Team = {
  id: string;
  league_id: string;
  name: string;
  short_name: string | null;
  stadium: string | null;
  logo_url: string | null;
};
export type Player = {
  id: string;
  team_id: string;
  name: string;
  position: string | null;
  nationality: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  preferred_foot: string | null;
  photo_url: string | null;
  market_value_eur: number | null;
};
export type SearchRow = {
  type: "team" | "player";
  entity_id: string;
  name: string;
};
