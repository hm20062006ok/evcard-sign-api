import md5 from 'md5';
import { Env, SignInResult } from '../types';

// MD5 helper (uppercase)
function md5Uppercase(input: string): string {
    return md5(input).toUpperCase();
}

// Generate random string
function generateRandomString(length: number): string {
    const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    const charsLength = chars.length;
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * charsLength));
    }
    return result;
}

// Constants
const APP_KEY = "evcardapp";
const APP_SECRET = "7f634bf3-6b25-4a8c-92ac-bd4a1e116660";
const TCS_APP_KEY = "evcard_tcs";
const TCS_SECRET = "f79da527-372d-4a25-bb61-428acebbeb76";
const BASE_URL = 'http://csms.evcard.com';

// Generate signature
function generateSignature(token: string, timestamp: string, random: string) {
    let signString = `appkey${APP_KEY}secret${APP_SECRET}timestamp${timestamp}random${random}`;
    if (token) {
        signString += `token${token}`;
    }
    return md5Uppercase(signString).toUpperCase();
}

// Generate TCS signature
function generateTcsSign(tcsTimestamp: string) {
    const signString = `${TCS_APP_KEY}${TCS_SECRET}${tcsTimestamp}`;
    return md5(signString).toLowerCase();
}

// Send Bark notification
async function sendBarkNotification(env: Env, title: string, message: string) {

    const BARK_URL = `https://api.day.app/AnhEsCxkii9YP6mLrzUfMY`;
    try {
        const url = `${BARK_URL}/${encodeURIComponent(title)}/${encodeURIComponent(message)}?group=EvCard签到`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) {
            console.error('Failed to send Bark notification:', res.status, res.statusText);
        } else {
            console.log('Bark notification sent successfully.');
        }
    } catch (error: any) {
        console.error('Failed to send Bark notification:', error?.message || error);
    }
}

export async function makeSignInRequest(env: Env, token: string, accountName: string): Promise<SignInResult> {
    if (!token) {
        throw new Error('Token is required');
    }

    const timestamp = Date.now().toString();
    const tcsTimestamp = (Date.now() + 15000).toString();
    const random = generateRandomString(6);

    const sign = generateSignature(token, timestamp, random);
    const tcsSign = generateTcsSign(tcsTimestamp);

    const headers = {
        'Host': 'csms.evcard.com',
        'Referer': 'http://csms.evcard.com/evcard-viph5/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        'userOrigin': '2',
        'random': random,
        'tcsToken': `tcs_appprod_evcardapp_${token}`,
        'tcsAppKey': TCS_APP_KEY,
        'Origin': 'http://csms.evcard.com',
        'sign': sign,
        'Connection': 'keep-alive',
        'tcsSign': tcsSign,
        'token': token,
        'timestamp': timestamp,
        'Accept-Language': 'en-US,en;q=0.9',
        'tcsTimestamp': tcsTimestamp,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        'Accept-Encoding': 'gzip, deflate',
        'appKey': APP_KEY,
        'dataOrigin': '2'
    };

    try {
        const response = await fetch(`${BASE_URL}/evcard-tcs/api/task/signIn`, {
            method: 'POST',
            headers,
            body: JSON.stringify({})
        });
        const responseData = await response.json();
        console.log(`[Sign-In] Account [${accountName}] Result:`, responseData);

        const result: SignInResult = {
            success: responseData.code === 200,
            message: '签到成功：' + JSON.stringify(responseData),
            data: responseData.data
        };

        await sendBarkNotification(
            env,
            `EvCard签到: ${accountName}`,
            `结果: ${result.message}`
        );
        return result;

    } catch (error: any) {
        console.error(`[Sign-In] Account [${accountName}] Error:`, error?.message || error);
        await sendBarkNotification(
            env,
            `EvCard签到失败: ${accountName}`,
            `错误: ${error?.message || error}`
        );
        // Re-throw to be caught by the scheduled handler
        throw error;
    }
}