console.log('🚀 بدء السكريبت (Start)...');

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');

const API_ID = 30755195;
const API_HASH = '76db9d713a383da90c03d7f37dc62cdb';
const stringSession = new StringSession('');
const PHONE_NUMBER = '+201287251665';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

(async () => {
    console.log('⚙️ تهيئة العميل...');
    
    const client = new TelegramClient(stringSession, API_ID, API_HASH, {
        connectionRetries: 5,
        useWSS: false,
    });

    console.log('⏳ جاري الاتصال...');
    
    await client.start({
        phoneNumber: async () => {
            console.log(`📞 استخدام الرقم: ${PHONE_NUMBER}`);
            return PHONE_NUMBER;
        },
        password: async () => {
            console.log('🔒 طلب كلمة المرور...');
            return await ask('🔒 أدخل كلمة المرور (إن وجدت): ');
        },
        phoneCode: async () => {
            console.log('📨 تم طلب الكود من تليجرام!');
            console.log('⚠️  من فضلك افحص تطبيق تليجرام الآن.');
            return await ask('🔢 أدخل الكود هنا: ');
        },
        onError: (err) => console.log('❌ خطأ:', err),
    });

    console.log('\n✅ تم تسجيل الدخول بنجاح!');
    console.log('\n📋 Session String:\n');
    console.log(client.session.save());
    console.log('\n👆 انسخ هذا النص وضعه في .env كـ TELEGRAM_SESSION');

    await client.disconnect();
    rl.close();
    process.exit(0);
})();
