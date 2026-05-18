/**
 * Moderator Format Templates
 *
 * Format-specific output structure templates for moderator synthesis.
 * Each template instructs the moderator to use a specific output layout
 * (e.g. deal-brief, investment-memo, clinical-summary, research-synthesis).
 *
 * @module api/services/prompts/moderator-formats
 */

import type { ModeratorFormatId } from '@debatekit/shared/enums';

// ============================================================================
// FORMAT TEMPLATES
// ============================================================================

export const MODERATOR_FORMAT_TEMPLATES: Record<ModeratorFormatId, string> = {
  'clinical-summary': `
## Required Output Structure: Clinical Summary

You MUST structure your synthesis using the following format:

### Clinical Assessment
[Primary diagnosis / differential diagnosis with probability]
**Diagnostic Confidence**: [High / Moderate / Low] — [basis for confidence level, e.g. "classic presentation with supporting labs" or "atypical features, broad differential remains"]

### Evidence Base
| Source | Finding | Evidence Level | Strength |
|--------|---------|---------------|----------|
| [PubMed / ClinicalTrials.gov / OpenFDA / Clinical expertise] | [Key finding] | [I-IV / Grade A-C] | [Strong / Moderate / Limited] |

### Treatment Recommendation
**First-line**: [Recommended treatment with dosing]
**Alternative**: [If first-line contraindicated or fails]
[Rationale for selection, citing data sources]

### Risk Factors & Contraindications
| Risk | Source | Severity | Monitoring Required |
|------|--------|----------|-------------------|
| [Risk factor] | [OpenFDA / PubMed / Clinical assessment] | [High/Medium/Low] | [Specific monitoring plan] |

### Active Clinical Trials
[If relevant: trials from ClinicalTrials.gov the patient might qualify for, with NCT numbers and enrollment status. If none relevant, omit this section.]

### Points of Clinical Disagreement
[Where specialists diverged and underlying reasoning]

### Action Items
| Priority | Action | Responsible | Timeline | Monitoring |
|----------|--------|-------------|----------|------------|
| [Urgent/High/Routine] | [Specific action] | [Role] | [Timeframe] | [What to track] |

### Suggested Follow-Up Questions
1. [Contextual follow-up that would deepen the clinical analysis]
2. [Follow-up exploring an unresolved diagnostic or treatment question]
3. [Follow-up addressing a risk or monitoring gap identified in discussion]

*For educational/informational purposes only. Not a substitute for professional medical advice.*
`,

  'deal-brief': `
## Required Output Structure: Deal Brief

You MUST structure your synthesis using the following format:

### Deal Verdict
[Proceed / Proceed with conditions / Do not proceed]
**Conviction Level**: [High / Medium / Low] — [basis, e.g. "strong consensus across all advisors" or "material unresolved risks in regulatory path"]

### Valuation Assessment
[Fair value range, methodology used] — Data basis: [cite which SEC metrics, Finnhub multiples, or FRED rates informed the valuation]

### Key Risks
| # | Risk | Severity | Probability | Flagged By | Data Source Evidence |
|---|------|----------|-------------|------------|---------------------|
| 1 | [Risk description] | [Critical/High/Medium/Low] | [High/Medium/Low] | [Which advisor(s)] | [SEC filing data / Finnhub signal / FRED indicator] |

### Regulatory & Legal Considerations
[Issues identified] — Data basis: [SEC disclosures, FRED regulatory environment data, Finnhub industry data]

### Areas of Consensus
[Where advisors agree and the data supporting consensus]

### Open Due Diligence Items
| Priority | Item | Owner | Data Needed | Timeline |
|----------|------|-------|-------------|----------|
| [Critical/High/Medium] | [Specific diligence question] | [Which advisor role] | [What data to gather] | [Timeframe] |

### Suggested Follow-Up Questions
1. [Contextual follow-up that would resolve a key uncertainty in the deal]
2. [Follow-up exploring an unaddressed risk or opportunity]
3. [Follow-up that would strengthen or challenge the valuation thesis]
`,

  'investment-memo': `
## Required Output Structure: Investment Memo

You MUST structure your synthesis using the following format:

### Investment Verdict
[Strong Conviction / Positive / Neutral / Pass]
**Conviction Level**: [High / Medium / Low] — [basis, e.g. "exceptional unit economics with clear path to profitability" or "thesis alignment strong but execution risk significant"]

### Thesis Alignment
[How opportunity maps to investment criteria]

### Key Metrics & Benchmarks
| Metric | Company | Benchmark | Source | Assessment |
|--------|---------|-----------|--------|------------|
| [Metric] | [Value] | [Comparable] | [SEC / Finnhub / FRED / Participant analysis] | [Above/At/Below] |

### Risk Matrix
| Risk Factor | Severity Score | Probability | Impact | Data Signal | Mitigation |
|-------------|---------------|------------|--------|-------------|------------|
| [Risk] | [P×I: 1-9] | [High/Med/Low] | [High/Med/Low] | [Source data supporting this risk] | [Proposed mitigation] |

### Return Scenarios
| Scenario | Probability | Multiple | IRR | Key Assumptions |
|----------|------------|---------|-----|-----------------|
| Bull | [%] | [x] | [%] | [What must go right] |
| Base | [%] | [x] | [%] | [Expected path] |
| Bear | [%] | [x] | [%] | [What could go wrong] |

### Key Debates
[Where committee members disagreed and why — identify the root assumption driving the disagreement]

### Recommended Terms / Next Steps
| Priority | Item | Owner | Timeline |
|----------|------|-------|----------|
| [Critical/High/Medium] | [Specific action or diligence item] | [Role] | [Timeframe] |

### Suggested Follow-Up Questions
1. [Contextual follow-up that would test a critical assumption in the thesis]
2. [Follow-up exploring an unresolved risk or market question]
3. [Follow-up that would refine the return model or deal terms]
`,

  'research-synthesis': '',
};

// ============================================================================
// FORMAT SECTION BUILDER
// ============================================================================

/**
 * Get format-specific output structure section for moderator synthesis.
 * When a moderatorFormat is provided, returns a section that instructs the
 * moderator to use a specific output structure (e.g. deal-brief, investment-memo).
 *
 * @param format - Optional format identifier
 * @returns Formatted section string or empty string if no format specified
 */
export function getModeratorFormatSection(format?: ModeratorFormatId): string {
  if (!format) {
    return '';
  }

  const section = MODERATOR_FORMAT_TEMPLATES[format];
  if (!section) {
    return '';
  }

  return `\n${section}\n`;
}
