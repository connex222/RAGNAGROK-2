'use strict';
/* Ragnagrok server.
   Works unchanged on Render, Oracle or a laptop.

   Environment variables (all optional):
     PORT          set automatically by Render; defaults to 3000
     SAVE_DIR      folder to save games in (use on Oracle; leave unset on Render free)
     PUBLIC_URL    force the join link, e.g. https://ragnagrok.onrender.com
     IDLE_MINUTES  delete rooms nobody has touched for this long (default 30) */

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { RoomManager } = require('./rooms');
const { attachHandlers } = require('./handlers');
const { cacheControlFor } = require('./cache-policy');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function startServer({
  port = Number(process.env.PORT) || 3000,
  saveDir = process.env.SAVE_DIR || null,
  idleMinutes = Number(process.env.IDLE_MINUTES) || 30,
  maxRooms = Number(process.env.MAX_ROOMS) || 100,
  tickMs = 1000,
  quiet = false,
  rate = undefined,
  rules = process.env.RAGNAGROK_RULES || 'v2',
  gameConfig = {}
} = {}) {
  const logger = quiet ? { log() {}, error() {} } : console;
  const version = require('../package.json').version;
  const app = express();
  app.disable('x-powered-by');

  const rooms = new RoomManager({ saveDir, idleMinutes, maxRooms, logger, rules, gameConfig });
  const restored = rooms.loadAll();

  app.get('/healthz', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, version, rules, rooms: rooms.rooms.size, uptime: Math.round(process.uptime()) });
  });

  // V2 pages live in public/v2; v0.5.1 pages stay where they are.
  const V1_PUBLIC_DIR = path.join(__dirname, '..', 'archive', 'v1', 'public');
  const pageDir = rules === 'v2' ? path.join(PUBLIC_DIR, 'v2') : V1_PUBLIC_DIR;
  app.get('/', (req, res) => res.sendFile(path.join(pageDir, 'index.html')));
  app.get('/play', (req, res) => res.sendFile(path.join(pageDir, 'play.html')));
  app.get('/data/v2.json', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '..', 'src', 'data', 'v2.json'));
  });
  // Lists the artwork in public/img so screens only ask for images that exist.
  const IMG_DIR = path.join(PUBLIC_DIR, 'img');
  const AUDIO_DIR = path.join(PUBLIC_DIR, 'audio');
  const list = (dir, re) => { try { return fs.readdirSync(dir).filter(f => re.test(f)); } catch (e) { return []; } };
  let artCache = { at: 0, files: [], audio: [] };
  app.get('/art.json', (req, res) => {
    if (Date.now() - artCache.at > 30000) {
      artCache = {
        at: Date.now(),
        files: list(IMG_DIR, /\.(png|webp|jpe?g|svg)$/i),
        audio: list(AUDIO_DIR, /\.(mp3|m4a|ogg|wav)$/i)
      };
    }
    res.set('Cache-Control', 'no-cache');
    res.json({ files: artCache.files, audio: artCache.audio });
  });

  app.get('/data/cards.json', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '..', 'archive', 'v1', 'src', 'data', 'cards.json'));
  });
  // The archived original's /rules.js asset retains its historic URL in V1.
  if (rules === 'v1') app.use(express.static(V1_PUBLIC_DIR, {
    setHeaders(res, file) { res.set('Cache-Control', cacheControlFor(file)); }
  }));
  app.use(express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders(res, file) {
      // Revalidate HTML, scripts, rules and SVGs on every game load. Otherwise
      // a phone can run the old engine's UI against a newly deployed server for
      // up to an hour, losing a planned action or displaying incorrect costs.
      // Large raster/audio assets can retain their one-hour cache.
      res.set('Cache-Control', cacheControlFor(file));
    }
  }));

  const server = http.createServer(app);
  const io = new Server(server, {
    maxHttpBufferSize: 16 * 1024,
    // More tolerant of mobile backgrounding and intermittent home Wi-Fi.
    pingInterval: 20000,
    pingTimeout: 20000,
    serveClient: true
  });
  attachHandlers(io, rooms, rate ? { rate } : {});

  const timer = setInterval(() => rooms.tickAll(), tickMs);

  function close() {
    clearInterval(timer);
    rooms.saveAll();
    return new Promise(resolve => {
      io.close(() => resolve());
    });
  }

  return new Promise(resolve => {
    server.listen(port, () => {
      const actual = server.address().port;
      logger.log(`RAGNAGROK v${version} server (rules ${rules}) on port ${actual}${saveDir ? `, saving to ${saveDir}` : ''}${restored ? `, restored ${restored} game(s)` : ''}`);
      const lan = require('./network').lanAddresses();
      logger.log(`  TV:     open http://localhost:${actual} on this computer`);
      if (lan.length) logger.log(`  Phones: scan the QR code, or go to http://${lan[0]}:${actual}/play`);
      else logger.log('  Phones: no home-network address found. Is this computer on Wi-Fi or Ethernet?');
      resolve({ app, server, io, rooms, port: actual, close });
    });
  });
}

if (require.main === module) {
  startServer().then(({ close }) => {
    const shutdown = signal => {
      console.log(`${signal} received: saving games and shutting down`);
      close().then(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
}

module.exports = { startServer };
