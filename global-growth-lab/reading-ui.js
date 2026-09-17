import { SOURCES } from './content/shared.js';

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function tableMarkup(table, downloadKey = '') {
  if (!table) return '';
  return `<div class="data-table-wrap" tabindex="0" role="region" aria-label="${escapeHtml(table.caption)}"><table><caption>${escapeHtml(table.caption)}</caption><thead><tr>${table.headers.map(x => `<th scope="col">${escapeHtml(x)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map(x => `<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${downloadKey ? `<button class="button secondary csv-button" type="button" data-csv="${escapeHtml(downloadKey)}">下载本表 CSV</button>` : ''}`;
}

export function sectionMarkup(section, { lessonId = '', favorite = false, csvKey = '' } = {}) {
  return `<section class="lesson-section" id="section-${escapeHtml(section.id || '')}" tabindex="-1">
    <div class="section-title"><h2>${escapeHtml(section.title)}</h2>${lessonId && section.id ? `<button class="action-icon ${favorite ? 'active' : ''}" type="button" data-favorite-point="${escapeHtml(`${lessonId}:${section.id}`)}" aria-label="${favorite ? '取消收藏' : '收藏知识点'}：${escapeHtml(section.title)}">${favorite ? '★' : '☆'}</button>` : ''}</div>
    ${(section.paragraphs || []).map(x => `<p>${escapeHtml(x)}</p>`).join('')}
    ${(section.formulas || []).map(x => `<p class="formula">${escapeHtml(x)}</p>`).join('')}
    ${tableMarkup(section.table, csvKey)}
    ${section.steps?.length ? `<div class="worked-steps"><h3>逐步演算与解释</h3><ol>${section.steps.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol></div>` : ''}
    ${section.bullets?.length ? `<ul>${section.bullets.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

export function sourcesMarkup(ids = []) {
  return `<section class="source-box"><h2>来源与证据边界</h2><p>来源支持岗位能力或业务背景；解释、数据与题目由本站原创编写。不是公司真题，也不是业绩或投资预测。</p>${ids.map(id => SOURCES.find(item => item.id === id)).filter(Boolean).map(source => `<article><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)} ↗</a><small>${escapeHtml(source.kind)} · 核验 ${source.checkedAt} · 发布日期未标注</small><p>${escapeHtml(source.supports)}</p></article>`).join('')}</section>`;
}

export function englishMarkup(value) {
  if (!value) return '';
  return `<details class="english-box"><summary>英文表达练习 · English interview answer</summary><p lang="en"><strong>${escapeHtml(value.prompt)}</strong></p><p lang="en">${escapeHtml(value.answer)}</p><ul>${(value.notes || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></details>`;
}

export function solutionMarkup(question) {
  return `${(question.solution || []).map(section => sectionMarkup(section)).join('')}
    ${question.englishAnswer ? `<details class="english-box"><summary>英文简答示例</summary><p lang="en">${escapeHtml(question.englishAnswer)}</p></details>` : ''}
    ${question.followUps?.length ? `<h3>面试追问：先口头回答，再展开</h3>${question.followUps.map(item => `<details class="follow-up"><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}` : ''}
    ${question.rubric?.length ? `<h3>自评量表 · 不自动判分</h3><p>每维0—4分：0无有效内容，1明显错误，2基本正确但遗漏关键点，3达到完整标准，4还能够检验假设并处理反事实。以下为本题锚点；可有不同但证据充分的结论。</p>${tableMarkup({ caption: '按证据质量评分，不按结论是否相同评分', headers: ['维度', '3—4分', '2分', '0—1分'], rows: question.rubric.map(item => [item.dimension, item.excellent, item.partial, item.weak]) })}` : ''}`;
}

export function tableCsv(table) {
  // Protect spreadsheets from interpreting exported text as a formula.
  const cell = value => {
    let text = String(value);
    if (typeof value === 'string' && /^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [table.headers, ...table.rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}