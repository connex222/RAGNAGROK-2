'use strict';
/* Socket messages between the screens and the server.

   TV  → server   tv:create {}                       → { ok, code, hostKey, joinUrl, qr }
                  tv:attach { code, hostKey? }        → { ok, code, isHost }
   Phone → server player:join { code, name, avatar } → { ok, seat, token }
                  player:rejoin { code, token }       → { ok, seat }
                  player:leave {}                     → { ok }        (lobby only)
                  action { type, ...params }          → { ok, error }
   Host  → server host:start | host:pause | host:resume | host:rematch | host:kick { seat } | host:close

   Server → screens  state   (that screen's own view, plus meta.serverNow for countdown timers)
                     events  (sounds and animations; private ones only reach their phones)
                     kicked, roomClosed

   Every reply goes through the ack callback, so a phone always knows whether
   its tap worked and, if not, why. */

// QR-code generator is injectable so the Socket.io protocol can be tested without
// starting an HTTP server or requiring browser-only test dependencies.

const DEFAULT_RATE = { capacity: 30, refillPerSec: 15 };

function makeLimiter(RATE) {
  let tokens = RATE.capacity;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(RATE.capacity, tokens + ((now - last) / 1000) * RATE.refillPerSec);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

const { joinBase } = require('./network');
const baseUrl = socket => joinBase(socket.handshake.headers);

/* Slows down anyone guessing room codes: 20 wrong codes a minute per address, then a pause. */
const WRONG_LIMIT = 20;
const wrongCodes = new Map();
function addressOf(socket) {
  // An arbitrary socket client can spoof X-Forwarded-For. Trust it only when
  // the operator explicitly configures a trusted reverse proxy.
  const fwd = process.env.TRUST_PROXY === '1' ? socket.handshake.headers['x-forwarded-for'] : null;
  return (fwd ? String(fwd).split(',')[0] : socket.handshake.address || 'unknown').trim();
}
function tooManyWrong(socket) {
  const w = wrongCodes.get(addressOf(socket));
  return !!w && w.count >= WRONG_LIMIT && Date.now() < w.until;
}
function noteWrong(socket) {
  const key = addressOf(socket);
  const now = Date.now();
  const w = wrongCodes.get(key);
  if (!w || now > w.until) wrongCodes.set(key, { count: 1, until: now + 60000 });
  else w.count += 1;
  if (wrongCodes.size > 5000) wrongCodes.clear();
}

function attachHandlers(io, rooms, { rate = DEFAULT_RATE, qrCode = null } = {}) {
  const E = rooms.E;
  const QRCode = qrCode || require('qrcode');
  io.on('connection', socket => {
    socket.data = { code: null, role: null, token: null, isHost: false, layoutSent: null };
    const allowed = makeLimiter(rate);
    let creatingTv = false; // QR generation awaits; reject overlapping create calls.

    // Wraps every handler: safe ack, rate limit, and no crash can take the server down.
    const on = (event, fn) => {
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        if (!allowed()) return reply({ ok: false, error: 'Slow down a little' });
        try {
          const out = await fn(payload && typeof payload === 'object' ? payload : {});
          reply(out || { ok: true });
        } catch (err) {
          console.error(`Handler ${event} failed:`, err);
          reply({ ok: false, error: 'Something went wrong on the server' });
        }
      });
    };

    const currentRoom = () => (socket.data.code ? rooms.get(socket.data.code) : null);

    function leaveCurrent() {
      const room = currentRoom();
      if (!room) return;
      room.sockets.delete(socket);
      socket.data.code = null;
      socket.data.layoutSent = null;
      rooms.refreshConnected(room);
      rooms.touch(room);
      rooms.sync(room);
    }

    function enter(room, role, extra = {}) {
      if (socket.data.code && socket.data.code !== room.code) leaveCurrent();
      // A seat has one active controller. Otherwise an old tab and a replacement
      // phone can both issue actions using the same valid reconnect token.
      if (role === 'player') {
        for (const previous of [...room.sockets]) {
          if (previous === socket || previous.data.role !== 'player' || previous.data.token !== extra.token) continue;
          room.sockets.delete(previous);
          Object.assign(previous.data, { code: null, role: null, token: null, isHost: false, layoutSent: null });
          previous.emit('sessionReplaced', { message: 'Your gardener was opened on another device.' });
        }
      }
      Object.assign(socket.data, { code: room.code, role, token: role === 'player' ? extra.token : null,
        isHost: role === 'tv' ? !!extra.isHost : false, layoutSent: null });
      room.sockets.add(socket);
      rooms.refreshConnected(room);
      rooms.touch(room);
    }

    /* ---------- TV ---------- */

    on('tv:create', async () => {
      if (creatingTv || currentRoom()) return { ok: false, error: 'A room is already being created or is open on this TV' };
      if (rooms.rooms.size >= rooms.maxRooms) return { ok: false, error: 'The game server is full. Try again later.' };
      creatingTv = true;
      let room = null;
      try {
        room = rooms.create();
        const joinUrl = `${baseUrl(socket)}/play?room=${room.code}`;
        const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 480, errorCorrectionLevel: 'M' });
        // QR creation is asynchronous; a TV can disconnect while it is pending.
        if (socket.disconnected === true) throw new Error('Host disconnected during room creation');
        enter(room, 'tv', { isHost: true });
        rooms.sync(room);
        return { ok: true, code: room.code, hostKey: room.hostKey, joinUrl, qr };
      } catch (err) {
        // A failed QR must not leave an unreachable room consuming server capacity.
        if (room) rooms.remove(room);
        throw err;
      } finally {
        creatingTv = false;
      }
    });

    // Recover a QR/host key only over the original authenticated TV socket.
    // Useful if the initial create acknowledgement was lost after the room was made.
    on('tv:recover', async () => {
      const room = currentRoom();
      if (!room || socket.data.role !== 'tv' || !socket.data.isHost)
        return { ok: false, error: 'No active host session on this TV connection' };
      const joinUrl = `${baseUrl(socket)}/play?room=${room.code}`;
      const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 480, errorCorrectionLevel: 'M' });
      return { ok: true, code: room.code, hostKey: room.hostKey, joinUrl, qr };
    });

    on('tv:attach', async ({ code, hostKey }) => {
      if (creatingTv) return { ok: false, error: 'Wait for room creation to finish' };
      if (currentRoom() && socket.data.role !== 'tv') return { ok: false, error: 'Leave your current player seat first' };
      const room = rooms.get(code);
      if (!room) return { ok: false, error: 'That room has closed' };
      const isHost = typeof hostKey === 'string' && hostKey === room.hostKey;
      const joinUrl = `${baseUrl(socket)}/play?room=${room.code}`;
      const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 480, errorCorrectionLevel: 'M' });
      if (socket.disconnected === true) return { ok: false, error: 'TV disconnected' };
      enter(room, 'tv', { isHost });
      rooms.sync(room);
      return { ok: true, code: room.code, isHost, joinUrl, qr };
    });

    /* ---------- phones ---------- */

    on('player:join', ({ code, name, avatar }) => {
      if (currentRoom()) return { ok: false, error: 'Already in a room; leave before joining again' };
      if (tooManyWrong(socket)) return { ok: false, error: 'Too many wrong codes. Wait a minute and try again.' };
      const room = rooms.get(code);
      if (!room) { noteWrong(socket); return { ok: false, error: 'No room with that code' }; }
      const res = E.addPlayer(room.state, { name, avatar });
      if (!res.ok) return res;
      enter(room, 'player', { token: res.token, isHost: false });
      rooms.sync(room, res.events);
      return { ok: true, seat: res.seat, token: res.token, code: room.code };
    });

    on('player:rejoin', ({ code, token }) => {
      if (currentRoom() && (socket.data.role !== 'player' || socket.data.code !== String(code || '').trim().toUpperCase() || socket.data.token !== token))
        return { ok: false, error: 'Leave your existing room before changing player seats' };
      if (tooManyWrong(socket)) return { ok: false, error: 'Too many wrong codes. Wait a minute and try again.' };
      const room = rooms.get(code);
      if (!room) return { ok: false, error: 'That room has closed' };
      const seat = E.seatForToken(room.state, token);
      if (seat < 0) { noteWrong(socket); return { ok: false, error: 'This phone is not in that game' }; }
      enter(room, 'player', { token, isHost: false });
      rooms.autoResumeIfReady(room);
      rooms.sync(room, [{ type: 'playerReconnected', seat }]);
      return { ok: true, seat, code: room.code };
    });

    on('player:leave', () => {
      const room = currentRoom();
      if (!room || socket.data.role !== 'player') return { ok: false, error: 'Not in a game' };
      const seat = rooms.seatOf(room, socket);
      const res = E.removePlayer(room.state, seat);
      if (!res.ok) return res;
      leaveCurrent();
      return { ok: true };
    });

    /* ---------- game actions ---------- */

    on('action', action => {
      const room = currentRoom();
      if (!room || socket.data.role !== 'player') return { ok: false, error: 'Join a game first' };
      if (room.paused) return { ok: false, error: 'The game is paused' };
      const seat = rooms.seatOf(room, socket);
      if (seat < 0) return { ok: false, error: 'You are not in this game' };
      const res = E.apply(room.state, seat, action);
      rooms.touch(room);
      if (!res.ok) return { ok: false, error: res.error };
      rooms.sync(room, res.events);
      return { ok: true };
    });

    /* Live "ghost" preview: the TV shows where a player is about to build. */
    const PREVIEW_KINDS = ['shack', 'path', 'manor', 'mower', 'sinkhole'];
    on('player:preview', ({ what, at }) => {
      const room = currentRoom();
      if (!room || socket.data.role !== 'player') return { ok: false };
      const seat = rooms.seatOf(room, socket);
      if (seat < 0) return { ok: false };
      const clean = {
        seat,
        what: PREVIEW_KINDS.includes(what) ? what : null,
        at: typeof at === 'string' && at.length <= 8 ? at : null
      };
      room.sockets.forEach(s => { if (s.data.role === 'tv') s.emit('preview', clean); });
      return { ok: true };
    });

    /* ---------- host controls ---------- */

    const hostOnly = fn => payload => {
      const room = currentRoom();
      if (!room) return { ok: false, error: 'Not in a game' };
      if (!rooms.isHost(room, socket)) return { ok: false, error: 'Only the host can do that' };
      rooms.touch(room);
      return fn(room, payload);
    };

    on('host:start', hostOnly(room => {
      const res = E.apply(room.state, 0, { type: 'start' });
      if (!res.ok) return { ok: false, error: res.error };
      rooms.sync(room, res.events);
      return { ok: true };
    }));

    on('host:pause', hostOnly(room => {
      const err = rooms.pause(room);
      return err ? { ok: false, error: err } : { ok: true };
    }));

    on('host:resume', hostOnly(room => {
      const err = rooms.resume(room);
      return err ? { ok: false, error: err } : { ok: true };
    }));

    on('host:rematch', hostOnly(room => {
      const err = rooms.rematch(room);
      return err ? { ok: false, error: err } : { ok: true };
    }));

    on('host:kick', hostOnly((room, { seat }) => {
      if (seat === 0) return { ok: false, error: "The host can't kick themselves" };
      const res = E.removePlayer(room.state, seat);
      if (!res.ok) return res;
      rooms.refreshConnected(room);
      rooms.sync(room, res.events); // the kicked phone receives 'kicked' here
      return { ok: true };
    }));

    on('host:close', hostOnly(room => {
      rooms.remove(room);
      return { ok: true };
    }));

    socket.on('disconnect', () => leaveCurrent());
  });
}

module.exports = { attachHandlers };
