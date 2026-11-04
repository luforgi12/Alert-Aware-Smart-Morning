import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '.server.env' });

const app = express();
const PORT = process.env.PORT || 4000;

// Allow your Vite dev server origin
app.use(cors({
  origin: process.env.VITE_CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API proxy endpoint for alerts - reads token from server .env (NOT VITE_ prefix!)
const SERVER_ALERTS_KEY = process.env.ALERTS_API_KEY;
if (!SERVER_ALERTS_KEY) {
  console.warn('⚠️  ALERTS_API_KEY not set in server environment. The /api/alerts endpoint will return an error.');
}

// API proxy endpoint for alerts
app.get('/api/alerts', async (req, res) => {
  try {
    if (!SERVER_ALERTS_KEY) {
      return res.status(500).json({ error: 'Server API key not configured' });
    }

    // Fetch from alerts.in.ua using the Bearer token
    const response = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVER_ALERTS_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Alerts API error:', response.status, errorText);
      return res.status(502).json({ error: 'Failed to fetch alerts', status: response.status });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal proxy error' });
  }
});

app.listen(PORT, () => {
  console.log(`🛡️  Alerts proxy server running on http://localhost:${PORT}`);
  console.log(`🔑 Server reads token from ALERTS_API_KEY (not exposed to clients)`);
  console.log(`📡 Frontend should call: http://localhost:${PORT}/api/alerts`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});