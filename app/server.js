const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const LOGS_FILE = path.join(__dirname, 'logs.jsonl');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
