'use strict';
/* Room manager.
   One room = one game = one engine state object.
   Responsibilities:
     - create rooms with short codes
     - send every connected screen its own view after each change
     - route private events only to the phones they belong to
     - run the once-a-second timer (timeouts, expiring trades)
     - pause / resume / rematch
     - optional save-to-disk (set SAVE_DIR, e.g. on Oracle) and idle clean-up */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ENGINES = {
  v1: () => require('../src/engine/rules'),
  v2: () => require('../src/engine/garden')
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: they look like 1 and 0
const CODE_LENGTH = 4;

class RoomManager {
  constructor({ saveDir = null, idleMinutes = 30, finishedMinutes = 60, logger = console, rules = 'v1', gameConfig = {} } = {}) {
    this.gameConfig = gameConfig;
    if (!ENGINES[rules]) throw new Error(`Unknown rules version: ${rules}`);
    this.rules = rules;
    this.E = ENGINES[rules]();
    this.rooms = new Map();
    this.saveDir = saveDir;
    this.idleMs = idleMinutes * 60 * 1000;
    this.finishedMs = finishedMinutes * 60 * 1000;
    this.log = logger;
    if (this.saveDir) fs.mkdirSync(this.saveDir, { recursive: true });
  }

  /* ---------- lifecycle ---------- */

  newCode() {
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('No free room codes');
  }

  create(now = Date.now()) {
    const code = this.newCode();
    const room = {
      code,
      hostKey: crypto.randomBytes(12).toString('hex'),
      state: this.E.createGame({ roomCode: code, now, config: { ...this.gameConfig } }),
      paused: null,
      lastActivity: now,
      sockets: new Set(),
      saveTimer: null
    };
    this.rooms.set(code, room);
    this.scheduleSave(room);
    return room;
  }

  get(code) {
    if (typeof code !== 'string') return null;
    return this.rooms.get(code.trim().toUpperCase()) || null;
  }

  touch(room, now = Date.now()) {
    room.lastActivity = now;
  }

  remove(room) {
    clearTimeout(room.saveTimer);
    room.sockets.forEach(s => s.emit('roomClosed', { code: room.code }));
    this.rooms.delete(room.code);
    if (this.saveDir) {
      fs.rm(this.filePath(room.code), { force: true }, () => {});
    }
  }

  /* ---------- who is who ---------- */

  seatOf(room, socket) {
    if (socket.data.role !== 'player') return -1;
    return this.E.seatForToken(room.state, socket.data.token);
  }

  isHost(room, socket) {
    if (socket.data.role === 'tv') return socket.data.isHost === true;
    return this.seatOf(room, socket) === 0;
  }

  refreshConnected(room, now = Date.now()) {
    const live = new Set();
    room.sockets.forEach(s => {
      const seat = this.seatOf(room, s);
      if (seat >= 0) live.add(seat);
    });
    room.state.players.forEach(p => this.E.setConnected(room.state, p.seat, live.has(p.seat), now));
  }

  /* ---------- sending ---------- */

  viewFor(room, socket) {
    const meta = { code: room.code, paused: !!room.paused, serverNow: Date.now() };
    if (socket.data.role === 'tv') {
      return { ...this.E.publicView(room.state), meta: { ...meta, isHost: !!socket.data.isHost } };
    }
    const seat = this.seatOf(room, socket);
    if (seat < 0) return null;
    return { ...this.E.privateView(room.state, seat), meta: { ...meta, isHost: seat === 0 } };
  }

  /* Push the latest state (and any events) to every screen in the room. */
  sync(room, events = []) {
    const layoutId = room.state.board ? room.state.board.layoutId : null;

    room.sockets.forEach(socket => {
      const view = this.viewFor(room, socket);
      if (!view) {
        socket.emit('kicked', { code: room.code });
        room.sockets.delete(socket);
        socket.data.code = null;
        return;
      }

      // Send the static board geometry once per socket per layout.
      if (layoutId && socket.data.layoutSent !== layoutId) {
        view.topology = this.E.clientTopology(layoutId);
        socket.data.layoutSent = layoutId;
      }
      socket.emit('state', view);

      if (!events.length) return;
      const seat = socket.data.role === 'player' ? this.seatOf(room, socket) : -1;
      const mine = events
        .filter(e => (e.privateTo ? seat >= 0 && e.privateTo.includes(seat) : true))
        .map(({ privateTo, ...rest }) => rest);
      if (mine.length) socket.emit('events', mine);
    });

    this.scheduleSave(room);
  }

  /* ---------- the clock ---------- */

  tickAll(now = Date.now()) {
    this.rooms.forEach(room => {
      if (!room.paused) {
        const r = this.E.tick(room.state, now);
        if (r.changed) this.sync(room, r.events);
      }

      const idleFor = now - room.lastActivity;
      const finished = room.state.phase.stage === 'gameOver';
      if (room.sockets.size === 0 && idleFor > this.idleMs) this.remove(room);
      else if (finished && idleFor > this.finishedMs) this.remove(room);
    });
  }

  /* ---------- host controls ---------- */

  pause(room, now = Date.now()) {
    if (room.paused) return 'Already paused';
    if (room.state.phase.stage === 'lobby' || room.state.phase.stage === 'gameOver') return 'Nothing to pause';
    room.paused = { at: now };
    this.sync(room, [{ type: 'paused' }]);
    return null;
  }

  /* After a server restart the game waits, then carries on by itself once every phone is back. */
  autoResumeIfReady(room, now = Date.now()) {
    if (!room.paused || !room.paused.auto) return;
    if (room.state.players.every(p => p.connected)) this.resume(room, now);
  }

  resume(room, now = Date.now()) {
    if (!room.paused) return 'Not paused';
    const pausedFor = now - room.paused.at;
    const s = room.state;
    if (s.phase.deadline) s.phase.deadline += pausedFor;
    s.trades.forEach(t => { if (t.status === 'open') t.expiresAt += pausedFor; });
    room.paused = null;
    s.stateVersion += 1;
    this.sync(room, [{ type: 'resumed' }]);
    return null;
  }

  /* Same players, same seats, same phones; fresh board. */
  rematch(room, now = Date.now()) {
    if (room.state.phase.stage !== 'gameOver') return 'Finish the current game first';
    const old = room.state;
    const keep = { ...this.gameConfig, maxPlayers: old.config.maxPlayers };
    if (old.config.length) keep.length = old.config.length;
    if (old.config.planSec !== undefined) keep.planSec = old.config.planSec;
    const fresh = this.E.createGame({ roomCode: room.code, config: keep, now });
    old.players.forEach(p => {
      const res = this.E.addPlayer(fresh, { name: p.name, avatar: p.avatar }, now);
      fresh.secrets.playerTokens[res.seat] = old.secrets.playerTokens[p.seat];
    });
    fresh.stateVersion = old.stateVersion + 1;
    room.state = fresh;
    room.paused = null;
    room.sockets.forEach(s => { s.data.layoutSent = null; });
    this.refreshConnected(room, now);
    this.sync(room, [{ type: 'rematch' }]);
    return null;
  }

  /* ---------- saving (optional) ---------- */

  filePath(code) {
    return path.join(this.saveDir, `${code}.json`);
  }

  serialize(room) {
    return JSON.stringify({
      format: 'ragnagrok.room',
      version: 1,
      code: room.code,
      hostKey: room.hostKey,
      paused: room.paused,
      lastActivity: room.lastActivity,
      state: room.state
    });
  }

  saveNow(room) {
    if (!this.saveDir) return;
    clearTimeout(room.saveTimer);
    room.saveTimer = null;
    const file = this.filePath(room.code);
    const tmp = `${file}.tmp`;
    try {
      fs.writeFileSync(tmp, this.serialize(room));
      fs.renameSync(tmp, file); // atomic: a crash never leaves a half-written save
    } catch (err) {
      this.log.error(`Save failed for room ${room.code}:`, err.message);
    }
  }

  scheduleSave(room) {
    if (!this.saveDir || room.saveTimer) return;
    room.saveTimer = setTimeout(() => this.saveNow(room), 2000);
    if (room.saveTimer.unref) room.saveTimer.unref();
  }

  saveAll() {
    this.rooms.forEach(room => this.saveNow(room));
  }

  loadAll(now = Date.now()) {
    if (!this.saveDir) return 0;
    let loaded = 0;
    fs.readdirSync(this.saveDir)
      .filter(f => f.endsWith('.json'))
      .forEach(f => {
        try {
          const file = path.join(this.saveDir, f);
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (data.format !== 'ragnagrok.room') return;
          // Never load a save made by a different rules version: it would corrupt the game.
          if (!data.state || data.state.schemaVersion !== this.E.SCHEMA_VERSION) {
            const shelf = path.join(this.saveDir, 'incompatible');
            fs.mkdirSync(shelf, { recursive: true });
            fs.renameSync(file, path.join(shelf, f));
            this.log.log(`Skipped save ${f}: made by rules version ${data.state && data.state.schemaVersion}, this server runs version ${this.E.SCHEMA_VERSION}. Moved to saves/incompatible.`);
            return;
          }
          const room = {
            code: data.code,
            hostKey: data.hostKey,
            state: data.state,
            // A restart counts as a pause, so nobody gets timed out while the server was down.
            paused: data.state.phase.stage === 'lobby' || data.state.phase.stage === 'gameOver'
              ? null
              : (data.paused || { at: data.lastActivity || now, auto: true }),
            lastActivity: now,
            sockets: new Set(),
            saveTimer: null
          };
          room.state.players.forEach(p => { p.connected = false; });
          this.rooms.set(room.code, room);
          loaded++;
        } catch (err) {
          this.log.error(`Could not load ${f}:`, err.message);
        }
      });
    return loaded;
  }
}

module.exports = { RoomManager, CODE_CHARS, CODE_LENGTH, ENGINES };
