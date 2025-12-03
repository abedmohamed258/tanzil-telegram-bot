console.log('🚀 بدء السكريبت (Start)...');

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');
const fs = require('fs');

// Load from environment variables or prompt user
const API_ID = process.env.TELEGRAM_API_ID || parseInt(process.argv[2]);
const API_HASH = process.env.TELEGRAM_API_HASH || process.argv[3];
const stringSession = new StringSession('');
const PHONE_NUMBER = process.env.PHONE_NUMBER || process.argv[4];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

(async () => {
  // Validate required parameters
  if (!API_ID || !API_HASH) {
    console.error('❌ Error: Missing required parameters!');
    console.log('\nUsage:');
    console.log(
      '  node generate-session.js <API_ID> <API_HASH> <PHONE_NUMBER>',
    );
    console.log('\nOr set environment variables:');
    console.log('  TELEGRAM_API_ID=your_api_id');
    console.log('  TELEGRAM_API_HASH=your_api_hash');
    console.log('  PHONE_NUMBER=your_phone_number');
    process.exit(1);
  }

  console.log('⚙️ تهيئة العميل...');

  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: false,
  });

  console.log('⏳ جاري الاتصال...');

  await client.start({
    phoneNumber: async () => {
      if (PHONE_NUMBER) {
        console.log(`📞 استخدام الرقم: ${PHONE_NUMBER}`);
        return PHONE_NUMBER;
      }
      return await ask('📞 أدخل رقم الهاتف (مع رمز الدولة): ');
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
  const session = client.session.save();
  console.log('\n📋 Session String:\n');
  console.log(session);

  fs.writeFileSync('session.txt', session);
  console.log('\n💾 Session saved to session.txt');
  console.log('\n👆 انسخ هذا النص وضعه في .env كـ TELEGRAM_SESSION');

  await client.disconnect();
  rl.close();
  process.exit(0);
})();
