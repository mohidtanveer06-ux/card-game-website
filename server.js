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

app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mt-cards-online' });
});

app.get('/assets/audit', (_req, res) => {
  const clientPublic = path.join(__dirname, 'client', 'public');
  const results = {
    favicon: fs.existsSync(path.join(clientPublic, 'favicon.svg')),
    icons: fs.existsSync(path.join(clientPublic, 'icons.svg')),
    assets: {},
  };
  const assetsDir = path.join(__dirname, 'client', 'src', 'assets');
  if (fs.existsSync(assetsDir)) {
    for (const f of fs.readdirSync(assetsDir)) {
      results.assets[f] = fs.existsSync(path.join(assetsDir, f));
    }
  }
  res.json(results);
});

if (isProd) {
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.match(/\.(png|jpg|jpeg|svg|webp|gif)$/i)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`MT Cards Online server on http://localhost:${PORT}`);
});
