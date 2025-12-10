
import fetch from 'node-fetch';

const instances = [
    'https://cobalt-api.kwiatekmiki.com',
    'https://cobalt-api.meowing.de',
    'https://cobalt-backend.canine.tools',
    'https://kityune.imput.net',
    'https://capi.3kh0.net',
];

const main = async () => {
    console.log('Testing Cobalt instances...');
    const url = 'https://www.youtube.com/shorts/a0NfD9lUzMA';

    for (const base of instances) {
        console.log(`\nTesting ${base}...`);

        const endpoints = [
            '/api/json',
            '/',
            '/api/server/json'
        ];

        for (const endpoint of endpoints) {
            try {
                const target = base.endsWith('/')
                    ? `${base.slice(0, -1)}${endpoint}`
                    : `${base}${endpoint}`;

                const finalUrl = target.replace('//', '/').replace(':/', '://');
                console.log(`  Trying ${finalUrl}`);

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                const res = await fetch(finalUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                    body: JSON.stringify({
                        url: url,
                        vQuality: '1080',
                        isAudioOnly: false,
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeout);

                console.log(`  Status: ${res.status} ${res.statusText}`);
                const type = res.headers.get('content-type');
                console.log(`  Type: ${type}`);

                if (res.ok && type?.includes('application/json')) {
                    const json = await res.json();
                    console.log('  SUCCESS:', JSON.stringify(json).slice(0, 100));
                } else {
                    const text = await res.text();
                    console.log('  Body:', text.slice(0, 100));
                }

            } catch (e: any) {
                console.log(`  Error: ${e.message}`);
            }
        }
    }
};

main();
