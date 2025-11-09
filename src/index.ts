import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { handleScheduled, getInitialExecutionTime } from './scheduled';
import { makeSignInRequest } from './lib/evcard';

const app = new Hono<{ Bindings: Env }>();
const api = new Hono<{ Bindings: Env }>();

// 固定凭证
const VALID_USERNAME = 'hm';
const VALID_PASSWORD = 'hm@20062006ok';

// 生成 token 的辅助函数
async function generateToken(): Promise<string> {
	const timestamp = Date.now().toString();
	const randomBytes = crypto.getRandomValues(new Uint8Array(16));
	const randomHex = Array.from(randomBytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
	return `${timestamp}-${randomHex}`;
}

// API: Login
api.post('/login', async (c) => {
	try {
		const { username, password } = await c.req.json<{ username: string; password: string }>();
		
		if (!username || !password) {
			return c.json({ error: 'Username and password are required.' }, 400);
		}

		if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
			return c.json({ error: 'Invalid username or password.' }, 401);
		}

		const token = await generateToken();
		return c.json({ success: true, token }, 200);
	} catch (e: any) {
		return c.json({ error: 'Failed to process login request.', details: e.message }, 500);
	}
});

// API: Get all tokens
api.get('/tokens', async (c) => {
	const { results } = await c.env.DB.prepare('SELECT * FROM tokens ORDER BY id DESC').all();
	return c.json(results);
});

// API: Add a new token
api.post('/tokens', async (c) => {
	try {
		const { account_name, token } = await c.req.json<{ account_name: string; token: string }>();
		if (!account_name || !token) {
			return c.json({ error: 'Account name and Token are required.' }, 400);
		}
		const initialExecutionTime = getInitialExecutionTime();
		await c.env.DB.prepare(
			'INSERT INTO tokens (account_name, token, next_execution_time) VALUES (?, ?, ?)'
		).bind(account_name, token, initialExecutionTime.toISOString()).run();
		return c.json({ success: true }, 201);
	} catch (e: any) {
		return c.json({ error: 'Failed to add token. It may already exist.', details: e.message }, 500);
	}
});

// API: Update a token
api.put('/tokens/:id', async (c) => {
	const id = c.req.param('id');
	try {
		const { account_name, token } = await c.req.json<{ account_name: string; token: string }>();
		if (!account_name || !token) {
			return c.json({ error: 'Account name and Token are required.' }, 400);
		}
		const { success } = await c.env.DB.prepare(
			'UPDATE tokens SET account_name = ?, token = ? WHERE id = ?'
		).bind(account_name, token, id).run();

		if (success) {
			return c.json({ success: true });
		} else {
			return c.json({ error: 'Token not found' }, 404);
		}
	} catch (e: any) {
		return c.json({ error: 'Failed to update token.', details: e.message }, 500);
	}
});

// API: Delete a token
api.delete('/tokens/:id', async (c) => {
	const id = c.req.param('id');
	const { success } = await c.env.DB.prepare('DELETE FROM tokens WHERE id = ?').bind(id).run();
	if (success) {
		return c.json({ success: true });
	}
	return c.json({ error: 'Token not found' }, 404);
});

// 重新部署
api.post('/tokens/:id/signin', async (c) => {
	const id = c.req.param('id');
	try {
		// 1. Find the token in the database
		const tokenInfo = await c.env.DB.prepare('SELECT * FROM tokens WHERE id = ?').bind(id).first<{
			id: number;
			account_name: string;
			token: string;
		}>();

		if (!tokenInfo) {
			return c.json({ error: 'Token not found' }, 404);
		}

		// 2. Call the sign-in function from evcard.ts
		const result = await makeSignInRequest(c.env, tokenInfo.token, tokenInfo.account_name);

		// 3. Return the result from the sign-in attempt
		return c.json(result);

	} catch (e: any) {
		console.error(`Failed to manually sign in for token ID ${id}:`, e.message);
		return c.json({ error: 'Failed to perform sign-in.', details: e.message }, 500);
	}
});
app.use('/*', cors());

// Mount the API routes under the /api prefix
app.route('/api', api);


export default {
	fetch: app.fetch,
	scheduled: handleScheduled,
};