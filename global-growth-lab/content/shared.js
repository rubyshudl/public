export const RELEASE = '2026-09-17 · 教材第一批';
export const SOURCES = [
  { id: 'amazon-vendor', title: 'Amazon · Vendor Manager Interview Prep', kind: '官方岗位与面试指南', url: 'https://www.amazon.jobs/content/en/how-we-hire/vendor-manager-interview-prep', supports: '供应商组合、定价、库存、利润、数据决策与行为面试；并非实际考题。' },
  { id: 'amazon-marketing', title: 'Amazon · Marketing Manager Interview Prep', kind: '官方岗位与面试指南', url: 'https://www.amazon.jobs/content/en/how-we-hire/marketing-manager-interview-prep', supports: '模糊问题、策略、跨团队影响、可衡量计划及写作测评；未公开具体试卷。' },
  { id: 'shopify-commercial', title: 'Shopify · Commercial careers', kind: '官方团队与面试介绍', url: 'https://www.shopify.com/careers/disciplines/commercial', supports: '长期商家组合、技术与市场理解、职业经历叙述；不代表全部岗位以存量经营为主。' },
  { id: 'airwallex-partnerships', title: 'Airwallex · Strategic Partnerships, EMEA', kind: '官方JD · 进阶能力参照', url: 'https://careers.airwallex.com/job/76737659-4f27-450f-8f7b-f690723faad5/senior-manager-strategic-partnerships-emea/', supports: '战略协同、合作用例、集成、协议、ROI与风险。伦敦／阿姆斯特丹，要求至少5年相关经验，不是初级岗位推荐。' },
  { id: 'adyen-account', title: 'Adyen · Account Manager, Paris', kind: '官方JD · 能力参照', url: 'https://careers.adyen.com/vacancies/7586281-account-manager?locale=en', supports: '账户组合、流失防控、商业增长和跨团队项目。巴黎，法英双语、3—4年相关经验；可访问不等于招聘方确认HC。' },
  { id: 'amadeus-investors', title: 'Amadeus · Investor Relations', kind: '公司一手业务资料', url: 'https://amadeus.com/en/investors', supports: '旅行科技价值链与业务背景；不为本站虚构财务模型提供预测背书。' },
].map(source => ({ ...source, checkedAt: '2026-09-17', publishedAt: null }));

export const s = (id, title, paragraphs, extra = {}) => ({ id, title, paragraphs, bullets: [], ...extra });
export const table = (caption, headers, rows) => ({ caption, headers, rows });
export const commonLesson = {
  trackId: 'globalization', depth: 'textbook', level: '核心',
  roles: ['商业策略', '区域GTM', '伙伴商务', '账户增长'], industries: ['旅行科技', '企业软件'],
};
export function question(lesson, value) {
  return {
    trackId: lesson.trackId, lessonId: lesson.id, depth: 'worked', sourceKind: 'mock',
    sourceIds: lesson.sourceIds, roles: lesson.roles, industries: lesson.industries,
    difficulty: '核心', duration: 15, materials: [], ...value,
  };
}
export function rubric(evidence, decision, action) {
  return [
    { dimension: '口径与证据', excellent: evidence, partial: '方向正确，但漏掉一项关键口径或未区分假设与事实。', weak: '没有界定对象与时间，直接套公式或把假设当事实。' },
    { dimension: '取舍与判断', excellent: decision, partial: '给出建议但未比较替代方案，或缺少改变建议的条件。', weak: '只列框架，或仅凭规模、收入、单个比率下结论。' },
    { dimension: '行动与表达', excellent: action, partial: '有行动但缺负责人、时间、验证信号中的一项。', weak: '只有“继续沟通／优化”，没有下一步和风险边界。' },
  ];
}