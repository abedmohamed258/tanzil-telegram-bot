-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- Create Policy for Service Role (Full Access)
-- Note: Supabase Service Role Key bypasses RLS by default, but explicit policies are good practice.
-- However, we need to ensure the bot (using service_role key) can access everything.
-- If the bot uses the ANON key, these policies are critical.

-- Policy: Allow Service Role to do EVERYTHING
DROP POLICY IF EXISTS "Service Role Full Access Users" ON users;
CREATE POLICY "Service Role Full Access Users" ON users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access History" ON download_history;
CREATE POLICY "Service Role Full Access History" ON download_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Tasks" ON scheduled_tasks;
CREATE POLICY "Service Role Full Access Tasks" ON scheduled_tasks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Settings" ON bot_settings;
CREATE POLICY "Service Role Full Access Settings" ON bot_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Allow Anon (if needed for public read, usually not for this bot)
-- For now, we deny anon access to everything to be safe.
-- If you need public access, uncomment below:
-- CREATE POLICY "Public Read Users" ON users FOR SELECT TO anon USING (true);

-- Fix for 42501 (Insufficient Privilege)
-- Ensure the role used by the bot has permissions.
GRANT ALL ON users TO service_role;
GRANT ALL ON download_history TO service_role;
GRANT ALL ON scheduled_tasks TO service_role;
GRANT ALL ON bot_settings TO service_role;

-- If you are using the ANON key in the bot (not recommended), you need to grant to anon:
-- GRANT SELECT, INSERT, UPDATE ON users TO anon;
-- But you should use SERVICE_ROLE_KEY in .env
