const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

app.get('/users', async (req, res) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/users`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/users', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/users`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => {
  console.log('Frontend service running on port 3000');
});
