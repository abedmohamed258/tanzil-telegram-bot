-- 1. Fix 'users' table: Add missing 'preferred_quality' column
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_quality TEXT;

-- 2. Fix 'scheduled_tasks' table: Recreate to ensure correct types (TIMESTAMPTZ)
-- We drop it to resolve the "invalid input syntax for type bigint" error, 
-- which suggests the current table has a wrong column type (likely BIGINT for execute_at).
DROP TABLE IF EXISTS scheduled_tasks;

CREATE TABLE scheduled_tasks (
    id UUID PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    url TEXT NOT NULL,
    execute_at TIMESTAMPTZ NOT NULL,
    options JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Re-apply Permissions and RLS
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Full Access Tasks" ON scheduled_tasks;
CREATE POLICY "Service Role Full Access Tasks" ON scheduled_tasks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON scheduled_tasks TO service_role;

-- 4. Verify other tables exist (just in case)
CREATE TABLE IF NOT EXISTS download_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    title TEXT,
    url TEXT,
    format TEXT,
    filename TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON download_history TO service_role;

DROP POLICY IF EXISTS "Service Role Full Access History" ON download_history;
CREATE POLICY "Service Role Full Access History" ON download_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
