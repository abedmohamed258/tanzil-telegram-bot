console.log('Start Debug');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const API_ID = 30755195;
const API_HASH = '76db9d713a383da90c03d7f37dc62cdb';
const stringSession = new StringSession('');

(async () => {
    console.log('Init Client');
    const client = new TelegramClient(stringSession, API_ID, API_HASH, {
        connectionRetries: 5,
        useWSS: false,
    });
    console.log('Client Created');
    await client.connect();
    console.log('Connected');
    await client.disconnect();
    console.log('End Debug');
})();
