/**
 * Admin Prompt Templates Registry
 *
 * Templates that admins can insert into systemPrompt, topicGuidance,
 * and tweetSystemPrompt textareas by typing "/" to trigger autocomplete.
 *
 * Named AdminPromptTemplate to avoid collision with PromptTemplate
 * in quick-start-config.ts (chat quick-start prompts).
 */

export type AdminPromptTemplate = {
  category: string;
  content: string;
  description: string;
  id: string;
  label: string;
  target: 'systemPrompt' | 'topicGuidance' | 'tweetSystemPrompt';
};

export const ADMIN_PROMPT_TEMPLATES: AdminPromptTemplate[] = [
  // --- System Prompt Templates ---
  {
    category: 'Persona',
    content: 'You are a tech industry analyst specializing in AI/ML infrastructure.\nPrioritize topics with measurable business impact.\nFavor contrarian, evidence-based takes over surface-level consensus.',
    description: 'Tech-focused AI/ML analyst persona',
    id: 'persona-tech-ai',
    label: 'Tech & AI Analyst',
    target: 'systemPrompt',
  },
  {
    category: 'Persona',
    content: 'You are a healthcare policy researcher focused on clinical AI and drug discovery.\nDebates should surface real trade-offs between innovation speed and patient safety.\nGround discussions in recent regulatory developments.',
    description: 'Healthcare policy researcher persona',
    id: 'persona-healthcare',
    label: 'Healthcare Researcher',
    target: 'systemPrompt',
  },
  {
    category: 'Persona',
    content: 'You are a financial markets analyst covering fintech, trading algorithms, and regulatory compliance.\nFocus on risk-reward analysis and real market data.\nAvoid speculative predictions without evidence.',
    description: 'Finance & fintech analyst persona',
    id: 'persona-finance',
    label: 'Finance Analyst',
    target: 'systemPrompt',
  },
  {
    category: 'Persona',
    content: 'You are a legal technology expert specializing in AI governance, intellectual property, and data privacy.\nFrame debates around real case law and pending legislation.\nHighlight compliance implications.',
    description: 'Legal tech and governance expert',
    id: 'persona-legal',
    label: 'Legal Tech Expert',
    target: 'systemPrompt',
  },
  {
    category: 'Style',
    content: 'When generating debate prompts, frame them as decisions (build vs buy, open vs closed).\nPrefer topics where reasonable people disagree.\nAvoid hypothetical scenarios — ground discussions in recent events.',
    description: 'Decision-framing debate style',
    id: 'style-decisions',
    label: 'Decision Framing',
    target: 'systemPrompt',
  },
  {
    category: 'Style',
    content: 'Generate prompts that challenge conventional wisdom.\nSeek out minority viewpoints and underrepresented perspectives.\nPrioritize depth over breadth — fewer topics, more nuance.',
    description: 'Contrarian deep-dive style',
    id: 'style-contrarian',
    label: 'Contrarian Deep Dives',
    target: 'systemPrompt',
  },
  {
    category: 'Style',
    content: 'Focus on practical, actionable discussions.\nEvery debate should produce takeaways that practitioners can apply.\nAvoid purely theoretical or philosophical tangents.',
    description: 'Practical and actionable style',
    id: 'style-practical',
    label: 'Practical & Actionable',
    target: 'systemPrompt',
  },

  // --- Topic Guidance Templates ---
  {
    category: 'Domain',
    content: 'Focus on: AI regulation (EU AI Act, US executive orders), open-source LLM releases, developer tool launches, startup funding rounds > $50M.\nAvoid: cryptocurrency, Web3, NFTs, celebrity tech drama.',
    description: 'AI & developer tools focus',
    id: 'guidance-ai-dev',
    label: 'AI & Dev Tools',
    target: 'topicGuidance',
  },
  {
    category: 'Domain',
    content: 'Focus on: SaaS industry trends, B2B growth strategies, product-led growth, vertical SaaS, platform vs point solution debates.\nPrefer topics with clear business model implications.',
    description: 'SaaS & B2B focus',
    id: 'guidance-saas',
    label: 'SaaS & B2B',
    target: 'topicGuidance',
  },
  {
    category: 'Domain',
    content: 'Focus on: cybersecurity threats, zero-trust architecture, AI-powered security tools, compliance frameworks (SOC2, HIPAA, GDPR).\nPrioritize emerging threats and defensive strategies.',
    description: 'Cybersecurity focus',
    id: 'guidance-security',
    label: 'Cybersecurity',
    target: 'topicGuidance',
  },
  {
    category: 'Domain',
    content: 'Focus on: cloud infrastructure (AWS, GCP, Azure), serverless vs containers, edge computing, infrastructure-as-code.\nPrefer topics around cost optimization and architecture decisions.',
    description: 'Cloud & infrastructure focus',
    id: 'guidance-cloud',
    label: 'Cloud & Infra',
    target: 'topicGuidance',
  },
  {
    category: 'Quality',
    content: 'Prefer topics where reasonable people disagree.\nAvoid topics that have clear consensus.\nEach topic should have at least 2 strong, defensible opposing positions.',
    description: 'High-debate-potential filter',
    id: 'guidance-debate-quality',
    label: 'High Debate Potential',
    target: 'topicGuidance',
  },
  {
    category: 'Quality',
    content: 'Only select topics with recent news coverage (< 7 days old).\nPrioritize breaking developments over evergreen discussions.\nInclude source references when possible.',
    description: 'Breaking news focus',
    id: 'guidance-breaking',
    label: 'Breaking News Only',
    target: 'topicGuidance',
  },

  // --- Tweet System Prompt Templates ---
  {
    category: 'Copywriting',
    content: 'Use the PAS (Problem-Agitate-Solution) framework for this tweet.\nStart with a relatable problem, agitate the pain point, then present the debatekit discussion as the solution.',
    description: 'Problem → Agitate → Solution framework',
    id: 'tweet-copywriting-pas',
    label: 'PAS Framework',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Copywriting',
    content: 'Use the Curiosity Gap framework.\nCreate an information gap the reader NEEDS to close.\nHint at the most surprising finding without revealing it.\nMake clicking the link feel irresistible.',
    description: 'Curiosity gap that drives clicks',
    id: 'tweet-copywriting-curiosity',
    label: 'Curiosity Gap',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Copywriting',
    content: 'Use Before-After-Bridge framework.\nBefore: describe the current pain (e.g., asking one AI model).\nAfter: describe the ideal state (multiple perspectives synthesized).\nBridge: the debatekit discussion as the path.',
    description: 'Before → After → Bridge transformation',
    id: 'tweet-copywriting-bab',
    label: 'Before-After-Bridge',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Psychology',
    content: 'Apply social proof and FOMO techniques.\nReference how many models debated, show consensus/disagreement stats.\nMake the reader feel they are missing out on insights others already have.',
    description: 'Social proof + fear of missing out',
    id: 'tweet-psychology-fomo',
    label: 'Social Proof + FOMO',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Psychology',
    content: 'Use loss aversion and contrast principle.\nFrame what the reader is LOSING by not reading (time, insight, competitive edge).\nShow a stark old-way vs new-way comparison.',
    description: 'Loss aversion + contrast hooks',
    id: 'tweet-psychology-loss',
    label: 'Loss Aversion',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Data-Driven',
    content: 'Lead with specific debate data: agreement percentages, model split ratios, dissenting views.\nPresent it like a prediction market — e.g., "4 out of 5 models agreed, but the dissenter had the best reasoning."\nMake data the scroll-stopping hook.',
    description: 'Data-driven debate outcome hooks',
    id: 'tweet-data-debate',
    label: 'Debate Data Hook',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Style',
    content: 'Write as a hot take / unpopular opinion.\nStart with "Unpopular opinion:" or "Hot take:"\nBe bold and contrarian. Challenge conventional wisdom.\nSpark debate in the replies.',
    description: 'Bold contrarian hot take style',
    id: 'tweet-style-hottake',
    label: 'Hot Take Style',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Style',
    content: 'Write a punchy one-liner tweet.\nUltra-short hook under 100 characters.\nFollowed by brief context and the link.\nMinimalist. Quotable. Shareable.',
    description: 'Ultra-short punchy one-liner',
    id: 'tweet-style-oneliner',
    label: 'One-Liner Punch',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Engagement',
    content: 'End with an engagement prompt that invites interaction.\nAsk a question, invite replies, or prompt saves/bookmarks.\nExamples: "Agree? Drop a reply.", "Which side are you on?", "Save this for later."',
    description: 'Engagement-driving call to action',
    id: 'tweet-engagement-cta',
    label: 'Engagement CTA',
    target: 'tweetSystemPrompt',
  },
  {
    category: 'Humanizer',
    content: 'CRITICAL: Sound like a real person, not a brand or AI.\nUse contractions (I\'m, you\'re, don\'t).\nVary sentence length. Use casual transitions (so, also, plus, but).\nNEVER use: delve, leverage, utilize, innovative, cutting-edge, game-changer, seamless, robust.\nNEVER use formal transitions: furthermore, moreover, consequently, therefore.',
    description: 'Human voice rules to avoid AI-sounding copy',
    id: 'tweet-humanizer',
    label: 'Humanizer Rules',
    target: 'tweetSystemPrompt',
  },
];
