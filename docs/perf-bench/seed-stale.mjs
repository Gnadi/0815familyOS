const PROJECT = 'demo-faos-review';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const PROFILES = { stale: { events: 30, tasks: 20, entries: 30 } };
const PASSWORD = 'bench-pass-123';

const enc = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};
async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const res = await fetch(`${FS}:commit`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
    if (!res.ok) throw new Error(await res.text());
  }
}
const docWrite = (coll, id, data) => ({ update: { name: `projects/${PROJECT}/databases/(default)/documents/${coll}/${id}`, fields: enc(data).mapValue.fields } });
async function signUp(email) {
  const res = await fetch(`${AUTH}/accounts:signUp?key=demo-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }) });
  const j = await res.json(); if (!j.localId) throw new Error(JSON.stringify(j)); return j.localId;
}
// "today" in Europe/Vienna (CET in late November: +01:00)
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date());
const at = (daysAgo, hh) => { const d = new Date(`${ymd}T${String(hh).padStart(2, '0')}:00:00+01:00`); d.setUTCDate(d.getUTCDate() - daysAgo); return d; };

const now = new Date();
const out = {};
for (const [name, p] of Object.entries(PROFILES)) {
  const fid = `fam_${name}`;
  const u1 = await signUp(`${name}-a@bench.test`), u2 = await signUp(`${name}-b@bench.test`);
  const jwk = await crypto.subtle.exportKey('jwk', await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']));
  const kids = [{ id: 'kid_a', name: 'Mia', color: 'pink' }, { id: 'kid_b', name: 'Leo', color: 'sky' }];
  const w = [];
  w.push(docWrite('families', fid, { name: `Bench ${name}`, createdBy: u1, memberIds: [u1, u2], encryptionKeyJwk: jwk, activeInvites: [], kids, createdAt: now }));
  w.push(docWrite('users', u1, { uid: u1, email: `${name}-a@bench.test`, displayName: 'Anna', familyId: fid, createdAt: now }));
  w.push(docWrite('users', u2, { uid: u2, email: `${name}-b@bench.test`, displayName: 'Ben', familyId: fid, createdAt: now }));
  const ev = (i, title, date) => docWrite('events', `${fid}_ev${i}`, { familyId: fid, userId: u1, title, description: '', category: 'general', date, endDate: null, allDay: false, location: '', kids: [kids[i % 2].id], responsibleParent: '', effortLevel: '', recurrence: null, createdAt: now, updatedAt: now });
  w.push(ev(0, 'BENCH-TODAY-EVENT', at(0, 15)));
  for (let i = 1; i < p.events; i++) w.push(ev(i, `Past event ${i}`, at(i, 10)));
  w.push({ ...ev(9001, 'BENCH-RECURRING', at(364, 8)) }); w.at(-1).update.fields.recurrence = { mapValue: { fields: { freq: { stringValue: 'weekly' }, interval: { integerValue: '1' } } } };
  w.push(ev(9002, 'BENCH-MULTIDAY', at(10, 9))); w.at(-1).update.fields.endDate = { timestampValue: at(-5, 18).toISOString() };
  const nDone = Math.round(p.tasks * 0.9);
  for (let i = 0; i < p.tasks; i++) {
    const today = i === 0;
    const status = today ? 'planned' : i <= nDone ? 'completed' : ['backlog', 'planned', 'inProgress'][i % 3];
    w.push(docWrite('tasks', `${fid}_t${i}`, { familyId: fid, userId: u1, title: today ? 'BENCH-TODAY-TASK' : `Task ${i}`, description: '', status, priority: 'medium', category: 'general', points: 3, dueDate: today ? at(0, 12) : at(i % 60, 12), assigneeIds: [i % 2 ? u2 : u1], progress: status === 'completed' ? 100 : 0, recurrence: null, completedAt: status === 'completed' ? at(i % 60, 18) : null, createdAt: now, updatedAt: now }));
  }
  const trackers = ['Bottle', 'Sleep', 'Vitamin D'];
  trackers.forEach((t, i) => w.push(docWrite('trackers', `${fid}_tr${i}`, { familyId: fid, userId: u1, name: t, emoji: '⭐', color: 'brand', kidIds: ['kid_a', 'kid_b'], unit: '', trackValue: false, dailyGoal: null, minIntervalHours: null, order: i, createdAt: now, updatedAt: now })));
  for (let i = 0; i < p.entries; i++) {
    const when = new Date(now.getTime() - (i + 41) * 6 * 3600e3);
    w.push(docWrite('trackerEntries', `${fid}_e${i}`, { familyId: fid, userId: u1, trackerId: `${fid}_tr${i % 3}`, kidId: i % 2 ? 'kid_b' : 'kid_a', at: when, value: null, note: '', createdAt: when }));
  }
  w.push(docWrite('vaccinations', `${fid}_v0`, { familyId: fid, userId: u1, kidId: 'kid_a', name: 'MMR', status: 'next_up', date: at(-20, 12), createdAt: now, updatedAt: now }));
  await commit(w);
  out[name] = { email: `${name}-a@bench.test`, password: PASSWORD, docs5: p.events + p.tasks + 3 + p.entries + 1, writes: w.length };
}
console.log(JSON.stringify(out, null, 1));
