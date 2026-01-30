const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const LOGS_FILE = path.join(DATA_DIR, 'logs.jsonl');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to get non-private logs
function getNonPrivateLogs() {
  if (!fs.existsSync(LOGS_FILE)) {
    return [];
  }
  const data = fs.readFileSync(LOGS_FILE, 'utf8');
  return data
    .trim()
    .split('\n')
    .filter(line => line)
    .map(line => JSON.parse(line))
    .filter(log => !log.private)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Helper function to format logs as context
function formatLogsAsContext(logs) {
  if (logs.length === 0) {
    return 'No logs available.';
  }
  return logs.map(log => {
    const date = new Date(log.timestamp);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return `[${dateStr}]\n${log.content}`;
  }).join('\n\n---\n\n');
}

// POST /logs - Save a log entry
app.post('/logs', (req, res) => {
  const { content, private: isPrivate } = req.body;
  const entry = {
    content,
    private: !!isPrivate,
    timestamp: new Date().toISOString()
  };
  fs.appendFileSync(LOGS_FILE, JSON.stringify(entry) + '\n');
  res.json(entry);
});

// GET /logs - Return all logs
app.get('/logs', (req, res) => {
  if (!fs.existsSync(LOGS_FILE)) {
    return res.json([]);
  }
  const data = fs.readFileSync(LOGS_FILE, 'utf8');
  const logs = data
    .trim()
    .split('\n')
    .filter(line => line)
    .map(line => JSON.parse(line));
  res.json(logs);
});

// GET /api/ollama/status - Check if Ollama is running
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const data = await response.json();
      res.json({ status: 'running', models: data.models || [] });
    } else {
      res.status(503).json({ status: 'error', message: 'Ollama returned an error' });
    }
  } catch (error) {
    if (error.name === 'TimeoutError') {
      res.status(503).json({ status: 'error', message: 'Ollama request timed out' });
    } else {
      res.status(503).json({ status: 'error', message: 'Ollama is not running' });
    }
  }
});

// POST /api/chat - Chat with Ollama using logs as context
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get non-private logs and format as context
    const logs = getNonPrivateLogs();
    const logsContext = formatLogsAsContext(logs);

    // Build system prompt with logs context
    const systemPrompt = `You are Echo, a helpful AI assistant with access to the user's personal logs. Use these logs as context to provide personalized and relevant responses.

Here are the user's logs:

${logsContext}

When responding:
- Reference specific logs when relevant
- Be helpful and conversational
- If asked about something not in the logs, be honest about it
- Respect the user's privacy and be thoughtful in your responses`;

    // Call Ollama API
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        stream: false
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText}`);
    }

    const data = await response.json();
    res.json({
      response: data.message?.content || 'No response from Ollama',
      model: OLLAMA_MODEL
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      res.status(504).json({ error: 'Request to Ollama timed out' });
    } else if (error.cause?.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'Ollama is not running. Please start Ollama and try again.' });
    } else {
      console.error('Chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to get response from Ollama' });
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
