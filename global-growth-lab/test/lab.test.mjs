import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { TRACKS, LESSONS, QUESTIONS, QUESTION_TYPES, FEATURED_LESSONS, SOURCES } from '../data.js';
import { economicsInputs, economicsAnswers, monthlyModel } from '../content/commercial-economics.js';
import { marketData, marketWeights } from '../content/market-entry.js';
import { tableCsv, sectionMarkup, sourcesMarkup, solutionMarkup } from '../reading-ui.js';
import { createProfileWriter } from '../profile-writer.js';
import { defaultProfile, normalizeProfile, encryptProfile, decryptProfile, exportVault, parseVaultBackup, validateVault } from '../profile-store.js';

const root = new URL('../', import.meta.url);

test('tracks preserve stable IDs and distinguish textbooks from legacy outlines', () => {
  assert.deepEqual(TRACKS.map(track => track.id), ['analysis', 'gtm', 'globalization']);
  assert.equal(new Set(TRACKS.map(track => track.id)).size, TRACKS.length);
  assert.ok(LESSONS.length >= 11);
  assert.equal(new Set(LESSONS.map(lesson => lesson.id)).size, LESSONS.length);
  for (const track of TRACKS) {
    const lessons = LESSONS.filter(lesson => lesson.trackId === track.id);
    assert.ok(lessons.length >= 3, track.id);
    assert.equal(new Set(lessons.map(lesson => lesson.order)).size, lessons.length);
    assert.deepEqual(lessons.map(lesson => lesson.order), lessons.map(lesson => lesson.order).sort((a, b) => a - b));
  }
  for (const lesson of LESSONS) {
    assert.ok(lesson.title && lesson.summary && lesson.duration >= 30, lesson.id);
    assert.ok(lesson.outcomes.length >= 3, lesson.id);
    assert.ok(lesson.sections.length >= 3, lesson.id);
    assert.ok(lesson.toolkit.length >= 4, lesson.id);
    assert.ok(lesson.exercise?.prompt && lesson.exercise?.deliverable, lesson.id);
  }
});

test('question bank covers interview, written and scenario practice for every track', () => {
  assert.ok(QUESTIONS.length >= 23);
  assert.equal(new Set(QUESTIONS.map(question => question.id)).size, QUESTIONS.length);
  for (const track of TRACKS) {
    const types = QUESTIONS.filter(question => question.trackId === track.id).map(question => question.type).sort();
    assert.deepEqual([...new Set(types)], Object.keys(QUESTION_TYPES).sort(), track.id);
  }
  for (const question of QUESTIONS) {
    assert.ok(question.title && question.context && question.prompt, question.id);
    assert.ok(question.requirements.length >= 3, question.id);
    assert.ok(question.framework.length >= 5, question.id);
    assert.ok(question.pitfalls.length >= 3, question.id);
    assert.ok(question.duration >= 10, question.id);
  }
});

