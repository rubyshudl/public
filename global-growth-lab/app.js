import { TRACKS, LESSONS, QUESTIONS, QUESTION_TYPES, FEATURED_LESSONS, SOURCES, RELEASE } from './data.js?v=textbook-1';
import { escapeHtml, sectionMarkup, sourcesMarkup, englishMarkup, solutionMarkup, tableCsv } from './reading-ui.js';
import { createProfileWriter } from './profile-writer.js';
import {
  STORAGE_KEY, defaultProfile, normalizeProfile, encryptProfile, decryptProfile,
  exportVault, parseVaultBackup, validateVault,
} from './profile-store.js?v=textbook-1';

const $ = id => document.getElementById(id);
const content = $('content');
const state = {
  route: 'home',
  routeId: '',
  search: '',
  learnTrack: 'all',
  practiceTrack: 'all',
  practiceType: 'all',
  practiceLesson: 'all',
  practiceDepth: 'all',
  practiceRole: 'all',
  revealed: new Set(),
  tempDrafts: {},
  pendingImport: null,
  authMode: 'create',
};
let profile = null;
let sessionPassword = '';
let saveState = '档案已解锁 · 草稿需点击保存';
let profileBusy = false;
let toastTimer;
const writer = createProfileWriter({
  encrypt: encryptProfile,
  write: vault => localStorage.setItem(STORAGE_KEY, JSON.stringify(vault)),
  onState: (kind, message) => {
    saveState = kind === 'saving' ? '正在加密保存…' : kind === 'saved' ? '已加密保存 · 新草稿需点击保存' : '保存失败 · 请重试或导出前检查';
    $('saveStatus').textContent = saveState;
    if (message) showToast(message);
  },
});
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
  const allowed = ['home', 'learn', 'practice', 'review', 'favorites', 'lesson', 'question', 'search', 'sources'];
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
  } catch { return { corrupt: true }; }
}

function updateProfileButton() {
  $('profileButtonText').textContent = profile ? (profile.name || '已解锁') : vaultFromStorage() ? '解锁档案' : '个人档案';
  $('profileButton').classList.toggle('unlocked', Boolean(profile));
  $('saveStatus').hidden = !profile;
  if (profile) $('saveStatus').textContent = saveState;
}

function profileCounts() {
  return {
    completed: profile?.completedLessons.length || 0,
    favorites: (profile?.favoriteLessons.length || 0) + (profile?.favoriteQuestions.length || 0) + (profile?.favoriteKnowledgePoints.length || 0),
    review: profile?.reviewQuestions.length || 0,
  };
}

function safeSaveProfile(message = '') {
  if (!profile || !sessionPassword || profileBusy) return;
  profile = normalizeProfile(profile);
  return writer.enqueue(profile, sessionPassword, message);
}

function requireProfile() {
  if (profileBusy) { showToast('档案操作进行中，请稍后重试。'); return false; }
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
    return `<article class="track-card panel ${track.color}">
      <a class="card-link-cover" href="${routeHref('learn', track.id)}" aria-label="进入${escapeHtml(track.title)}学习轨道"></a>
      <span class="track-number">${track.number}</span><h3>${escapeHtml(track.title)}</h3><span class="track-en">${escapeHtml(track.english)}</span>
      <p>${escapeHtml(track.description)}</p>
      <div class="track-progress"><progress max="${progress.total || 1}" value="${progress.completed}" aria-label="${escapeHtml(track.title)}学习进度">${progress.percent}%</progress><small><span>${progress.completed} / ${progress.total}课完成</span><span>${progress.percent}%</span></small></div>
    </article>`;
  }).join('');
}

