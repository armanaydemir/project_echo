/**
 * Project Echo - Cloudflare Workers Version
 *
 * A simple log storage app using D1 (SQLite) for persistence.
 * No framework needed - just native Workers fetch API.
 */

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

interface LogEntry {
  id?: number;
  content: string;
  is_private: number;
  created_at: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API: POST /logs - Create a new log entry
    if (url.pathname === '/logs' && request.method === 'POST') {
      try {
        const body = await request.json() as { content: string; private?: boolean };
        const { content, private: isPrivate } = body;

        if (!content || typeof content !== 'string') {
          return Response.json({ error: 'Content is required' }, { status: 400 });
        }

        const created_at = new Date().toISOString();

        await env.DB.prepare(
          'INSERT INTO logs (content, is_private, created_at) VALUES (?, ?, ?)'
        ).bind(content, isPrivate ? 1 : 0, created_at).run();

        return Response.json({
          content,
          private: !!isPrivate,
          timestamp: created_at
        });
      } catch (error) {
        return Response.json({ error: 'Failed to save log' }, { status: 500 });
      }
    }

    // API: GET /logs - Retrieve all logs
    if (url.pathname === '/logs' && request.method === 'GET') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT id, content, is_private, created_at FROM logs ORDER BY created_at DESC'
        ).all<LogEntry>();

        // Transform to match frontend expectations
        const logs = (results || []).map(row => ({
          content: row.content,
          private: row.is_private === 1,
          timestamp: row.created_at
        }));

        return Response.json(logs);
      } catch (error) {
        return Response.json({ error: 'Failed to fetch logs' }, { status: 500 });
      }
    }

    // Serve static assets (index.html, etc.)
    return env.ASSETS.fetch(request);
  }
};
