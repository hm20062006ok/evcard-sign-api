import { Hono } from 'hono';
import { Env } from './types';
import { handleScheduled, getInitialExecutionTime } from './scheduled';

const app = new Hono<{ Bindings: Env }>();
const api = new Hono<{ Bindings: Env }>();


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

// Mount the API routes under the /api prefix
app.route('/api', api);


export default {
	fetch: app.fetch,
	scheduled: handleScheduled,
};