-- جدول إدارة الجروبات المتعددة
-- يخزن معلومات الجروبات التي أضيف البوت إليها

CREATE TABLE IF NOT EXISTS bot_groups (
    id BIGINT PRIMARY KEY, -- Group/Supergroup ID (negative number)
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('group', 'supergroup', 'channel')),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by BIGINT, -- User who added the bot
    is_active BOOLEAN DEFAULT TRUE, -- Bot still in group
    admin_ids BIGINT[] DEFAULT '{}', -- Array of admin user IDs
    settings JSONB DEFAULT '{"allowDownloads": true, "notifyOnJoin": true, "logDownloads": true}'::jsonb
);

-- فهرس للجروبات النشطة
CREATE INDEX IF NOT EXISTS idx_bot_groups_active ON bot_groups(is_active) WHERE is_active = TRUE;

-- RLS (Row Level Security)
ALTER TABLE bot_groups ENABLE ROW LEVEL SECURITY;

-- سياسة للـ service role (full access)
CREATE POLICY "Service role full access" ON bot_groups
    FOR ALL
    USING (true)
    WITH CHECK (true);
