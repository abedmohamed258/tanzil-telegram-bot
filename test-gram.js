console.log('Start');
try {
    const { TelegramClient } = require('telegram');
    console.log('Telegram loaded');
} catch (e) {
    console.log('Error:', e);
}
console.log('End');
