-- Add data_source column to track data source (api_football vs kleague_official)
ALTER TABLE top_scorers ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'api_football';
ALTER TABLE top_assists ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'api_football';

-- Create indexes for data_source queries
CREATE INDEX IF NOT EXISTS idx_top_scorers_data_source ON top_scorers(data_source);
CREATE INDEX IF NOT EXISTS idx_top_assists_data_source ON top_assists(data_source);

-- Update existing records to have api_football as data source
UPDATE top_scorers SET data_source = 'api_football' WHERE data_source IS NULL;
UPDATE top_assists SET data_source = 'api_football' WHERE data_source IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN top_scorers.data_source IS 'Data source: api_football or kleague_official';
COMMENT ON COLUMN top_assists.data_source IS 'Data source: api_football or kleague_official';