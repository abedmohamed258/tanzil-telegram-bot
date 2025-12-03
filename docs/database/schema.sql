-- Create scheduled_tasks table if it doesn't exist
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id UUID PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    url TEXT NOT NULL,
    execute_at TIMESTAMPTZ NOT NULL,
    options JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Create Policy for Service Role (Full Access)
DROP POLICY IF EXISTS "Service Role Full Access Tasks" ON scheduled_tasks;
CREATE POLICY "Service Role Full Access Tasks" ON scheduled_tasks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON scheduled_tasks TO service_role;
