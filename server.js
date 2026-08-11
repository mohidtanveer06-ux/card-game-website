import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupSocketHandlers } from './server/socketHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'client', 'dist');
const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(distPath);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mt-cards-online' });
});

if (isProd) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`MT Cards Online server on http://localhost:${PORT}`);
});
