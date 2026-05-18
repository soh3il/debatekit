import type { MarketStat } from './landing-types';

/**
 * Shared research stats used across multiple solution landing pages.
 * These are the three landmark studies that validate multi-model deliberation.
 */
export const SHARED_RESEARCH_STATS: readonly MarketStat[] = [
  {
    label: 'accuracy improvement via multi-model adversarial debate',
    source: 'Khan et al., ICML 2024 Best Paper',
    stat: '+28pp',
  },
  {
    label: 'open-source models collaborating outperform GPT-4 Omni',
    source: 'Wang et al., ICLR 2025',
    stat: '> GPT-4o',
  },
  {
    label: 'factual accuracy improvement in benchmark evaluations',
    source: 'Du et al., 2023',
    stat: '70\u219295%',
  },
];
