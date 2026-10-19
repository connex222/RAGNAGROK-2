'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { RoomManager } = require('../server/rooms');
const version = require('../package.json').version;
const roomManager = new RoomManager({ rules: 'v2', logger: { log() {}, error() {} } });
const room = roomManager.create();
const view = roomManager.viewFor(room, { data: { role: 'tv', isHost: true } });
assert.equal(view.meta.version, version, 'TV view must reveal current server version');
assert.equal(view.meta.code, room.code);
assert.equal(view.meta.isHost, true);
for (const file of ['index.html', 'play.html']) {
  const source = fs.readFileSync(path.join(__dirname, '../public/v2', file), 'utf8');
  assert.ok(source.includes(`const CLIENT_VERSION = '${version}';`), `Client ${file} must agree with server version`);
  assert.match(source, /id="updateRequired" role="alert" hidden/);
  assert.match(source, /getJSON\('\/healthz'\)\.then\(checkBuild\)/);
  assert.ok(source.includes("$('#reloadForUpdate').addEventListener('click', () => location.reload())"));
  assert.match(source, /if \(!\$\('#updateRequired'\)\.hidden\) return;/);
  const guard = source.match(/const CLIENT_VERSION = '[^']+';[\s\S]*?addEventListener\('click', \(\) => location\.reload\(\)\);/);
  assert.ok(guard, `${file}: missing runnable version guard`);
  let refreshCalls = 0;
  const notice = { hidden: true };
  const reloadControl = { addEventListener(_event, cb) { this.click = cb; } };
  const ctx = { $: id => id === '#updateRequired' ? notice : reloadControl,
    location: { reload() { refreshCalls++; } } };
  vm.createContext(ctx);
  vm.runInContext(guard[0] + '; this.testBuild=checkBuild;', ctx);
  ctx.testBuild({ version });
  assert.equal(notice.hidden, true, 'matching build should not obstruct play');
  ctx.testBuild({ version: 'future-incompatible-release' });
  assert.equal(notice.hidden, false, 'mismatched build must block stale gameplay');
  reloadControl.click();
  assert.equal(refreshCalls, 1, 'update control must refresh the device');
}
console.log('✔ V2 TV and phone detect mismatched builds and provide refresh controls');
