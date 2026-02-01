const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const LOGS_FILE = path.join(DATA_DIR, 'logs.jsonl');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

// Available models (add new models here)
const MODELS = {
  'llama3.2': { name: 'Llama 3.2', size: '3B', ram: '~2GB' },
  'llama3.1:8b': { name: 'Llama 3.1', size: '8B', ram: '~5GB' },
  'llama2:13b': { name: 'Llama 2', size: '13B', ram: '~8GB' },
  'qwen2.5:14b': { name: 'Qwen 2.5', size: '14B', ram: '~9GB' },
  'deepseek-r1:14b': { name: 'DeepSeek R1', size: '14B', ram: '~9GB' },
  'gpt-oss:latest': { name: 'GPT-OSS', size: '22B', ram: '~13GB' },
};

const DEFAULT_MODEL = 'gpt-oss:latest';
let currentModel = process.env.currentModel || DEFAULT_MODEL;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve chat page at /chat
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Serve all pages list at /all
app.get('/all', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'all.html'));
});

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

// GET /api/models - List available models from Ollama
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      const models = (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        size: m.details?.parameter_size || 'Unknown',
        active: m.name === currentModel
      }));
      res.json({ models, active: currentModel });
    } else {
      res.status(503).json({ error: 'Failed to fetch models from Ollama' });
    }
  } catch (e) {
    res.status(503).json({ error: 'Ollama is not running' });
  }
});

// POST /api/models - Switch active model
app.post('/api/models', (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ error: 'Model is required' });
  }
  currentModel = model;
  res.json({ active: currentModel });
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

// POST /api/chat - Chat with Ollama using logs as context (streaming)
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

    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Call Ollama API with streaming enabled
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText}`);
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            res.write(`data: ${JSON.stringify({ content: data.message.content })}\n\n`);
          }
          if (data.done) {
            res.write(`data: ${JSON.stringify({ done: true, model: currentModel })}\n\n`);
          }
        } catch (e) {
          // Skip malformed JSON lines
        }
      }
    }

    res.end();
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
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
