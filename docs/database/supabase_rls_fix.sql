-- إصلاح صلاحيات الجداول للبوت
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- السماح للبوت (أو أي اتصال مجهول Anon إذا كنت تستخدم مفتاح Anon) بالقراءة والكتابة
-- تحذير: هذا يجعل الجداول مفتوحة للكتابة، ولكن بما أنك تتحكم في البوت، فهذا هو الحل الأسرع
CREATE POLICY "Enable access for all users" ON "public"."users"
AS PERMISSIVE FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable access for downloads" ON "public"."download_history"
AS PERMISSIVE FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable access for tasks" ON "public"."scheduled_tasks"
AS PERMISSIVE FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable access for settings" ON "public"."bot_settings"
AS PERMISSIVE FOR ALL
TO public
USING (true)
WITH CHECK (true);
