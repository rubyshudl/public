import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { TRACKS, LESSONS, QUESTIONS, QUESTION_TYPES } from '../data.js';
import { defaultProfile, normalizeProfile, encryptProfile, decryptProfile, exportVault, parseVaultBackup, validateVault } from '../profile-store.js';

const root = new URL('../', import.meta.url);

test('three learning tracks each contain three complete lessons', () => {
  assert.deepEqual(TRACKS.map(track => track.id), ['analysis', 'gtm', 'globalization']);
  assert.equal(new Set(TRACKS.map(track => track.id)).size, TRACKS.length);
  assert.equal(LESSONS.length, 9);
  assert.equal(new Set(LESSONS.map(lesson => lesson.id)).size, LESSONS.length);
  for (const track of TRACKS) {
    const lessons = LESSONS.filter(lesson => lesson.trackId === track.id);
    assert.equal(lessons.length, 3, track.id);
    assert.deepEqual(lessons.map(lesson => lesson.order), [1, 2, 3]);
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
  assert.equal(QUESTIONS.length, 9);
  assert.equal(new Set(QUESTIONS.map(question => question.id)).size, QUESTIONS.length);
  for (const track of TRACKS) {
    const types = QUESTIONS.filter(question => question.trackId === track.id).map(question => question.type).sort();
    assert.deepEqual(types, Object.keys(QUESTION_TYPES).sort(), track.id);
  }
  for (const question of QUESTIONS) {
    assert.ok(question.title && question.context && question.prompt, question.id);
    assert.ok(question.requirements.length >= 3, question.id);
    assert.ok(question.framework.length >= 5, question.id);
    assert.ok(question.pitfalls.length >= 3, question.id);
    assert.ok(question.duration >= 10, question.id);
  }
});

test('public content contains no personal employer, client, resume or contact data', () => {
  const publicData = JSON.stringify({ TRACKS, LESSONS, QUESTIONS });
  assert.doesNotMatch(publicData, /同程|香格里拉|RedDoorz|舒丹蕾|danlei\.shu|13777594643|HopeGoo/i);
});

test('encrypted profile round-trips while hiding private values and rejecting wrong passwords', async () => {
  const profile = defaultProfile('Ruby');
  profile.completedLessons = [LESSONS[0].id];
  profile.favoriteQuestions = [QUESTIONS[0].id];
  profile.reviewQuestions = [QUESTIONS[1].id];
  profile.drafts[QUESTIONS[0].id] = '这是私人答题草稿与判断。';
  const vault = await encryptProfile(profile, 'correct horse battery', webcrypto);
  assert.equal(vault.cipher, 'AES-256-GCM');
  assert.equal(vault.kdf, 'PBKDF2-SHA256');
  assert.doesNotMatch(JSON.stringify(vault), /Ruby|私人答题草稿/);
  const restored = await decryptProfile(vault, 'correct horse battery', webcrypto);
  assert.equal(restored.name, 'Ruby');
  assert.deepEqual(restored.completedLessons, profile.completedLessons);
  assert.equal(restored.drafts[QUESTIONS[0].id], profile.drafts[QUESTIONS[0].id]);
  await assert.rejects(() => decryptProfile(vault, 'wrong password', webcrypto), /密码不正确/);
  assert.throws(() => validateVault({ ...vault, iterations: 2 }), /加密参数无效/);
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
