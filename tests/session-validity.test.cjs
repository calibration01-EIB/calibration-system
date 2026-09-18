const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app(role, error = null) {
  let stored = JSON.stringify({ token: 'session-token', role: 'admin', name: 'Tester' });
  let reloads = 0, loads = 0;
  const messages = [];
  const ctx = vm.createContext({
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; }, removeItem: () => { stored = null; } },
    calCreateClient: () => ({ rpc: async name => { assert.equal(name, 'app_current_role'); return { data: role, error }; } }),
    location: { reload: () => { reloads++; } },
    document: { body: { classList: { add() {}, remove() {} } }, getElementById: () => ({ style: { setProperty() {} } }) },
    window: { innerWidth: 1000 }, toggleManageColumns() {}, setDriveStatus() {},
    loadData: () => { loads++; }, showToast: message => messages.push(message)
  });
  vm.runInContext(fs.readFileSync('js/01-core.js', 'utf8'), ctx);
  vm.runInContext('currentUser = getSession()', ctx);
  return { ctx, messages, stored: () => stored, reloads: () => reloads, loads: () => loads };
}

test('expired stored token cannot enter the app even with cached admin role', async () => {
  const a = app(null);
  await a.ctx.enterApp(a.ctx.getSession());
  assert.equal(a.loads(), 0);
  assert.equal(a.stored(), null);
  assert.equal(a.reloads(), 1);
});

test('valid session uses the current server role', async () => {
  const a = app('editor');
  await a.ctx.enterApp(a.ctx.getSession());
  assert.equal(a.loads(), 1);
  assert.equal(a.ctx.getSession().role, 'editor');
});

test('network error does not discard login or enter the app', async () => {
  const a = app(null, { message: 'network unavailable' });
  await a.ctx.enterApp(a.ctx.getSession());
  assert.notEqual(a.stored(), null);
  assert.equal(a.loads(), 0);
  assert.equal(a.reloads(), 0);
  assert.match(a.messages[0], /network unavailable/);
});

for (const role of ['admin', 'editor', null, 'viewer']) {
  test(`instrument save checks live session role: ${role}`, async () => {
    const a = app(role);
    if (role === 'admin' || role === 'editor') await a.ctx.requireInstrumentWriteSession();
    else await assert.rejects(() => a.ctx.requireInstrumentWriteSession(), /เข้าสู่ระบบใหม่|สิทธิ์/);
    assert.notEqual(a.stored(), null, 'keep the form session for recovery');
  });
}
