import { TRACKS, LESSONS, QUESTIONS, QUESTION_TYPES } from './data.js';
import {
  STORAGE_KEY, defaultProfile, normalizeProfile, encryptProfile, decryptProfile,
  exportVault, parseVaultBackup, validateVault,
} from './profile-store.js';

const $ = id => document.getElementById(id);
const content = $('content');
const state = {
  route: 'home',
  routeId: '',
  search: '',
  learnTrack: 'all',
  practiceTrack: 'all',
  practiceType: 'all',
  revealed: new Set(),
  tempDrafts: {},
  pendingImport: null,
  authMode: 'create',
};
let profile = null;
let sessionPassword = '';
let saveQueue = Promise.resolve();
let toastTimer;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const trackById = id => TRACKS.find(track => track.id === id);
const lessonById = id => LESSONS.find(lesson => lesson.id === id);
const questionById = id => QUESTIONS.find(question => question.id === id);
const includes = (list, id) => Boolean(profile && profile[list].includes(id));
const routeHref = (route, id = '') => `#${route}${id ? `/${id}` : ''}`;

function showToast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}

function navigate(route, id = '') {
  const next = routeHref(route, id);
  if (location.hash === next) render(); else location.hash = next;
}

function parseRoute() {
  const [route = 'home', id = ''] = location.hash.replace(/^#/, '').split('/');
  const allowed = ['home', 'learn', 'practice', 'review', 'favorites', 'lesson', 'question', 'search'];
  state.route = allowed.includes(route) ? route : 'home';
  state.routeId = id;
  if (state.route === 'learn') state.learnTrack = trackById(id) ? id : 'all';
}

function updateNavigation() {
  const parent = state.route === 'lesson' ? 'learn' : state.route === 'question' ? 'practice' : state.route === 'search' ? '' : state.route;
  document.querySelectorAll('#mainNav [data-route]').forEach(link => {
    const active = link.dataset.route === parent;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}

function vaultFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? validateVault(JSON.parse(raw)) : null;
  } catch { return null; }
}

function updateProfileButton() {
  $('profileButtonText').textContent = profile ? (profile.name || '已解锁') : vaultFromStorage() ? '解锁档案' : '个人档案';
  $('profileButton').classList.toggle('unlocked', Boolean(profile));
  $('saveStatus').hidden = !profile;
  if (profile) $('saveStatus').textContent = '档案已解锁 · 自动加密保存';
}

function profileCounts() {
  return {
    completed: profile?.completedLessons.length || 0,
    favorites: (profile?.favoriteLessons.length || 0) + (profile?.favoriteQuestions.length || 0),
    review: profile?.reviewQuestions.length || 0,
  };
}

function safeSaveProfile(message = '') {
  if (!profile || !sessionPassword) return;
  profile = normalizeProfile(profile);
  const snapshot = structuredClone(profile);
  $('saveStatus').textContent = '正在加密保存…';
  saveQueue = saveQueue.then(async () => {
    const vault = await encryptProfile(snapshot, sessionPassword);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
    $('saveStatus').textContent = '已加密保存到本机';
    if (message) showToast(message);
  }).catch(error => {
    $('saveStatus').textContent = '保存失败';
    showToast(error.message || '个人档案保存失败。');
  });
}

function requireProfile() {
  if (profile) return true;
  openProfileDialog();
  showToast('请先创建或解锁个人档案，再保存进度。');
  return false;
}

function pageHead(eyebrow, title, copy = '') {
  return `<header class="page-head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1></div>${copy ? `<p>${escapeHtml(copy)}</p>` : ''}</header>`;
}

function lockedCallout() {
  if (profile) return '';
  return `<div class="locked-callout"><p><strong>公开内容可以直接学习。</strong><br>创建或解锁本地加密档案后，可保存收藏、进度、错题和答题草稿。</p><button class="button primary" type="button" data-open-profile>解锁个人档案</button></div>`;
}

function trackProgress(trackId) {
  const lessons = LESSONS.filter(lesson => lesson.trackId === trackId);
  const completed = lessons.filter(lesson => includes('completedLessons', lesson.id)).length;
  return { completed, total: lessons.length, percent: lessons.length ? Math.round(completed / lessons.length * 100) : 0 };
}

function trackCards() {
  return TRACKS.map(track => {
    const progress = trackProgress(track.id);
    const progressClass = progress.percent === 100 ? 'p100' : progress.percent >= 67 ? 'p67' : progress.percent >= 33 ? 'p33' : 'p0';
    return `<article class="track-card panel ${track.color}">
      <a class="card-link-cover" href="${routeHref('learn', track.id)}" aria-label="进入${escapeHtml(track.title)}学习轨道"></a>
      <span class="track-number">${track.number}</span><h3>${escapeHtml(track.title)}</h3><span class="track-en">${escapeHtml(track.english)}</span>
      <p>${escapeHtml(track.description)}</p>
      <div class="track-progress"><div class="progress-line"><span class="${progressClass}"></span></div><small><span>${progress.completed} / ${progress.total}课完成</span><span>${progress.percent}%</span></small></div>
    </article>`;
  }).join('');
}

function renderHome() {
  const counts = profileCounts();
  const nextLesson = LESSONS.find(lesson => !includes('completedLessons', lesson.id)) || LESSONS[0];
  content.innerHTML = `<section class="hero">
    <article class="hero-main panel"><p class="eyebrow">GLOBAL GROWTH PLAYBOOK</p><h1>从知识点，走到<br><span>可落地的商业判断。</span></h1><p>系统学习商业分析、海外GTM与出海商业化；用面试题、笔试题和虚构商业场景，把框架练成可复用的工作方法。</p><div class="hero-actions"><a class="button primary" href="${routeHref('lesson', nextLesson.id)}">${profile ? '继续学习' : '开始学习'} · ${escapeHtml(nextLesson.title)}</a><button class="button secondary" type="button" data-random>随机抽一道题</button></div></article>
    <aside class="hero-side panel"><p class="quote">“先定义要做的<strong>决策</strong>，<br>再决定需要哪些数据。”</p><small>框架不是标准答案，而是让证据、取舍和行动可以被检查。</small></aside>
  </section>
  ${lockedCallout()}
  <section class="stats-grid" aria-label="学习概览">
    <article class="stat-card panel"><span>知识模块</span><strong>${LESSONS.length}</strong><small>三条学习轨道</small><i></i></article>
    <article class="stat-card panel"><span>已完成</span><strong>${profile ? counts.completed : '—'}</strong><small>${profile ? `共${LESSONS.length}课` : '解锁后记录'}</small><i></i></article>
    <article class="stat-card panel"><span>待复习</span><strong>${profile ? counts.review : '—'}</strong><small>错题与薄弱场景</small><i></i></article>
    <article class="stat-card panel"><span>收藏</span><strong>${profile ? counts.favorites : '—'}</strong><small>知识点与题目</small><i></i></article>
  </section>
  <div class="section-heading"><div><p class="eyebrow">LEARNING TRACKS</p><h2>三条轨道，构成一套增长系统</h2></div><span>${LESSONS.length}个基础模块 · ${QUESTIONS.length}道首发实战题</span></div>
  <section class="track-grid">${trackCards()}</section>
  <div class="section-heading"><div><p class="eyebrow">HOW IT WORKS</p><h2>学习闭环</h2></div></div>
  <section class="workflow panel"><article><span>01</span><h3>学框架</h3><p>理解概念、口径、边界和常用工具。</p></article><article><span>02</span><h3>做产出</h3><p>画指标树、GTM画布或商业方案。</p></article><article><span>03</span><h3>答实战题</h3><p>先独立作答，再展开参考框架。</p></article><article><span>04</span><h3>进入复习队列</h3><p>标记薄弱题目，持续校正判断。</p></article></section>`;
}

function lessonCard(lesson) {
  const track = trackById(lesson.trackId);
  const completed = includes('completedLessons', lesson.id);
  const favorite = includes('favoriteLessons', lesson.id);
  return `<article class="lesson-card panel">
    <span class="lesson-order">${String(lesson.order).padStart(2, '0')}</span>
    <div class="lesson-copy"><a href="${routeHref('lesson', lesson.id)}"><h3>${escapeHtml(lesson.title)}</h3></a><p>${escapeHtml(lesson.summary)}</p><div class="lesson-meta"><span class="chip">${escapeHtml(track.title)}</span><span class="chip">${lesson.duration}分钟</span><span class="chip">${escapeHtml(lesson.level)}</span>${favorite ? '<span class="chip">★ 已收藏</span>' : ''}</div></div>
    <div class="lesson-state">${completed ? '<strong>✓ 已完成</strong>' : '待学习'}</div>
  </article>`;
}

function renderLearn() {
  const selected = state.learnTrack;
  const lessons = LESSONS.filter(lesson => selected === 'all' || lesson.trackId === selected);
  content.innerHTML = `${pageHead('LEARN', selected === 'all' ? '知识轨道' : trackById(selected).title, selected === 'all' ? '按顺序学习，也可以直接进入当前面试需要的模块。' : trackById(selected).outcome)}${lockedCallout()}
    <div class="filter-bar"><select id="learnTrack" aria-label="筛选学习轨道"><option value="all">全部轨道</option>${TRACKS.map(track => `<option value="${track.id}" ${track.id === selected ? 'selected' : ''}>${escapeHtml(track.title)}</option>`).join('')}</select></div>
    <section class="lesson-list">${lessons.map(lessonCard).join('')}</section>`;
}

function questionCard(question) {
  const track = trackById(question.trackId);
  const favorite = includes('favoriteQuestions', question.id);
  const review = includes('reviewQuestions', question.id);
  return `<article class="question-card panel"><a class="card-link-cover" href="${routeHref('question', question.id)}" aria-label="打开题目：${escapeHtml(question.title)}"></a>
    <div class="question-type"><span>${escapeHtml(QUESTION_TYPES[question.type])}</span><span>${escapeHtml(question.difficulty)} · ${question.duration}分钟</span></div>
    <h3>${escapeHtml(question.title)}</h3><p>${escapeHtml(question.context)}</p>
    <div class="question-footer"><span>${escapeHtml(track.title)}</span><span class="${review ? 'marked' : ''}">${review ? '● 待复习' : favorite ? '★ 已收藏' : '打开作答 →'}</span></div>
  </article>`;
}

function renderPractice() {
  const questions = QUESTIONS.filter(question =>
    (state.practiceTrack === 'all' || question.trackId === state.practiceTrack)
    && (state.practiceType === 'all' || question.type === state.practiceType));
  content.innerHTML = `${pageHead('PRACTICE', '实战题库', '所有案例均为虚构业务。先写下自己的判断，再看参考框架。')}${lockedCallout()}
    <div class="filter-bar"><select id="practiceTrack" aria-label="筛选题目轨道"><option value="all">全部轨道</option>${TRACKS.map(track => `<option value="${track.id}" ${track.id === state.practiceTrack ? 'selected' : ''}>${escapeHtml(track.title)}</option>`).join('')}</select><select id="practiceType" aria-label="筛选题型"><option value="all">全部题型</option>${Object.entries(QUESTION_TYPES).map(([value, label]) => `<option value="${value}" ${value === state.practiceType ? 'selected' : ''}>${label}</option>`).join('')}</select><button class="button secondary" type="button" data-random>随机抽题</button></div>
    <section class="question-grid">${questions.map(questionCard).join('')}</section>`;
}

function renderLesson() {
  const lesson = lessonById(state.routeId);
  if (!lesson) return renderNotFound();
  const track = trackById(lesson.trackId);
  const favorite = includes('favoriteLessons', lesson.id);
  const completed = includes('completedLessons', lesson.id);
  const confidence = profile?.confidence[lesson.id] || 'learning';
  content.innerHTML = `<div class="detail-layout"><article class="detail-main panel">
    <nav class="breadcrumb"><a href="#learn">知识轨道</a><span>›</span><a href="${routeHref('learn', track.id)}">${escapeHtml(track.title)}</a><span>›</span><span>${escapeHtml(lesson.title)}</span></nav>
    <div class="detail-title-row"><div class="detail-title"><p class="eyebrow">${escapeHtml(track.english)} · ${lesson.duration} MIN</p><h1>${escapeHtml(lesson.title)}</h1><p>${escapeHtml(lesson.summary)}</p></div><button class="action-icon ${favorite ? 'active' : ''}" type="button" data-favorite-lesson="${lesson.id}" aria-label="${favorite ? '取消收藏' : '收藏'}">${favorite ? '★' : '☆'}</button></div>
    <div class="outcome-box"><strong>完成本节后，你应该能够</strong><ul>${lesson.outcomes.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div>
    ${lesson.sections.map(section => `<section class="lesson-section"><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map(value => `<p>${escapeHtml(value)}</p>`).join('')}<ul>${section.bullets.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></section>`).join('')}
    <section class="lesson-section"><h2>常用工具</h2><div class="toolkit">${lesson.toolkit.map(value => `<span class="chip">${escapeHtml(value)}</span>`).join('')}</div></section>
    <section class="exercise-box"><p class="eyebrow">PRACTICE OUTPUT</p><h3>${escapeHtml(lesson.exercise.title)}</h3><p>${escapeHtml(lesson.exercise.prompt)}</p><p><strong>交付物：</strong>${escapeHtml(lesson.exercise.deliverable)}</p></section>
  </article><aside class="detail-aside">
    <section class="aside-card panel"><h3>学习状态</h3><p>${profile ? '状态会自动加密保存。' : '解锁个人档案后可记录。'}</p><button class="button ${completed ? 'secondary' : 'primary'}" type="button" data-complete-lesson="${lesson.id}">${completed ? '✓ 已完成 · 点击撤销' : '标记本节完成'}</button><select class="confidence-picker" data-confidence="${lesson.id}" ${profile ? '' : 'disabled'}><option value="learning" ${confidence === 'learning' ? 'selected' : ''}>正在学习</option><option value="review" ${confidence === 'review' ? 'selected' : ''}>需要复习</option><option value="mastered" ${confidence === 'mastered' ? 'selected' : ''}>可以应用</option></select></section>
    <section class="aside-card panel"><h3>关键词</h3><div class="toolkit">${lesson.keywords.map(value => `<span class="chip">${escapeHtml(value)}</span>`).join('')}</div></section>
    <section class="aside-card panel"><h3>继续实战</h3><p>用同一轨道的题目检查是否真正掌握。</p><a class="button secondary" href="#practice" data-set-practice-track="${track.id}">查看相关题目</a></section>
  </aside></div>`;
}

function currentDraft(questionId) {
  return state.tempDrafts[questionId] ?? profile?.drafts[questionId] ?? profile?.attempts[questionId]?.answer ?? '';
}

function renderQuestion() {
  const question = questionById(state.routeId);
  if (!question) return renderNotFound();
  const track = trackById(question.trackId);
  const favorite = includes('favoriteQuestions', question.id);
  const review = includes('reviewQuestions', question.id);
  const revealed = state.revealed.has(question.id);
  const draft = currentDraft(question.id);
  content.innerHTML = `<div class="detail-layout"><article class="detail-main panel">
    <nav class="breadcrumb"><a href="#practice">实战题库</a><span>›</span><span>${escapeHtml(track.title)}</span><span>›</span><span>${escapeHtml(question.title)}</span></nav>
    <div class="detail-title-row"><div class="detail-title"><p class="eyebrow">${escapeHtml(QUESTION_TYPES[question.type])} · ${escapeHtml(question.difficulty)} · ${question.duration} MIN</p><h1>${escapeHtml(question.title)}</h1><p>${escapeHtml(question.context)}</p></div><button class="action-icon ${favorite ? 'active' : ''}" type="button" data-favorite-question="${question.id}" aria-label="${favorite ? '取消收藏' : '收藏'}">${favorite ? '★' : '☆'}</button></div>
    <div class="prompt-box"><strong>你的任务</strong><p>${escapeHtml(question.prompt)}</p></div>
    <section class="requirements"><h3>回答至少覆盖</h3><ul>${question.requirements.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></section>
    <div class="answer-area"><label for="answerDraft">先写下你的回答 <span id="answerCount">${draft.length} / 20000</span></label><textarea id="answerDraft" maxlength="20000" placeholder="先列结构，再补证据、取舍、行动和风险…">${escapeHtml(draft)}</textarea><div class="answer-actions"><button class="button primary" type="button" data-save-answer="${question.id}">保存到加密档案</button><button class="button secondary" type="button" data-reveal="${question.id}">${revealed ? '隐藏参考框架' : '完成作答后看参考框架'}</button><button class="button secondary" type="button" data-review-question="${question.id}">${review ? '✓ 已加入待复习' : '加入待复习'}</button></div></div>
    ${revealed ? `<section class="framework-box"><h2>参考思考框架</h2><ol>${question.framework.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ol><div class="pitfalls"><h3>常见误区</h3><ul>${question.pitfalls.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div></section>` : ''}
  </article><aside class="detail-aside"><section class="aside-card panel"><h3>作答规则</h3><p>先独立写下至少20字，再展开参考框架。框架用于检查遗漏，不是唯一答案。</p></section><section class="aside-card panel"><h3>个人档案</h3><p>${profile ? '草稿、收藏与复习标记可加密保存。' : '当前回答只留在此页面，刷新前请解锁并保存。'}</p>${profile ? '' : '<button class="button primary" type="button" data-open-profile>解锁档案</button>'}</section><section class="aside-card panel"><h3>再抽一道</h3><button class="button secondary" type="button" data-random>随机抽题</button></section></aside></div>`;
}

function renderReview() {
  if (!profile) {
    content.innerHTML = `${pageHead('REVIEW', '待复习', '用错题和薄弱场景形成自己的复习队列。')}<section class="empty-state panel"><span>◇</span><h2>个人档案尚未解锁</h2><p>公开题目仍可直接作答；解锁后才能查看和保存私人复习队列。</p><button class="button primary" type="button" data-open-profile>创建或解锁档案</button></section>`;
    return;
  }
  const questions = profile.reviewQuestions.map(questionById).filter(Boolean);
  const weakLessons = LESSONS.filter(lesson => profile.confidence[lesson.id] === 'review');
  content.innerHTML = `${pageHead('REVIEW', '待复习', '先处理反复遗漏的知识和场景，而不是继续收藏更多内容。')}
    <div class="section-heading"><div><p class="eyebrow">QUESTIONS</p><h2>错题与薄弱场景</h2></div><span>${questions.length}题</span></div>
    ${questions.length ? `<section class="question-grid">${questions.map(questionCard).join('')}</section>` : emptyMarkup('没有待复习题', '作答后将薄弱题目加入这里。', 'practice', '去做实战题')}
    <div class="section-heading"><div><p class="eyebrow">KNOWLEDGE</p><h2>需要复习的知识</h2></div><span>${weakLessons.length}课</span></div>
    ${weakLessons.length ? `<section class="lesson-list">${weakLessons.map(lessonCard).join('')}</section>` : emptyMarkup('没有薄弱知识标记', '在课程页将掌握状态设置为“需要复习”。', 'learn', '查看知识轨道')}`;
}

function renderFavorites() {
  if (!profile) {
    content.innerHTML = `${pageHead('FAVORITES', '收藏夹', '保存值得反复使用的框架和题目。')}<section class="empty-state panel"><span>☆</span><h2>个人档案尚未解锁</h2><p>解锁后收藏内容会加密保存在当前浏览器。</p><button class="button primary" type="button" data-open-profile>创建或解锁档案</button></section>`;
    return;
  }
  const lessons = profile.favoriteLessons.map(lessonById).filter(Boolean);
  const questions = profile.favoriteQuestions.map(questionById).filter(Boolean);
  content.innerHTML = `${pageHead('FAVORITES', '收藏夹', '只收藏会再次使用的框架，定期把收藏转成练习。')}
    <div class="section-heading"><div><p class="eyebrow">KNOWLEDGE</p><h2>收藏的知识</h2></div><span>${lessons.length}课</span></div>
    ${lessons.length ? `<section class="lesson-list">${lessons.map(lessonCard).join('')}</section>` : emptyMarkup('还没有收藏知识', '在课程页点击星标即可收藏。', 'learn', '浏览知识轨道')}
    <div class="section-heading"><div><p class="eyebrow">PRACTICE</p><h2>收藏的题目</h2></div><span>${questions.length}题</span></div>
    ${questions.length ? `<section class="question-grid">${questions.map(questionCard).join('')}</section>` : emptyMarkup('还没有收藏题目', '在题目页点击星标即可收藏。', 'practice', '浏览实战题库')}`;
}

function searchableText(item, type) {
  return type === 'lesson'
    ? [item.title, item.summary, ...item.keywords, ...item.toolkit, ...item.sections.flatMap(section => [section.title, ...section.paragraphs, ...section.bullets])].join(' ')
    : [item.title, item.context, item.prompt, ...item.requirements, ...item.framework, ...item.pitfalls].join(' ');
}

function renderSearch() {
  const query = state.search.trim().toLocaleLowerCase('zh-CN');
  const lessons = query ? LESSONS.filter(item => searchableText(item, 'lesson').toLocaleLowerCase('zh-CN').includes(query)) : [];
  const questions = query ? QUESTIONS.filter(item => searchableText(item, 'question').toLocaleLowerCase('zh-CN').includes(query)) : [];
  content.innerHTML = `${pageHead('SEARCH', `搜索：${state.search || '—'}`, `找到${lessons.length}个知识模块和${questions.length}道题。`)}
    ${!query ? emptyMarkup('输入关键词开始搜索', '可搜索指标、框架、渠道、合规或场景。', 'home', '返回首页') : ''}
    ${lessons.length ? `<div class="section-heading"><div><p class="eyebrow">KNOWLEDGE</p><h2>知识模块</h2></div></div><section class="lesson-list search-results">${lessons.map(lessonCard).join('')}</section>` : ''}
    ${questions.length ? `<div class="section-heading"><div><p class="eyebrow">QUESTIONS</p><h2>实战题目</h2></div></div><section class="question-grid search-results">${questions.map(questionCard).join('')}</section>` : ''}
    ${query && !lessons.length && !questions.length ? emptyMarkup('没有匹配内容', '尝试“指标树”“GTM”“管线”“支付”或“合规”。', 'home', '返回首页') : ''}`;
}

function emptyMarkup(title, copy, route, button) {
  return `<section class="empty-state panel"><span>⌕</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p><a class="button secondary" href="${routeHref(route)}">${escapeHtml(button)}</a></section>`;
}

function renderNotFound() {
  content.innerHTML = emptyMarkup('页面不存在', '内容可能尚未发布或链接已经变化。', 'home', '返回学习首页');
}

function render() {
  parseRoute();
  updateNavigation();
  updateProfileButton();
  if (state.route === 'home') renderHome();
  else if (state.route === 'learn') renderLearn();
  else if (state.route === 'practice') renderPractice();
  else if (state.route === 'lesson') renderLesson();
  else if (state.route === 'question') renderQuestion();
  else if (state.route === 'review') renderReview();
  else if (state.route === 'favorites') renderFavorites();
  else if (state.route === 'search') renderSearch();
  else renderNotFound();
  content.focus({ preventScroll: true });
  closeMobileNav();
}

function toggleList(list, id) {
  const values = new Set(profile[list]);
  if (values.has(id)) values.delete(id); else values.add(id);
  profile[list] = [...values];
}

function randomQuestion() {
  const pool = QUESTIONS.filter(question => question.id !== state.routeId);
  const question = pool[Math.floor(Math.random() * pool.length)] || QUESTIONS[0];
  navigate('question', question.id);
}

function openProfileDialog(mode = '') {
  const vault = vaultFromStorage();
  state.authMode = mode || (profile ? 'manage' : vault ? 'unlock' : 'create');
  $('profileAuth').hidden = state.authMode === 'manage';
  $('profileManage').hidden = state.authMode !== 'manage';
  $('profileError').hidden = true;
  $('profilePassword').value = '';
  if (state.authMode === 'manage') {
    const counts = profileCounts();
    $('manageTitle').textContent = `${profile.name || '个人'}档案已解锁`;
    $('profileStats').innerHTML = `<div><strong>${counts.completed}</strong><span>已完成课程</span></div><div><strong>${counts.favorites}</strong><span>收藏</span></div><div><strong>${counts.review}</strong><span>待复习题</span></div>`;
  } else if (state.authMode === 'create') {
    $('profileTitle').textContent = '创建个人学习档案';
    $('profileCopy').textContent = '设置一个密码，用于加密当前浏览器中的收藏、进度、错题和答题草稿。';
    $('profileNameField').hidden = false;
    $('profileSubmit').textContent = '创建并解锁';
    $('profilePassword').autocomplete = 'new-password';
  } else if (state.authMode === 'import') {
    $('profileTitle').textContent = '解锁导入的加密备份';
    $('profileCopy').textContent = '输入该备份创建时使用的密码。验证成功后才会替换当前浏览器档案。';
    $('profileNameField').hidden = true;
    $('profileSubmit').textContent = '验证并导入';
    $('profilePassword').autocomplete = 'current-password';
  } else {
    $('profileTitle').textContent = '解锁个人学习档案';
    $('profileCopy').textContent = '输入密码，解锁当前浏览器中的收藏、进度、错题和答题草稿。';
    $('profileNameField').hidden = true;
    $('profileSubmit').textContent = '解锁档案';
    $('profilePassword').autocomplete = 'current-password';
  }
  if (!$('profileDialog').open) $('profileDialog').showModal();
  setTimeout(() => (state.authMode === 'create' ? $('profileName') : $('profilePassword')).focus(), 0);
}

async function submitProfile(event) {
  event.preventDefault();
  const password = $('profilePassword').value;
  $('profileError').hidden = true;
  $('profileSubmit').disabled = true;
  try {
    let nextProfile;
    if (state.authMode === 'create') {
      nextProfile = defaultProfile($('profileName').value);
      const vault = await encryptProfile(nextProfile, password);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
    } else if (state.authMode === 'import') {
      nextProfile = await decryptProfile(state.pendingImport, password);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pendingImport));
      state.pendingImport = null;
    } else {
      nextProfile = await decryptProfile(vaultFromStorage(), password);
    }
    profile = nextProfile;
    sessionPassword = password;
    $('profileDialog').close();
    render();
    showToast(state.authMode === 'create' ? '个人档案已创建并加密保存。' : '个人档案已解锁。');
  } catch (error) {
    $('profileError').textContent = error.message || '操作失败。';
    $('profileError').hidden = false;
  } finally { $('profileSubmit').disabled = false; }
}

function download(contentValue, filename) {
  const url = URL.createObjectURL(new Blob([contentValue], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function openMobileNav() {
  document.body.classList.add('nav-open');
  $('navScrim').hidden = false;
  $('menuButton').setAttribute('aria-expanded', 'true');
}
function closeMobileNav() {
  document.body.classList.remove('nav-open');
  $('navScrim').hidden = true;
  $('menuButton').setAttribute('aria-expanded', 'false');
}

content.addEventListener('click', event => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.matches('[data-open-profile]')) openProfileDialog();
  if (target.matches('[data-random]')) randomQuestion();
  if (target.dataset.favoriteLesson) {
    if (!requireProfile()) return;
    toggleList('favoriteLessons', target.dataset.favoriteLesson); safeSaveProfile('知识收藏已更新。'); render();
  }
  if (target.dataset.favoriteQuestion) {
    if (!requireProfile()) return;
    toggleList('favoriteQuestions', target.dataset.favoriteQuestion); safeSaveProfile('题目收藏已更新。'); render();
  }
  if (target.dataset.completeLesson) {
    if (!requireProfile()) return;
    toggleList('completedLessons', target.dataset.completeLesson); safeSaveProfile('学习进度已更新。'); render();
  }
  if (target.dataset.reviewQuestion) {
    if (!requireProfile()) return;
    toggleList('reviewQuestions', target.dataset.reviewQuestion); safeSaveProfile('复习队列已更新。'); render();
  }
  if (target.dataset.saveAnswer) {
    if (!requireProfile()) return;
    const answer = $('answerDraft')?.value.trim() || '';
    if (!answer) return showToast('请先写下回答，再保存。');
    profile.drafts[target.dataset.saveAnswer] = answer;
    profile.attempts[target.dataset.saveAnswer] = { answer, savedAt: new Date().toISOString() };
    state.tempDrafts[target.dataset.saveAnswer] = answer;
    safeSaveProfile('答题草稿已加密保存。');
  }
  if (target.dataset.reveal) {
    const id = target.dataset.reveal;
    const answer = $('answerDraft')?.value.trim() || '';
    if (!state.revealed.has(id) && answer.length < 20) return showToast('先写下至少20字的思路，再查看参考框架。');
    if (state.revealed.has(id)) state.revealed.delete(id); else state.revealed.add(id);
    state.tempDrafts[id] = $('answerDraft')?.value || '';
    renderQuestion();
  }
  if (target.dataset.setPracticeTrack) state.practiceTrack = target.dataset.setPracticeTrack;
});

content.addEventListener('input', event => {
  if (event.target.id === 'answerDraft') {
    state.tempDrafts[state.routeId] = event.target.value;
    $('answerCount').textContent = `${event.target.value.length} / 20000`;
  }
});

content.addEventListener('change', event => {
  if (event.target.id === 'learnTrack') { state.learnTrack = event.target.value; navigate('learn', event.target.value === 'all' ? '' : event.target.value); }
  if (event.target.id === 'practiceTrack') { state.practiceTrack = event.target.value; renderPractice(); }
  if (event.target.id === 'practiceType') { state.practiceType = event.target.value; renderPractice(); }
  if (event.target.dataset.confidence) {
    if (!requireProfile()) return;
    profile.confidence[event.target.dataset.confidence] = event.target.value;
    safeSaveProfile('掌握状态已更新。');
  }
});

$('globalSearch').addEventListener('input', event => {
  state.search = event.target.value;
  if (state.search.trim()) navigate('search'); else if (state.route === 'search') navigate('home');
  if (state.route === 'search') renderSearch();
});
$('globalSearch').addEventListener('keydown', event => { if (event.key === 'Escape') { event.target.value = ''; state.search = ''; navigate('home'); } });
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('globalSearch').focus(); }
});
$('randomButton').addEventListener('click', randomQuestion);
$('profileButton').addEventListener('click', () => openProfileDialog());
$('profileForm').addEventListener('submit', submitProfile);
$('menuButton').addEventListener('click', openMobileNav);
$('navScrim').addEventListener('click', closeMobileNav);

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) $(close.dataset.close).close();
});

