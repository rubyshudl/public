import { commonLesson, s, table, question, rubric } from './shared.js';

export const marketData = [
  { market: 'A', eligible: 6000, reachable: 100, conversion: 0.1, annualPrice: 2400, entryCost: 18000, scores: [5, 2, 2, 2] },
  { market: 'B', eligible: 2400, reachable: 160, conversion: 0.15, annualPrice: 2400, entryCost: 10000, scores: [3, 4, 4, 4] },
  { market: 'C', eligible: 1200, reachable: 80, conversion: 0.2, annualPrice: 3000, entryCost: 16000, scores: [2, 3, 2, 3] },
];
export const marketWeights = [0.35, 0.3, 0.2, 0.15];
const marketTable = table('独立虚构市场：90天获客与容量假设（非真实国家统计）', ['市场', '符合服务条件酒店', '90天可触达酒店', '触达→付费假设', '年合同额／酒店（元）', '进入固定投入（元）'], marketData.map(x => [x.market, x.eligible, x.reachable, x.conversion, x.annualPrice, x.entryCost]));
export const lesson = {
  ...commonLesson, id: 'market-entry-decision', order: 2, duration: 80, practiceDuration: 110,
  title: '市场进入：从大市场报告到可执行的投资选择',
  summary: '用三个合成市场演练：先过硬门槛，再比较需求与进入能力，做自下而上估算、评分敏感性和90天验证。',
  sourceIds: ['amazon-marketing', 'airwallex-partnerships'], prerequisites: ['business-model'],
  keywords: ['市场进入', 'TAM', 'SAM', 'SOM', 'ICP', '战略协同', '证据等级', 'market entry', 'right to win', 'sensitivity'],
  outcomes: ['把国家研究转成有预算和时间边界的决策', '用触达、转化和实施容量约束市场估计', '识别评分的主观性及硬门槛，给出条件化建议', '写出试点里程碑、停止条件和管理层备忘录'],
  toolkit: ['决策陈述', 'TAM/SAM/SOM', '硬门槛', '证据矩阵', '加权评分', '敏感性', '阶段资源闸门'],
  sections: [
    s('decision-scope', '01 / 先问“要选择什么”，不要先做国家百科', [
      '市场研究可以无限扩展：人口、GDP、文化、竞争、渠道都有资料。但商业岗位最终需要决定资源下一步放哪里。先写决策句：“未来90天，最多投入20,000元固定进入预算，在三个虚构市场中选择一个测试酒店软件的付费需求；团队最多实施20家酒店。”预算、期间、产品、客群和可选动作缺一项，报告都可能无法落地。',
      '进入不是只有“做／不做”。可选动作包括全面进入、窄客群试点、借伙伴验证、仅远程销售、继续补证据、暂缓。不同动作需要不同资源与证据。对尚未验证需求的业务，批准一次试验不等于批准全国扩张，也不等于承诺其多年收入目标。',
      '把证据和判断分列：访谈说痛点强是观察，付费率15%是模型假设，选择市场B是基于预算和能力的判断。这样面试官追问某项输入时，你能修改模型而不是维护一个脆弱结论。',
    ]),
    s('customer-first', '02 / 先收窄ICP，市场规模才有意义', [
      'ICP是最适合服务的一类企业，不是“所有海外酒店”。在本例，产品服务独立酒店，能兼容指定系统，采购流程较短，经营负责人有预算；大型集团长期招标和无法集成的系统暂不纳入。酒店数量要扣除不能服务、不能触达或没有适用场景的部分。',
      '需求发现要区分使用者、收益者和预算决策者。前台想减少手工录入，店长关注运营效率，业主关注回报，技术方关注数据和故障风险。一个人喜欢产品不代表购买委员会通过。访谈应追问过去怎样解决、问题发生频次、已有成本、预算周期，而不是只问“你愿意用吗”。',
      '排除条件会让机会看起来变小，却通常提升验证速度。例如没有数据接入能力、只是想免费试用、关键决策人半年内无法参与，都可以暂时排除。但排除规则要基于产品与销售约束，不能用国籍或其他受保护特征推断个人行为。',
    ]),
    s('bottom-up', '03 / TAM、SAM、SOM：规模是边界，不是销售预测', [
      'TAM通常表示某产品定义下的总体可寻址需求，SAM是当前产品和服务能力可以覆盖的部分，SOM还受获取能力、竞争和时间约束。它们不是统一会计科目，使用前应写明你的定义。本例只有符合条件的酒店数，因此能计算一个“可服务年合同额上界”，不能把它叫整个酒店科技市场TAM。',
      '市场A有6,000家符合条件酒店，按每年2,400元，上界14,400,000元；B为5,760,000元；C为3,600,000元。这些是全部符合条件客户都购买时的年化边界，既不是90天收入，也不代表定价和需求已验证。',
      '更接近行动的是自下而上模型：可触达酒店 × 触达至付费转化率，再受销售和实施容量限制。假定90天新增付费A=100 × 10%=10家，B=160 × 15%=24家，C=80 × 20%=16家；团队最多实施20家，所以可上线付费B封顶20。签约、上线与收入确认仍需按题目定义分开。',
    ], { table: marketTable, formulas: ['90天可上线付费数 = min（可触达酒店 × 假设转化率，实施容量20家）', '新增年合同额 = 可上线付费数 × 每酒店年合同额'], steps: ['A：10家 × 2,400 = 24,000元新增年合同额；B：20家 × 2,400 = 48,000元；C：16家 × 3,000 = 48,000元。', '这里比较年合同额，不是90天确认收入或净利润。客户上线日期、收款条款、服务和获取成本需另建模型。', 'B与C年合同额相同，但进入成本、证据、集成及容量风险不同；不能用一个销售数字替代决策。'] }),
    s('gates', '04 / 硬门槛先于评分：分数不能抵消不能交付', [
      '硬门槛是不能靠其他优势补偿的条件：法律允许、必要许可和数据处理可行、关键产品能交付、所需投入不超过预算。商业人员负责识别问题、明确责任和升级，不自行替代法律意见。未知不等于通过；存在硬门槛待核时，可以批准调查而不是批准正式交易。',
      '评分则适合比较可权衡因素，如需求吸引力、触达能力、实施准备度和验证成本。本例假设A、B当前无未决硬阻断，C的关键接口许可尚未确认，因此C只保留为条件候选。不能把C需求得分高当成许可已完成。',
      '战略协同要问资源由谁控制、何时能用、有什么额外成本、是否与其他业务争抢。相同集团或同一行业并不自动产生渠道。只有已确认的资源放基准情景；待承诺的品牌曝光或潜在线索放上行情景。',
    ]),
    s('scoring', '05 / 完整评分与敏感性：精确小数不等于客观真理', [
      '用1—5分比较，5分始终表示更有利；验证成本得分高表示更便宜、更快，不是支出更大。权重为需求35%、触达30%、实施20%、验证成本15%。这些分值是为教学设定的判断，不是真实市场评级。实际工作应给每个分值附证据和置信程度，避免多个维度重复奖励同一个优势。',
      'A得分5 × 0.35 + 2 × 0.30 + 2 × 0.20 + 2 × 0.15 = 3.05；B为3.65；C为2.45。B在预算和目前能力下更适合先试。推荐不是因为它“最好”，而是它更适合当前这一次验证。C即使提高分数，也须先解决接口硬门槛。',
      '如果公司改成长期规模优先，把需求权重提高到70%、触达15%、实施10%、成本5%，A变4.10、B变3.30。排序反转说明结论对目标偏好敏感。正确做法是让决策者确认目标，而不是偷偷调权重，让早已想选的市场赢。',
    ], { table: table('评分输入：全部为1—5分，越高越有利', ['市场', '需求35%', '触达30%', '实施20%', '验证成本15%', '加权分'], [['A', 5, 2, 2, 2, 3.05], ['B', 3, 4, 4, 4, 3.65], ['C（接口待核）', 2, 3, 2, 3, 2.45]]) }),
    s('evidence', '06 / 从兴趣到付费：需要哪种证据才能增加投入？', [
      '证据不是一条永远固定的排行榜，而是看它能回答什么问题。行业报告有助了解规模，不能证明客户愿付某个价格；访谈解释痛点机制，样本可能偏差；付费试点验证某些客户愿承担成本，但未必证明长期留存；签约而未上线还不能证明交付可复制。',
      '本例B有8次独立酒店访谈，其中3家愿进一步讨论，尚无付费试点。这支持继续发现，不足以说15%转化已被验证。C有2家付费试点，但来自同一个伙伴，仍要评估渠道依赖和代表性。对不同证据分别标观察日期、招募方式、样本局限和下一步。',
      '设计反证问题：“什么情况说明我们的进入假设是错的？”例如目标客户无法提供必需数据、价值节省远小于价格、决策周期长于现金承受能力。一个能够导致停止的测试，比只收集支持性案例更有信息价值。',
    ]),
    s('pilot', '07 / 90天计划不是活动排期，而是分阶段买证据', [
      '前30天解决购买与交付前提：访谈决策人、确认替代方案、核对接口和合规，明确试点验收。31—60天验证少量付费客户从接入到价值实现的路径。61—90天再检验转化、交付负荷与单位贡献，决定继续、改造或停止。',
      '示例门槛是团队事前协商的试验规则，不是行业标准：最多用4,000元做发现与技术预检；只有拿到至少3家书面付费试点约定且关键接口通过，才释放第二段6,000元。若前30天关键合规前提仍不可行，则暂停收款与上线，转为补证据或换市场。',
      '先期试点不要求马上证明规模盈利，但要明确学什么。付费试点数、上线时间、关键任务采用、服务工时和有效贡献比“开了多少次会”更接近业务证据。客户体验、退款和数据安全是护栏，不能用较好转化率抵消失控风险。',
    ]),
    s('memo', '08 / 管理层备忘录：允许一个有条件的结论', [
      '示范结论：“建议先对B进行受预算约束的付费试点，而不是全面进入。B在当前触达与交付准备度上领先，基准估计90天可上线20家、新增年合同额48,000元；这些都是未验证假设，不是收入承诺。”',
      '随后列替代方案：“A潜在可服务规模更大，但短期获客弱、进入成本高；若决策目标改为长期规模或能获得可靠本地渠道，应重新比较。C需先解决接口许可，并验证伙伴之外的客户需求。”最后提出具体批准项、预算释放条件、负责人和下一次复盘。',
      '面试时被追问“到底进不进”，不要用“需要更多数据”躲避。可以明确推荐试点，同时说明为什么现在不能承诺全面进入。好的判断既承担选择，也明确证据边界。',
    ]),
  ],
  english: { prompt: 'Which market would you enter first, and why?', answer: 'I would recommend a bounded pilot in Market B, not a full launch. The objective is to validate paid demand within ninety days and a limited entry budget. B has the strongest current combination of customer access and implementation readiness. Our bottom-up estimate reaches twenty live customers after applying the delivery capacity cap. That represents 48,000 in annual contract value, not ninety-day recognized revenue. Market A offers greater long-term potential, but access is weaker today. Market C has an unresolved integration prerequisite. Before releasing the second budget tranche, I would require written paid-pilot commitments and technical validation. I would revisit the choice if the strategic objective changes or the acquisition assumptions fail. The recommendation is conditional on evidence, rather than a claim that B is universally the best market.', notes: ['区分pilot与full launch。', '说明数字的时间和口径，避免把ACV当季度收入。', '最后给出改变判断的条件。'] },
  exercise: { title: '写一份可被质疑的进入建议', prompt: '使用本章三个虚构市场，选择一个90天动作，写明输入、前提、替代方案与预算释放条件。', deliverable: '一页决策备忘录＋市场计算表＋90秒英文陈述。' },
};
const makeRubric = () => rubric('明确时间、容量、输入假设和硬门槛，不把年合同额当季度收入。', '给条件化推荐，至少比较一个替代并说明何时改变。', '提出有客户证据、责任与投入限制的下一步。');
export const questions = [
  question(lesson, { id: 'q-entry-size', type: 'interview', title: '最大市场为什么可能不是最佳首站？', context: '沿用本章：A有6,000家符合条件酒店，B为2,400家；资源只够一个90天试点。', prompt: '说明如何在长期规模与短期验证效率之间选择，避免空泛评分。', englishPrompt: 'Why might the largest market be a poor first market?', requirements: ['说明本次目标', '区分规模和进入能力', '给出可以逆转选择的条件'], framework: ['定义时间', '过硬门槛', '估触达和转化', '加交付约束', '推荐并定义反证'], pitfalls: ['只比TAM', '把短期首站当最终布局', '评分不配证据'], deliverable: '2分钟回答', solution: [s('answer', '先站在当前决策上回答', ['如果目标是90天验证购买与交付，A的酒店总数只提供上界；还要看能触达谁、通过什么渠道、购买周期和实施成本。A按题设只预计10家付费，B虽规模较小却可达24家、受容量限制上线20家。此时B可能提供更快学习。', '这不是否定A长期价值。若目标改为长期份额，或A获得明确可执行的渠道资源，机会成本会变化，应该重新比较。不应先选B再调整所有权重为B服务。', '我会先过合规和产品硬门槛，再提出B的小额试点，验证触达到付费假设。若首月没有决策人愿意付费或购买周期明显超过容忍窗口，推荐会改变。把“规模重要但不充分”转成数据和动作，比背一套PEST框架更能体现商业判断。'])], followUps: [{ question: '老板说小市场没有想象空间？', answer: '把首站学习与终局规模分开：说明B验证的机制能否迁移，以及何时回到A。若B的产品需求完全不可迁移，它的学习价值也应降低。' }, { question: '市场小是否意味着CAC低？', answer: '不意味着。CAC受渠道竞争、触达效率、销售周期和客群价值影响，规模小甚至可能更难经济触达，需单独建获取成本模型。' }], rubric: makeRubric(), englishAnswer: 'The largest addressable market is not necessarily the fastest place to validate our model. I would compare accessible demand and delivery capacity within the decision horizon, while keeping the long-term expansion option explicit.' }),
  question(lesson, { id: 'q-entry-evidence', type: 'interview', title: '访谈很积极，但没有人付款：下一步是什么？', context: '虚构产品访谈了8家符合ICP的酒店，3家愿意继续讨论；销售将其写为“需求已验证”。没有试点合同。', prompt: '判断现有证据支持什么结论，设计下一步验证。', englishPrompt: 'What can positive interviews prove, and what remains unvalidated?', requirements: ['不否认访谈价值', '区分痛点与支付意愿', '设计合规的付费试点'], framework: ['审样本', '还原历史行为', '查预算与决策人', '提真实试点条件', '记录拒绝原因'], pitfalls: ['意愿等于PMF', '只问喜欢不喜欢', '用假承诺或不可交付方案试探客户'], deliverable: '证据清单＋三个客户发现问题', solution: [s('answer', '把积极态度转成有成本的承诺', ['目前支持的结论是样本中出现了值得继续研究的痛点，不是转化率已验证。需要了解8家如何招募、是否都来自同一渠道、3家中谁有预算与否决权。继续讨论不等于接受价格或具备实施条件。', '下一次应问过去三个月如何解决、付出了多少人工与时间、最近一次预算怎么审批，再提出确实可交付的付费试点范围、价格、验收与退出条件。观察是否愿意安排决策人、提供必要资源并签订约定，而不是再收一轮满意反馈。', '如果拒付集中在无法证明价值，改价值验证；如果业务负责人认可但预算周期不匹配，调整销售预期；如果交付依赖无法满足，先解决产品问题。不能为提高转化而免费到没有约束，再把使用算成支付意愿。'])], followUps: [{ question: '免费POC有没有价值？', answer: '有，能验证技术或使用路径，但只能支持相应假设。应事先写明转付费标准、决策时间和资源投入，不能把免费使用当商业化成立。' }, { question: '三家付费了就能扩大吗？', answer: '只能更强地支持特定客群愿付费。仍需看采用、交付成本、留存、客户来源和可复制性；三个便利样本不证明整个市场。' }], rubric: makeRubric(), englishAnswer: 'Positive interviews validate a problem hypothesis, not paid demand. I would test a deliverable paid pilot with the budget owner, explicit acceptance criteria and a decision date, then analyze why customers accept or decline.' }),
  question(lesson, { id: 'q-entry-budget', type: 'interview', title: '预算从2万元砍到8千元，你怎么改建议？', context: 'B的原方案需要10,000元进入投入；前期发现与技术预检可独立执行，成本4,000元。完整试点后续还需要6,000元，不能挪用客户资金。', prompt: '提出可执行的动作，不要只按比例压缩全部任务。', englishPrompt: 'How would a budget cut change your market-entry decision?', requirements: ['识别原方案不可执行', '区分最小学习与正式上线', '明确剩余资金与后续批准'], framework: ['重设决策范围', '核验不可分投入', '选最高信息价值活动', '定义批准条件', '停止不必要承诺'], pitfalls: ['每项都减60%', '先签客户再找预算', '暗中假设伙伴免费补齐'], deliverable: '90秒调整建议', solution: [s('answer', '改变动作，而非只改变数字', ['8,000不足以完成原10,000方案，因此原建议失效。可先批准4,000的发现与技术预检，保留其余4,000，而不是承诺完整上线。这样仍能回答购买意愿、决策链和接口可行性，但不能声称进入计划已获得充分资金。', '预检完成后，若价值和付费承诺足够强，再请求额外2,000或重新设计一个确实可交付的范围；若有新的窄范围方案，需重新报价和核算，不假定成本线性下降。没有后续资金时，透明地向潜在客户说明研究阶段，避免销售超出交付能力。', '如果4,000预检也无法改变决定，比如关键法律约束已经确定不可行，就没有必要为了花预算而做访谈。优先购买能改变选择的证据，并为不投入保留合法选项。'])], followUps: [{ question: '要保进度，能否先免费给客户用？', answer: '免费仍可能有实施、服务和法律责任，不能消除资金约束。只有明确可承担的范围、责任和终止机制后才考虑，而且不能把免费试用当付费验证。' }, { question: '伙伴承诺补2,000？', answer: '核实谁审批、支付条件、对价和到账时点；未形成可执行承诺前不放进基准预算。' }], rubric: makeRubric(), englishAnswer: 'I would change the scope, not simply cut every activity. We can fund discovery and technical checks, but should not promise a full pilot until the remaining delivery budget is approved.' }),
  question(lesson, { id: 'q-entry-written', type: 'written', duration: 45, title: '数据笔试：三个市场，只能选一个试点', context: '独立合成案例；90天最多实施20家，进入固定预算20,000元。A、B没有已知硬阻断；C的关键接口许可未确认。', prompt: '计算各市场可上线客户和新增年合同额；解释为何不能由此得出净利润；给出建议和两项优先验证。', englishPrompt: 'Build a bottom-up market comparison and recommend a bounded pilot.', requirements: ['应用实施容量', '区分合同额和收入利润', '先处理硬门槛'], framework: ['算可服务边界', '算付费意向数', '限制上线容量', '比较进入约束', '给试点条件'], pitfalls: ['B按24家交付', '拿年合同额减一次投入叫季度利润', 'C接口未知当通过'], deliverable: '计算表＋一页决策memo', materials: [s('dataset', '计算输入', ['价格是年合同额，不提供实际收款或收入确认时点；转化率均为待验证假设。'], { table: marketTable })], solution: [s('math', '逐项计算', ['A：100 × 10% = 10家，低于20家容量，年合同额24,000；B：160 × 15% = 24家，但本期最多上线20家，年合同额48,000；C：80 × 20% = 16家，年合同额48,000。C数字只是许可通过条件下的情景，当前不能算可兑现承诺。', '不能将24,000 − 18,000等值直接叫90天利润：合同覆盖一年，客户上线时间不同；数据缺月度收入确认、服务成本、获客费用、退款和收款周期。可以比较进入支出压力，却不能完成损益或现金判断。']), s('recommendation', '示范建议及替代路径', ['推荐B的受控试点：当前投入10,000且有较强触达，先用前期预检验证接口与付费决策，再释放执行预算。最先核对15%转化的证据与20家实施容量是否真实，避免销售成功后交付失败。', 'A可作为长期规模选项，当新渠道使可触达客户数增加时重算；C先解决许可和伙伴集中风险。若B的付费转化很弱，不应因为评分最高就继续投入，可延长发现或暂缓。'])], followUps: [{ question: 'B多出的4家能记入收入吗？', answer: '取决于是否已签约、履约和实际收入规则。题目没有这些证据；容量外潜在商机可单列积压或上行情景，不能计入已上线确认收入。' }, { question: '如果C许可通过就改选C？', answer: '需要进一步比较价格依据、需求代表性、获取和服务成本。相同年合同额不等于相同经济性，不能只去掉一个阻断就自动替换。' }], rubric: makeRubric(), englishAnswer: 'B can support twenty live customers and 48,000 in annual contract value under the assumptions. I would pilot B, validate conversion and capacity, and avoid treating annual contract value as quarterly profit.' }),
  question(lesson, { id: 'q-entry-scenario', type: 'scenario', duration: 30, title: '模拟管理层质询：调一下权重就能让A赢？', context: 'A评分为[5,2,2,2]，B为[3,4,4,4]，维度依次需求、触达、实施、验证成本。原权重[35%,30%,20%,15%]；管理层提议[70%,15%,10%,5%]。', prompt: '计算变化并解释应如何向管理层沟通，避免把模型当作背书工具。', englishPrompt: 'What does a ranking reversal tell you about the decision?', requirements: ['计算两套结果', '解释目标偏好改变', '提出独立于权重的约束'], framework: ['确认权重和方向', '重算', '区分事实和偏好', '审硬门槛', '更新建议及验证'], pitfalls: ['偷偷改权重', '小数精确就客观', '权重覆盖预算和合法性'], deliverable: '评分计算＋管理层回应', solution: [s('answer', '排序反转揭示的是目标变化', ['原权重A=3.05、B=3.65；新权重A=4.10、B=3.30。分值没有改变，改变的是我们对长期需求规模相对于当前进入能力的偏好。因此不能说新模型证明A更优，只能说在新的价值取舍下A得分更高。', '我会问管理层：本次批准的是90天验证，还是长期规模布局？如果是后者，需要同步接受更长的获取周期、资源投入和风险，而不是只改评分却保留短期收入承诺。评分中的主观输入也应以证据区间呈现。', '无论哪个市场得分高，都先满足许可、产品交付、资金约束。可以同时展示两套情景，建议在A做低成本渠道预检、B保留试点备选；最终由明确的决策目标选择，而不是为了迎合偏好隐藏敏感性。'])], followUps: [{ question: '如何防止维度重复计分？', answer: '检查指标因果关系，例如渠道资源同时被记入触达、低CAC和战略协同，可能重复奖励。可合并维度或调整口径，公开原因而非悄悄修改。' }, { question: '权重应该来自统计模型吗？', answer: '不一定。这里权重表达决策偏好，应由目标和约束确定；统计模型可能估计结果，但不能自动决定公司更重视增长、风险还是回收。' }], rubric: rubric('准确给出3.05/3.65和4.10/3.30。', '识别偏好变化而非新事实，保留硬门槛。', '给管理层可决策的选项与承担的代价。'), englishAnswer: 'The reversal reflects a change in priorities, not new market evidence. I would confirm whether we are optimizing a short pilot or long-term scale, and keep budget and delivery gates outside the compensatory score.' }),
];