function renderHome() {
  const counts = profileCounts();
  const nextLesson = FEATURED_LESSONS.find(lesson => !includes('completedLessons', lesson.id)) || FEATURED_LESSONS[0];
  content.innerHTML = `<section class="hero">
    <article class="hero-main panel"><p class="eyebrow">${RELEASE}</p><h1>读懂一门生意，<br><span>做出有依据的选择。</span></h1><p>出海商业化：3章完整教材、15道详解题。从商业模式到市场进入，再到12个月商业测算。每章有原理、数据、逐步演算和中英面试表达。</p><div class="hero-actions"><a class="button primary" href="${routeHref('lesson', nextLesson.id)}">${profile ? '继续学习' : '阅读第一章'} →</a><a class="button secondary" href="#practice" data-full-practice>练习15道详解题</a></div></article>
    <aside class="hero-side panel"><p class="quote">“先定义要做的<strong>决策</strong>，<br>再决定需要哪些数据。”</p><small>框架不是标准答案，而是让证据、取舍和行动可以被检查。</small></aside>
  </section>
  <div class="section-heading"><div><p class="eyebrow">READ · CALCULATE · DEFEND</p><h2>先学这三章，不必从目录猜起</h2></div><a href="#sources">查看来源与内容边界 →</a></div>
  <section class="chapter-grid">${FEATURED_LESSONS.map(lesson => `<article class="chapter-card panel"><span class="chapter-number">0${lesson.order} / 完整教材</span><h2><a href="${routeHref('lesson', lesson.id)}">${escapeHtml(lesson.title)}</a></h2><p>${escapeHtml(lesson.summary)}</p><ul>${lesson.outcomes.slice(0, 3).map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul><small>阅读约${lesson.duration}分钟 · ${lesson.sections.length}节 · 5道详解题</small><div class="hero-actions"><a class="button primary" href="${routeHref('lesson', lesson.id)}">开始阅读</a><a class="button secondary" href="#practice" data-practice-lesson="${lesson.id}">配套练习</a></div></article>`).join('')}</section>
  <p class="release-note">本批实际完成3章与15题。其余内容仍明确标注“旧版提纲／框架题”，不算完整教材。全部题目为原创模拟，不是公司真题。个人草稿请勿填入保密资料。</p>
  ${lockedCallout()}
  <section class="stats-grid" aria-label="学习概览">
    <article class="stat-card panel"><span>知识模块</span><strong>${LESSONS.length}</strong><small>三条学习轨道</small><i></i></article>
    <article class="stat-card panel"><span>已完成</span><strong>${profile ? counts.completed : '—'}</strong><small>${profile ? `共${LESSONS.length}课` : '解锁后记录'}</small><i></i></article>
    <article class="stat-card panel"><span>待复习</span><strong>${profile ? counts.review : '—'}</strong><small>错题与薄弱场景</small><i></i></article>
    <article class="stat-card panel"><span>收藏</span><strong>${profile ? counts.favorites : '—'}</strong><small>知识点与题目</small><i></i></article>
  </section>
  <div class="section-heading"><div><p class="eyebrow">REFERENCE SHELVES</p><h2>按主题浏览其他内容</h2></div><span>${LESSONS.length}课（含旧版提纲） · ${QUESTIONS.length}题（含框架题）</span></div>
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
    <div class="lesson-copy"><a href="${routeHref('lesson', lesson.id)}"><h3>${escapeHtml(lesson.title)}</h3></a><p>${escapeHtml(lesson.summary)}</p><div class="lesson-meta"><span class="chip">${escapeHtml(track.title)}</span><span class="chip">${lesson.duration}分钟</span><span class="chip ${lesson.depth === 'textbook' ? 'complete-chip' : ''}">${lesson.depth === 'textbook' ? '完整教材 · 5道详解题' : '旧版提纲 · 待深化'}</span>${favorite ? '<span class="chip">★ 已收藏</span>' : ''}</div></div>
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
    <div class="question-type"><span>${escapeHtml(QUESTION_TYPES[question.type])}</span><span>${escapeHtml(question.difficulty)} · ${question.duration}分钟</span></div><span class="chip">${question.depth === 'worked' ? '原创模拟 · 完整详解' : '原创模拟 · 旧版框架题'}</span>
    <h3>${escapeHtml(question.title)}</h3><p>${escapeHtml(question.context)}</p>
    <div class="question-footer"><span>${escapeHtml(track.title)}</span><span class="${review ? 'marked' : ''}">${review ? '● 待复习' : favorite ? '★ 已收藏' : '打开作答 →'}</span></div>
  </article>`;
}

function practicePool() {
  return QUESTIONS.filter(question =>
    (state.practiceTrack === 'all' || question.trackId === state.practiceTrack)
    && (state.practiceType === 'all' || question.type === state.practiceType)
    && (state.practiceLesson === 'all' || question.lessonId === state.practiceLesson)
    && (state.practiceDepth === 'all' || question.depth === state.practiceDepth)
    && (state.practiceRole === 'all' || question.roles?.includes(state.practiceRole)));
}

function renderPractice() {
  const questions = practicePool();
  content.innerHTML = `${pageHead('PRACTICE', '实战题库', `筛选结果${questions.length}题。全部原创模拟；15道新题提供完整数据、解答、英文表达、追问和自评。`)}${lockedCallout()}
    <div class="filter-bar"><select id="practiceTrack" aria-label="筛选题目轨道"><option value="all">全部轨道</option>${TRACKS.map(track => `<option value="${track.id}" ${track.id === state.practiceTrack ? 'selected' : ''}>${escapeHtml(track.title)}</option>`).join('')}</select><select id="practiceType" aria-label="筛选题型"><option value="all">全部题型</option>${Object.entries(QUESTION_TYPES).map(([value, label]) => `<option value="${value}" ${value === state.practiceType ? 'selected' : ''}>${label}</option>`).join('')}</select><button class="button secondary" type="button" data-random>随机抽题</button></div>
    <div class="filter-bar"><select id="practiceLesson" aria-label="筛选配套章节"><option value="all">全部章节</option>${FEATURED_LESSONS.map(item => `<option value="${item.id}" ${state.practiceLesson === item.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select><select id="practiceDepth" aria-label="筛选解答深度"><option value="all">全部深度</option><option value="worked" ${state.practiceDepth === 'worked' ? 'selected' : ''}>完整详解</option><option value="outline" ${state.practiceDepth === 'outline' ? 'selected' : ''}>旧版框架题</option></select><select id="practiceRole" aria-label="筛选岗位能力"><option value="all">全部岗位能力</option>${['商业策略', '区域GTM', '伙伴商务', '账户增长'].map(role => `<option ${state.practiceRole === role ? 'selected' : ''}>${role}</option>`).join('')}</select><button type="button" class="button secondary" data-reset-practice>清除筛选</button></div>
    ${questions.length ? `<section class="question-grid">${questions.map(questionCard).join('')}</section>` : '<p class="release-note">没有符合条件的题目，请调整筛选；随机抽题不会跳出当前范围。</p>'}`;
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
    <p class="release-note">${lesson.depth === 'textbook' ? `完整教材 · 阅读约${lesson.duration}分钟，全部练习另约${lesson.practiceDuration}分钟。数据均为独立合成教学假设。` : '旧版提纲：用于快速查阅，尚未扩为完整教材。'}</p>
    ${lesson.prerequisites?.length ? `<p>建议先学：${lesson.prerequisites.map(id => `<a href="#lesson/${id}">${escapeHtml(lessonById(id)?.title)}</a>`).join(' · ')}</p>` : ''}
    <nav class="reading-toc" aria-label="本章目录"><h2>本章目录</h2>${lesson.sections.map((section, index) => `<button type="button" data-jump-section="${escapeHtml(section.id || `part-${index}`)}">${escapeHtml(section.title)}</button>`).join('')}</nav>
    ${lesson.sections.map((section, index) => sectionMarkup({ ...section, id: section.id || `part-${index}` }, { lessonId: lesson.id, favorite: includes('favoriteKnowledgePoints', `${lesson.id}:${section.id || `part-${index}`}`), csvKey: section.table ? `lesson:${lesson.id}:${index}` : '' })).join('')}
    ${englishMarkup(lesson.english)}
    <section class="lesson-section"><h2>常用工具</h2><div class="toolkit">${lesson.toolkit.map(value => `<span class="chip">${escapeHtml(value)}</span>`).join('')}</div></section>
    <section class="exercise-box"><p class="eyebrow">PRACTICE OUTPUT</p><h3>${escapeHtml(lesson.exercise.title)}</h3><p>${escapeHtml(lesson.exercise.prompt)}</p><p><strong>交付物：</strong>${escapeHtml(lesson.exercise.deliverable)}</p></section>
    ${lesson.sourceIds ? sourcesMarkup(lesson.sourceIds) : ''}
    ${lesson.depth === 'textbook' ? `<section class="lesson-section"><h2>本章五道配套题</h2><div class="related-questions">${QUESTIONS.filter(q => q.lessonId === lesson.id).map(q => `<a href="#question/${q.id}">${escapeHtml(QUESTION_TYPES[q.type])} · ${escapeHtml(q.title)} →</a>`).join('')}</div></section>` : ''}
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
    <p class="release-note">${question.depth === 'worked' ? '原创模拟 · 完整详解 · 中英表达与追问' : '原创模拟 · 旧版框架题，未扩为完整数据题'}</p>
    ${question.lessonId ? `<p>配套教材：<a href="#lesson/${question.lessonId}">${escapeHtml(lessonById(question.lessonId)?.title)}</a></p>` : ''}
    ${question.englishPrompt ? `<p class="english-prompt" lang="en">${escapeHtml(question.englishPrompt)}</p>` : ''}
    ${(question.materials || []).map((section, index) => sectionMarkup(section, { csvKey: section.table ? `question:${question.id}:${index}` : '' })).join('')}
    ${question.deliverable ? `<p class="release-note"><strong>交付物：</strong>${escapeHtml(question.deliverable)}</p>` : ''}
    <section class="requirements"><h3>回答至少覆盖</h3><ul>${question.requirements.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></section>
    <div class="answer-area"><label for="answerDraft">先写下你的回答 <span id="answerCount">${draft.length} / 20000</span></label><textarea id="answerDraft" maxlength="20000" placeholder="先列结构，再补证据、取舍、行动和风险…">${escapeHtml(draft)}</textarea><div class="answer-actions"><button class="button primary" type="button" data-save-answer="${question.id}">保存到加密档案</button><button class="button secondary" type="button" data-reveal="${question.id}">${revealed ? '隐藏参考解答' : '完成作答后看参考解答'}</button><button class="button secondary" type="button" data-review-question="${question.id}">${review ? '✓ 已加入待复习' : '加入待复习'}</button></div></div>
    ${revealed ? `<section class="framework-box"><h2>${question.depth === 'worked' ? '完整解答与自评' : '参考思考框架'}</h2><ol>${question.framework.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ol>${solutionMarkup(question)}<div class="pitfalls"><h3>常见误区</h3><ul>${question.pitfalls.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div></section>` : ''}
    ${question.sourceIds ? sourcesMarkup(question.sourceIds) : ''}
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
  const points = profile.favoriteKnowledgePoints.map(key => {
    const [id, sectionId] = key.split(':');
    const lesson = lessonById(id);
    const section = lesson?.sections.find((part, index) => (part.id || `part-${index}`) === sectionId);
    return section ? `<article class="aside-card panel"><a href="#lesson/${id}/${sectionId}">${escapeHtml(section.title)}</a><p>${escapeHtml(lesson.title)}</p></article>` : '';
  }).filter(Boolean);
  content.innerHTML = `${pageHead('FAVORITES', '收藏夹', '只收藏会再次使用的框架，定期把收藏转成练习。')}
    <div class="section-heading"><h2>收藏的具体知识点</h2><span>${points.length}项</span></div><section class="collection-list">${points.join('') || '<p>在章节标题旁点击星标，即可收藏到具体知识点。</p>'}</section>
    <div class="section-heading"><div><p class="eyebrow">KNOWLEDGE</p><h2>收藏的知识</h2></div><span>${lessons.length}课</span></div>
    ${lessons.length ? `<section class="lesson-list">${lessons.map(lessonCard).join('')}</section>` : emptyMarkup('还没有收藏知识', '在课程页点击星标即可收藏。', 'learn', '浏览知识轨道')}
    <div class="section-heading"><div><p class="eyebrow">PRACTICE</p><h2>收藏的题目</h2></div><span>${questions.length}题</span></div>
    ${questions.length ? `<section class="question-grid">${questions.map(questionCard).join('')}</section>` : emptyMarkup('还没有收藏题目', '在题目页点击星标即可收藏。', 'practice', '浏览实战题库')}`;
}

function searchableText(item, type) {
  if (item.depth === 'textbook') return JSON.stringify(item);
  if (item.depth === 'worked') return JSON.stringify({ title: item.title, context: item.context, prompt: item.prompt, englishPrompt: item.englishPrompt, materials: item.materials, roles: item.roles, industries: item.industries });
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

function renderSources() {
  content.innerHTML = `${pageHead('SOURCES', '来源与学习方法', '本批不声称拥有公司真题；已核验完整候选人面经为0篇。来源链接支持能力映射，不代表岗位适配或当前招聘承诺。')}<article class="detail-main panel"><h2>第一批实际内容</h2><p>3章完整教材、15道完整解答题。其余为保留的旧版提纲与框架题。练习全部独立合成，不引用个人简历、真实客户项目或保密业务数据。</p><p>四类能力：商业策略、区域GTM、伙伴商务、账户增长。先按商业模式 → 市场进入 → 商业测算学习，再选择对应题型练习。每章将阅读和练习耗时分开，英文表达为辅助练习。</p>${sourcesMarkup(SOURCES.map(source => source.id))}<h2>事实与假设分开</h2><p>官方JD／流程介绍不等于实际考题；案例、阈值、评分和模型均为原创教学设计，不是行业标准。来源未给发布日期时保留未知，只记录实际核验日期。</p><p>档案仅在当前浏览器加密保存，非云账号。换设备需要加密备份；更新不清空旧ID与草稿。请勿在公开站点练习中填写保密资料。</p></article>`;
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
  else if (state.route === 'sources') renderSources();
  else renderNotFound();
  if (document.activeElement !== $('globalSearch')) content.focus({ preventScroll: true });
  const point = location.hash.split('/')[2];
  if (state.route === 'lesson' && point) document.getElementById(`section-${point}`)?.scrollIntoView();
  closeMobileNav();
}

function toggleList(list, id) {
  const values = new Set(profile[list]);
  if (values.has(id)) values.delete(id); else values.add(id);
  profile[list] = [...values];
}

function randomQuestion() {
  const eligible = practicePool();
  if (!eligible.length) return showToast('当前筛选没有题目，请调整条件。');
  const pool = eligible.filter(question => question.id !== state.routeId);
  const question = pool[Math.floor(Math.random() * pool.length)] || eligible[0];
  navigate('question', question.id);
}

function openProfileDialog(mode = '') {
  if (profileBusy) return;
  const vault = vaultFromStorage();
  state.authMode = mode || (profile ? 'manage' : vault ? 'unlock' : 'create');
  $('profileAuth').hidden = state.authMode === 'manage';
  $('profileManage').hidden = state.authMode !== 'manage';
  $('profileError').hidden = true;
  $('profilePassword').value = '';
  $('profileSubmit').disabled = false;
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
  if (vault?.corrupt && !mode) {
    $('profileCopy').textContent = '本机档案无法读取或存储不可用。不会创建新档案覆盖它；可从有效加密备份恢复。';
    $('profileSubmit').disabled = true;
  }
  if (!$('profileDialog').open) $('profileDialog').showModal();
  setTimeout(() => (state.authMode === 'create' ? $('profileName') : $('profilePassword')).focus(), 0);
}

async function submitProfile(event) {
  event.preventDefault();
  if (profileBusy) return;
  profileBusy = true;
  const password = $('profilePassword').value;
  $('profileError').hidden = true;
  $('profileSubmit').disabled = true;
  try {
    let nextProfile;
    if (state.authMode === 'create') {
      if (vaultFromStorage()) throw new Error('本机已有档案，不能覆盖创建。请解锁或导入有效备份。');
      nextProfile = defaultProfile($('profileName').value);
      const vault = await encryptProfile(nextProfile, password);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
    } else if (state.authMode === 'import') {
      nextProfile = await decryptProfile(state.pendingImport, password);
      await writer.flush();
      if (vaultFromStorage() && !confirm('验证通过。确定用该备份替换本机档案？请先确保已有数据已备份。')) return;
      writer.invalidate();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pendingImport));
      state.tempDrafts = {}; state.revealed.clear();
      state.pendingImport = null;
    } else {
      nextProfile = await decryptProfile(vaultFromStorage(), password);
    }
    profile = nextProfile;
    sessionPassword = password;
    saveState = '档案已解锁 · 草稿需点击保存';
    $('profileDialog').close();
    render();
    showToast(state.authMode === 'create' ? '个人档案已创建并加密保存。' : '个人档案已解锁。');
  } catch (error) {
    $('profileError').textContent = error.message || '操作失败。';
    $('profileError').hidden = false;
  } finally { $('profileSubmit').disabled = false; profileBusy = false; }
}

function download(contentValue, filename, type = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contentValue], { type }));
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
  if (target.matches('[data-full-practice], [data-practice-lesson], [data-reset-practice]')) {
    state.practiceTrack = 'all'; state.practiceType = 'all'; state.practiceRole = 'all';
    state.practiceDepth = target.matches('[data-reset-practice]') ? 'all' : 'worked';
    state.practiceLesson = target.dataset.practiceLesson || 'all';
    if (state.route === 'practice') renderPractice();
  }
  if (target.dataset.jumpSection) {
    const section = document.getElementById(`section-${target.dataset.jumpSection}`);
    section?.scrollIntoView(); section?.focus({ preventScroll: true });
  }
  if (target.dataset.favoritePoint) {
    if (!requireProfile()) return;
    toggleList('favoriteKnowledgePoints', target.dataset.favoritePoint); safeSaveProfile('知识点收藏已更新。');
    const active = includes('favoriteKnowledgePoints', target.dataset.favoritePoint);
    target.classList.toggle('active', active); target.textContent = active ? '★' : '☆';
    target.setAttribute('aria-label', `${active ? '取消收藏' : '收藏知识点'}：${target.closest('section').querySelector('h2').textContent}`);
  }
  if (target.dataset.csv) {
    const [kind, id, index] = target.dataset.csv.split(':');
    const table = kind === 'lesson' ? lessonById(id)?.sections[Number(index)]?.table : questionById(id)?.materials[Number(index)]?.table;
    if (table) download(tableCsv(table), `${id}-${index}.csv`, 'text/csv;charset=utf-8');
  }
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
  if (target.dataset.setPracticeTrack) {
    state.practiceTrack = target.dataset.setPracticeTrack; state.practiceLesson = 'all'; state.practiceRole = 'all'; state.practiceDepth = 'all';
    if (state.route === 'practice') renderPractice();
  }
});

content.addEventListener('input', event => {
  if (event.target.id === 'answerDraft') {
    state.tempDrafts[state.routeId] = event.target.value;
    $('answerCount').textContent = `${event.target.value.length} / 20000`;
    if (profile) { saveState = '草稿未保存 · 点击保存到加密档案'; $('saveStatus').textContent = saveState; }
  }
});

content.addEventListener('change', event => {
  if (event.target.id === 'learnTrack') { state.learnTrack = event.target.value; navigate('learn', event.target.value === 'all' ? '' : event.target.value); }
  if (event.target.id === 'practiceTrack') { state.practiceTrack = event.target.value; renderPractice(); }
  if (event.target.id === 'practiceType') { state.practiceType = event.target.value; renderPractice(); }
  if (['practiceLesson', 'practiceDepth', 'practiceRole'].includes(event.target.id)) { state[event.target.id] = event.target.value; renderPractice(); }
  if (event.target.dataset.confidence) {
    if (!requireProfile()) return;
    profile.confidence[event.target.dataset.confidence] = event.target.value;
    safeSaveProfile('掌握状态已更新。');
  }
});

function updateSearch(event) {
  if (event.isComposing) return;
  state.search = $('globalSearch').value;
  history.replaceState(null, '', state.search.trim() ? '#search' : '#home');
  render();
}
$('globalSearch').addEventListener('input', updateSearch);
$('globalSearch').addEventListener('compositionend', updateSearch);
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

$('exportProfile').addEventListener('click', async () => {
  if (profileBusy) return;
  profileBusy = true;
  try {
    await writer.flush();
    const vault = vaultFromStorage();
    if (!vault || vault.corrupt) throw new Error('没有可导出的有效档案。');
    download(exportVault(vault), `global-growth-lab-backup-${new Date().toISOString().slice(0, 10)}.json`);
    showToast('已导出已保存的数据；未点击保存的草稿不包含在内。');
  } catch (error) { showToast(error.message); }
  finally { profileBusy = false; }
});
$('importProfile').addEventListener('click', () => $('importInput').click());
$('importProfileAuth').addEventListener('click', () => $('importInput').click());
$('importInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (profileBusy) return;
  if (file.size > 5 * 1024 * 1024) return showToast('备份超过5MB，未读取或替换。');
  try { state.pendingImport = parseVaultBackup(await file.text()); $('profileDialog').close(); openProfileDialog('import'); }
  catch (error) { showToast(error.message || '无法读取备份。'); }
});
$('lockProfile').addEventListener('click', async () => {
  if (profileBusy) return;
  const unsaved = Object.entries(state.tempDrafts).some(([id, text]) => text !== (profile?.drafts[id] ?? profile?.attempts[id]?.answer ?? ''));
  if (unsaved && !confirm('有未点击保存的草稿。锁定会清除它们，是否继续？')) return;
  profileBusy = true;
  try {
    await writer.flush(); writer.invalidate();
    profile = null; sessionPassword = ''; state.tempDrafts = {}; state.revealed.clear();
    $('profileDialog').close(); render(); showToast('个人档案已锁定。');
  } catch (error) { showToast(`未锁定：${error.message}。请重试保存。`); }
  finally { profileBusy = false; }
});
$('deleteProfile').addEventListener('click', () => {
  if (profileBusy) return;
  if (!confirm('确定删除当前浏览器中的加密档案吗？此操作无法撤销，建议先导出备份。')) return;
  try { writer.invalidate(); localStorage.removeItem(STORAGE_KEY); }
  catch (error) { return showToast(`删除失败：${error.message}`); }
  profile = null; sessionPassword = ''; state.tempDrafts = {}; state.revealed.clear();
  $('profileDialog').close(); render(); showToast('本机加密档案已删除。');
});

window.addEventListener('hashchange', render);
render();