$('exportProfile').addEventListener('click', () => {
  const vault = vaultFromStorage();
  if (!vault) return showToast('当前没有可导出的加密档案。');
  download(exportVault(vault), `global-growth-lab-backup-${new Date().toISOString().slice(0, 10)}.json`);
  showToast('已导出加密备份。密码未包含在文件中。');
});
$('importProfile').addEventListener('click', () => $('importInput').click());
$('importInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try { state.pendingImport = parseVaultBackup(await file.text()); $('profileDialog').close(); openProfileDialog('import'); }
  catch (error) { showToast(error.message || '无法读取备份。'); }
});
$('lockProfile').addEventListener('click', () => {
  profile = null; sessionPassword = ''; state.tempDrafts = {}; state.revealed.clear();
  $('profileDialog').close(); render(); showToast('个人档案已锁定。');
});
$('deleteProfile').addEventListener('click', () => {
  if (!confirm('确定删除当前浏览器中的加密档案吗？此操作无法撤销，建议先导出备份。')) return;
  localStorage.removeItem(STORAGE_KEY); profile = null; sessionPassword = ''; state.tempDrafts = {}; state.revealed.clear();
  $('profileDialog').close(); render(); showToast('本机加密档案已删除。');
});

window.addEventListener('hashchange', render);
render();
