import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 20,
    duration: '20s',
    thresholds: {
        http_req_failed: ['rate<0.01'], 
        http_req_duration: ['p(95)<300'], 
    },
};

const BASE_URL = 'https://cognilink.niluferormanli.com/restart';

function generateVipCookie() {
    const state = {
        uid: `logic-test-${Math.random().toString(36).substring(7)}`,
        v: 1,
        c: 0,
        h: 0,
        e: 50, 
        t: ["vip_pass"], 
        ts: Math.floor(Date.now() / 1000)
    };
    
    return encodeURIComponent(JSON.stringify(state));
}

export default function () {
    const params = {
        headers: {
            'Cookie': `cos_state=${generateVipCookie()}`,
            'User-Agent': 'CogniLink-Stress-Tester/1.0',
        },
        redirects: 0, 
    };

    const res = http.get(BASE_URL, params);

    check(res, {
        'Status is 302': (r) => r.status === 302,
        'Redirected properly': (r) => r.headers['Location'] && r.headers['Location'].includes('http')
    });
    
    sleep(0.5);
}
