export const VAULT_VERSION = 1;
export const PROFILE_VERSION = 1;
export const PBKDF2_ITERATIONS = 250000;
export const STORAGE_KEY = 'global-growth-lab.encrypted-profile.v1';
const AAD = new TextEncoder().encode('Global Growth Lab encrypted profile v1');

function toBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('加密档案格式无效。');
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function deriveKey(password, salt, iterations, cryptoApi) {
  const material = await cryptoApi.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function defaultProfile(name = '') {
  return {
    version: PROFILE_VERSION,
    name: String(name).trim().slice(0, 30),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedLessons: [],
    favoriteLessons: [],
    favoriteQuestions: [],
    favoriteKnowledgePoints: [],
    reviewQuestions: [],
    drafts: {},
    attempts: {},
    confidence: {},
  };
}

export function normalizeProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== PROFILE_VERSION) throw new Error('个人档案版本无效。');
  const stringList = value => [...new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string') : [])];
  const stringMap = value => Object.fromEntries(Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {}).filter(([, item]) => typeof item === 'string').map(([key, item]) => [key, item.slice(0, 20000)]));
  const attempts = {};
  if (input.attempts && typeof input.attempts === 'object' && !Array.isArray(input.attempts)) {
    for (const [key, value] of Object.entries(input.attempts)) {
      if (value && typeof value === 'object' && typeof value.answer === 'string') attempts[key] = { answer: value.answer.slice(0, 20000), savedAt: typeof value.savedAt === 'string' ? value.savedAt : '' };
    }
  }
  return {
    version: PROFILE_VERSION,
    name: typeof input.name === 'string' ? input.name.trim().slice(0, 30) : '',
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedLessons: stringList(input.completedLessons),
    favoriteLessons: stringList(input.favoriteLessons),
    favoriteQuestions: stringList(input.favoriteQuestions),
    favoriteKnowledgePoints: stringList(input.favoriteKnowledgePoints),
    reviewQuestions: stringList(input.reviewQuestions),
    drafts: stringMap(input.drafts),
    attempts,
    confidence: stringMap(input.confidence),
  };
}

export function validateVault(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('加密档案格式无效。');
  if (input.version !== VAULT_VERSION || input.kdf !== 'PBKDF2-SHA256' || input.cipher !== 'AES-256-GCM') throw new Error('不支持的加密档案版本。');
  if (!Number.isInteger(input.iterations) || input.iterations < 100000 || input.iterations > 2000000) throw new Error('加密参数无效。');
  for (const key of ['salt', 'iv', 'ciphertext']) fromBase64(input[key]);
  if (fromBase64(input.salt).length !== 16 || fromBase64(input.iv).length !== 12 || fromBase64(input.ciphertext).length < 17) throw new Error('加密档案内容无效。');
  return { version: VAULT_VERSION, kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM', iterations: input.iterations, salt: input.salt, iv: input.iv, ciphertext: input.ciphertext };
}

export async function encryptProfile(input, password, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle) throw new Error('当前浏览器不支持安全加密。');
  if (typeof password !== 'string' || password.length < 6) throw new Error('密码至少需要6位。');
  const profile = normalizeProfile(input);
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS, cryptoApi);
  const plaintext = new TextEncoder().encode(JSON.stringify(profile));
  const ciphertext = new Uint8Array(await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plaintext));
  return { version: VAULT_VERSION, kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM', iterations: PBKDF2_ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

export async function decryptProfile(input, password, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle) throw new Error('当前浏览器不支持安全解密。');
  const vault = validateVault(input);
  if (typeof password !== 'string' || !password) throw new Error('请输入密码。');
  try {
    const salt = fromBase64(vault.salt);
    const iv = fromBase64(vault.iv);
    const key = await deriveKey(password, salt, vault.iterations, cryptoApi);
    const plaintext = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, fromBase64(vault.ciphertext));
    return normalizeProfile(JSON.parse(new TextDecoder().decode(plaintext)));
  } catch {
    throw new Error('密码不正确，或加密档案已经损坏。');
  }
}

export function exportVault(vault) {
  return JSON.stringify({ product: 'Global Growth Lab', exportedAt: new Date().toISOString(), vault: validateVault(vault) }, null, 2);
}

export function parseVaultBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('备份文件不是有效JSON。'); }
  return validateVault(parsed?.vault || parsed);
}
