import { Env, SignInResult } from './types';
import { makeSignInRequest } from './lib/evcard';

/**
 * Gets a random execution time for the next day between 09:00 and 11:59 UTC.
 */
export function getRandomExecutionTimeForNextDay(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(9, 0, 0, 0); // Set to 9:00 AM UTC

    // 9:00 to 11:59 is 3 hours * 60 minutes = 180 minutes
    const randomMinutes = Math.floor(Math.random() * 180);
    tomorrow.setUTCMinutes(tomorrow.getUTCMinutes() + randomMinutes);

    return tomorrow;
}

/**
 * Gets an initial execution time for today, or tomorrow if the time has passed.
 */
export function getInitialExecutionTime(): Date {
    const now = new Date();
    const todayExecutionTime = new Date();
    todayExecutionTime.setUTCHours(9, 0, 0, 0);
    const randomMinutes = Math.floor(Math.random() * 180);
    todayExecutionTime.setUTCMinutes(todayExecutionTime.getUTCMinutes() + randomMinutes);

    // If the calculated time for today has already passed, schedule for tomorrow
    if (todayExecutionTime.getTime() < now.getTime()) {
        return getRandomExecutionTimeForNextDay();
    }
    return todayExecutionTime;
}

/**
 * The main function called by the Cron Trigger.
 */
export async function handleScheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext) {
    console.log('[Cron] Checking for due sign-in tasks...');

    const now = new Date().toISOString();
    const { results } = await env.DB.prepare(
        'SELECT * FROM tokens WHERE next_execution_time <= ?'
    ).bind(now).all();

    if (!results || results.length === 0) {
        console.log('[Cron] No due tasks found.');
        return;
    }

    console.log(`[Cron] Found ${results.length} due tasks. Executing...`);

    for (const task of results) {
        const { id, account_name, token } = task as { id: number; account_name: string; token: string };
        let result: SignInResult;

        try {
            result = await makeSignInRequest(env, token, account_name);
        } catch (error: any) {
            result = { success: false, message: `Request failed: ${error.message}` };
        }

        const nextExecutionTime = getRandomExecutionTimeForNextDay();
        await env.DB.prepare(
            'UPDATE tokens SET next_execution_time = ?, last_execution_time = ?, last_result = ? WHERE id = ?'
        ).bind(
            nextExecutionTime.toISOString(),
            new Date().toISOString(),
            JSON.stringify(result),
            id
        ).run();
        console.log(`[Cron] Account [${account_name}] has been rescheduled for: ${nextExecutionTime.toUTCString()}`);
    }
}