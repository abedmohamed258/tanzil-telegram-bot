console.log('🚀 بدء السكريبت (Start)...');

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const API_ID = 30755195;
const API_HASH = '76db9d713a383da90c03d7f37dc62cdb';
const stringSession = new StringSession('');
const PHONE_NUMBER = '+201287251665';
const CODE = process.argv[2]; // Get code from command line argument

if (!CODE) {
    console.error('❌ Error: Please provide the code as an argument.');
    process.exit(1);
}

(async () => {
    console.log('⚙️ تهيئة العميل...');

    const client = new TelegramClient(stringSession, API_ID, API_HASH, {
        connectionRetries: 5,
        useWSS: false,
    });

    console.log('⏳ جاري الاتصال...');

    await client.start({
        phoneNumber: async () => PHONE_NUMBER,
        password: async () => {
            console.log('🔒 طلب كلمة المرور (Not supported in this mode)...');
            return '';
        },
        phoneCode: async () => {
            console.log(`📨 استخدام الكود: ${CODE}`);
            return CODE;
        },
        onError: (err) => console.log('❌ خطأ:', err),
    });

    console.log('\n✅ تم تسجيل الدخول بنجاح!');
    console.log('\n📋 Session String:\n');
    console.log(client.session.save());
    console.log('\n👆 انسخ هذا النص وضعه في .env كـ TELEGRAM_SESSION');

    await client.disconnect();
    process.exit(0);
})();
