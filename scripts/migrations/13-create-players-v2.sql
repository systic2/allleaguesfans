-- Create players_v2 table
-- This replaces the legacy 'players' table and references 'teams_v2' correctly.

CREATE TABLE IF NOT EXISTS players_v2 (
    "idPlayer" TEXT PRIMARY KEY,
    "idTeam" TEXT REFERENCES teams_v2(id) ON DELETE CASCADE, -- References new teams_v2 table
    "strTeam" TEXT,
    "strPlayer" TEXT,
    "strPosition" TEXT,
    "strNumber" TEXT,
    "strNationality" TEXT,
    "strHeight" TEXT,
    "strWeight" TEXT,
    "dateBorn" DATE,
    "strThumb" TEXT,
    "strBirthLocation" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on idTeam for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_v2_team ON players_v2("idTeam");