test('public data is static learning content with explicit fictional provenance', () => {
  const publicData = JSON.stringify({ TRACKS, LESSONS, QUESTIONS });
  assert.doesNotMatch(publicData, /\/Users\/|github\.com\/[^/]+\/private|gh[pousr]_[A-Za-z0-9]{20,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  assert.ok(QUESTIONS.every(question => question.sourceKind === 'mock'));
});

test('encrypted profile round-trips while hiding private values and rejecting wrong passwords', async () => {
  const profile = defaultProfile('Synthetic learner');
  profile.completedLessons = [LESSONS[0].id];
  profile.favoriteQuestions = [QUESTIONS[0].id];
  profile.reviewQuestions = [QUESTIONS[1].id];
  profile.drafts[QUESTIONS[0].id] = '这是私人答题草稿与判断。';
  const vault = await encryptProfile(profile, 'correct horse battery', webcrypto);
  assert.equal(vault.cipher, 'AES-256-GCM');
  assert.equal(vault.kdf, 'PBKDF2-SHA256');
  assert.doesNotMatch(JSON.stringify(vault), /Synthetic learner|私人答题草稿/);
  const restored = await decryptProfile(vault, 'correct horse battery', webcrypto);
  assert.equal(restored.name, 'Synthetic learner');
  assert.deepEqual(restored.completedLessons, profile.completedLessons);
  assert.equal(restored.drafts[QUESTIONS[0].id], profile.drafts[QUESTIONS[0].id]);
  await assert.rejects(() => decryptProfile(vault, 'wrong password', webcrypto), /密码不正确/);
  assert.throws(() => validateVault({ ...vault, iterations: 2 }), /加密参数无效/);
});

test('first batch has complete source-linked lessons, practice and knowledge point IDs', () => {
  assert.equal(FEATURED_LESSONS.length, 3);
  const sourceIds = new Set(SOURCES.map(source => source.id));
  assert.equal(sourceIds.size, SOURCES.length);
  for (const source of SOURCES) {
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.equal(source.checkedAt, '2026-09-17');
    assert.ok(source.kind && source.supports);
  }
  for (const lesson of FEATURED_LESSONS) {
    assert.equal(lesson.depth, 'textbook');
    assert.ok(lesson.sections.length >= 7);
    assert.equal(new Set(lesson.sections.map(section => section.id)).size, lesson.sections.length);
    assert.ok(lesson.english.prompt && lesson.english.answer && lesson.english.notes.length);
    assert.ok(lesson.sourceIds.length && lesson.sourceIds.every(id => sourceIds.has(id)));
    for (const id of lesson.prerequisites) assert.ok(LESSONS.some(item => item.id === id && item.order < lesson.order));
    const questions = QUESTIONS.filter(question => question.lessonId === lesson.id);
    assert.equal(questions.length, 5);
    assert.deepEqual(questions.map(q => q.type).sort(), ['interview', 'interview', 'interview', 'scenario', 'written']);
    for (const question of questions) {
      assert.equal(question.depth, 'worked');
      assert.ok(question.englishPrompt && question.englishAnswer && question.deliverable);
      assert.ok(question.solution.length && question.solution.every(section => section.paragraphs.length >= 2));
      assert.ok(question.followUps.length >= 2 && question.followUps.every(item => item.question && item.answer));
      assert.ok(question.rubric.length >= 3 && question.rubric.every(item => item.excellent && item.partial && item.weak));
      assert.ok(question.sourceIds.every(id => sourceIds.has(id)));
      if (question.type === 'written') assert.ok(question.materials.some(section => section.table));
      assert.match(solutionMarkup(question), /完整|参考|逐|先|不同|增长|不是|历史|从/);
    }
    for (const section of [...lesson.sections, ...questions.flatMap(q => [...q.materials, ...q.solution])]) {
      if (section.table) {
        assert.ok(section.table.caption && section.table.rows.length);
        assert.ok(section.table.rows.every(row => row.length === section.table.headers.length));
      }
    }
  }
  for (const id of ['business-model', 'pipeline-commercial', 'payments-compliance']) assert.ok(LESSONS.some(item => item.id === id));
  for (const id of ['q-partner-model', 'q-pipeline-forecast', 'q-kyb-block']) assert.ok(QUESTIONS.some(item => item.id === id));
});

test('independent arithmetic validates all twelve model rows and scenario totals', () => {
  const i = economicsInputs;
  let balance = -i.initialSetup, active = 0, hotelMonths = 0, revenueTotal = 0, serviceTotal = 0;
  const rows = [];
  for (let month = 1; month <= i.months; month++) {
    active += i.newPerMonth; hotelMonths += active;
    const revenue = active * i.monthlyPrice, service = active * (i.hosting + i.support);
    const newCosts = i.newPerMonth * (i.acquisition + i.onboarding);
    const net = revenue - service - newCosts - i.monthlyFixed;
    balance += net; revenueTotal += revenue; serviceTotal += service;
    rows.push([month, active, revenue, service, revenue - service, newCosts, i.monthlyFixed, net, balance]);
  }
  assert.deepEqual(rows, monthlyModel);
  assert.equal(hotelMonths, economicsAnswers.hotelMonths);
  assert.equal(revenueTotal, economicsAnswers.revenue);
  assert.equal(serviceTotal, economicsAnswers.service);
  assert.equal(revenueTotal - serviceTotal, economicsAnswers.contribution);
  assert.equal(balance, economicsAnswers.netCash);
  assert.equal(Math.min(...rows.map(row => row[8])), -66000);
  assert.equal(rows.find(row => row[7] === 0)[0], 9);
  assert.equal(rows.find(row => row[7] > 0)[0], 10);
  assert.equal((i.acquisition + i.onboarding) / (i.monthlyPrice - i.hosting - i.support), economicsAnswers.payback);
  assert.equal(balance - hotelMonths * 20, -72600);
  for (const [n, price, expected] of [[8, 180, -74880], [10, 200, -57000], [12, 220, -32880]]) {
    let value = -12000;
    for (let m = 1; m <= 12; m++) value += m * n * (price - 50) - n * 750 - 6000;
    assert.equal(value, expected);
  }
});

test('market scores, capacity and commercial exercise numerical checkpoints', () => {
  assert.ok(Math.abs(marketWeights.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.deepEqual(marketData.map(market => Math.min(market.reachable * market.conversion, 20) * market.annualPrice), [24000, 48000, 48000]);
  assert.deepEqual(marketData.map(m => Number(m.scores.reduce((sum, score, index) => sum + score * marketWeights[index], 0).toFixed(2))), [3.05, 3.65, 2.45]);
  assert.deepEqual(marketData.slice(0, 2).map(m => Number(m.scores.reduce((sum, score, index) => sum + score * [0.7, 0.15, 0.1, 0.05][index], 0).toFixed(2))), [4.1, 3.3]);
  assert.equal(1000 * 120 * (0.1 - 0.02) - 1000, 8600);
  assert.equal(200 * 8.6 - 200 * 12 * 0.2 - 1000, 240);
  assert.equal(100 * 8.6 - 200 * 12 * 0.2 - 1000, -620);
  assert.equal(500 * 0.8 * 8.6 - 1200 - 500 * 12 * 0.2, 1040);
  assert.equal(400 * 0.95 * 8.6 - 500 - 400 * 12 * 0.25, 1568);
  assert.equal((10000 - 1000 - 500) / 10000, 0.85);
  assert.equal((10000 - 1000 - 500 + 2000) / 10000, 1.05);
  assert.equal(10 * 2400 - 10 * 12 * 50 - 10 * 750, 10500);
  assert.equal(10 * 1920 - 10 * 12 * 50 - 10 * 750, 5700);
});

test('CSV exports quote values, preserve numbers, and escape formula-like text', () => {
  const csv = tableCsv({ headers: ['name', 'value'], rows: [['=1+1', -57000], ['a,"b', '@formula']] });
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"'=1\+1","-57000"\r\n/);
  assert.match(csv, /"a,""b","'@formula"/);
  assert.match(sectionMarkup({ id: 'x', title: '<script>x</script>', paragraphs: ['<img src=x onerror=alert(1)>'] }), /&lt;script&gt;/);
  assert.doesNotMatch(sectionMarkup({ id: 'x', title: 'x', paragraphs: ['<img src=x>'] }), /<img/);
  assert.match(sourcesMarkup(['amazon-vendor']), /noopener noreferrer/);
});

test('old encrypted v1 backups gain optional knowledge favorites without losing data', async () => {
  const old = defaultProfile('Legacy synthetic');
  delete old.favoriteKnowledgePoints;
  old.favoriteLessons = ['business-model']; old.drafts['q-partner-model'] = 'prior synthetic answer';
  const vault = await encryptProfile(old, 'synthetic-backup-password', webcrypto);
  const restored = await decryptProfile(vault, 'synthetic-backup-password', webcrypto);
  assert.deepEqual(restored.favoriteKnowledgePoints, []);
  assert.deepEqual(restored.favoriteLessons, old.favoriteLessons);
  assert.equal(restored.drafts['q-partner-model'], 'prior synthetic answer');
  restored.favoriteKnowledgePoints.push('business-model:worked-revenue');
  const newer = await decryptProfile(await encryptProfile(restored, 'synthetic-backup-password', webcrypto), 'synthetic-backup-password', webcrypto);
  assert.deepEqual(newer.favoriteKnowledgePoints, ['business-model:worked-revenue']);
});

test('writer captures password and snapshot and waits before export/lock', async () => {
  const writes = [], calls = [];
  let finish;
  const writer = createProfileWriter({ encrypt: async (value, password) => { calls.push([value, password]); await new Promise(resolve => { finish = resolve; }); return value; }, write: value => writes.push(value) });
  const input = { value: 1 }; let password = 'original-secret';
  writer.enqueue(input, password); input.value = 2; password = '';
  await Promise.resolve();
  let flushed = false; const flushing = writer.flush().then(() => { flushed = true; });
  await Promise.resolve(); assert.equal(flushed, false);
  finish(); await flushing;
  assert.deepEqual(calls, [[{ value: 1 }, 'original-secret']]);
  assert.deepEqual(writes, [{ value: 1 }]);
});

test('invalidated in-flight and queued writes cannot overwrite a deleted/imported vault', async () => {
  const writes = []; let finish;
  const writer = createProfileWriter({ encrypt: async value => { if (value.old) await new Promise(resolve => { finish = resolve; }); return value; }, write: value => writes.push(value) });
  writer.enqueue({ old: true }, 'old-secret');
  writer.enqueue({ queued: true }, 'old-secret');
  await Promise.resolve(); writer.invalidate();
  writer.enqueue({ imported: true }, 'new-secret'); finish(); await writer.flush();
  assert.deepEqual(writes, [{ imported: true }]);
});

test('write failures block flush until an explicit successful retry', async () => {
  let fail = true;
  const writer = createProfileWriter({ encrypt: async value => value, write: () => { if (fail) throw new Error('storage full'); } });
  await writer.enqueue({ x: 1 }, 'secret');
  await assert.rejects(writer.flush(), /storage full/);
  fail = false; await writer.enqueue({ x: 2 }, 'secret'); await writer.flush();
});

test('encrypted backup can be parsed without including its password', async () => {
  const vault = await encryptProfile(defaultProfile('Test'), '12345678', webcrypto);
  const backup = exportVault(vault);
  assert.doesNotMatch(backup, /12345678/);
  assert.deepEqual(parseVaultBackup(backup), vault);
  assert.deepEqual(parseVaultBackup(JSON.stringify(vault)), vault);
  assert.throws(() => parseVaultBackup('{'), /不是有效JSON/);
});

test('profile normalization limits malformed lists, maps and draft sizes', () => {
  const input = defaultProfile('  A deliberately very long profile name that must be truncated safely  ');
  input.completedLessons = ['a', 'a', 3, null];
  input.favoriteLessons = null;
  input.drafts = { q1: 'x'.repeat(21000), q2: 4 };
  input.attempts = { q1: { answer: 'answer', savedAt: 'now' }, bad: null };
  const result = normalizeProfile(input);
  assert.equal(result.name.length, 30);
  assert.deepEqual(result.completedLessons, ['a']);
  assert.deepEqual(result.favoriteLessons, []);
  assert.equal(result.drafts.q1.length, 20000);
  assert.equal(result.drafts.q2, undefined);
  assert.deepEqual(result.attempts.q1, { answer: 'answer', savedAt: 'now' });
});

test('static site has secure profile UI, no external runtime assets and public directory registration', async () => {
  const [html, app, projects, rootReadme] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('../projects.js', root), 'utf8'),
    readFile(new URL('../README.md', root), 'utf8'),
  ]);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /id="profileDialog"/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i);
  assert.match(app, /encryptProfile/);
  assert.match(app, /先写下至少20字/);
  assert.match(app, /state\.tempDrafts = \{\}; state\.revealed\.clear\(\)/);
  assert.match(projects, /\.\/global-growth-lab\//);
  assert.match(rootReadme, /global-growth-lab/);
});
