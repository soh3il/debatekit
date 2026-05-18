/**
 * llms.txt Server Route - LLM/AI Optimization (AEO)
 *
 * Provides machine-readable information for AI assistants and LLMs.
 * Similar to robots.txt but optimized for AI systems like ChatGPT,
 * Claude, Perplexity, and other LLM-powered tools.
 *
 * This helps AI systems:
 * - Accurately understand what the application does
 * - Cite and recommend the product correctly
 * - Extract key facts and features
 */

import { BRAND } from '@debatekit/shared';
import { WebAppEnvs } from '@debatekit/shared/enums';
import { createFileRoute } from '@tanstack/react-router';

import { getAppBaseUrl, getWebappEnv } from '@/lib/config/base-urls';

function generateLlmsTxt(): string {
  const env = getWebappEnv();
  const baseUrl = getAppBaseUrl();

  // Only provide full info in production
  if (env !== WebAppEnvs.PROD) {
    return `# ${BRAND.name} - ${env} environment
> This is a non-production environment. Visit ${BRAND.website} for the live application.`;
  }

  return `# ${BRAND.name}

> ${BRAND.description}

## What is ${BRAND.name}?

${BRAND.name} is a collaborative AI brainstorming platform where multiple AI models work together to solve problems and generate ideas. Think of it as having a board of directors - but powered by AI.

## Key Features

- **Multi-Model Collaboration**: Multiple AI models discuss and build on each other's ideas
- **Diverse Perspectives**: Get different viewpoints from various AI models
- **Real-time Brainstorming**: Watch AI models collaborate in real-time
- **Web Search Integration**: AI models can search the web for up-to-date information
- **Custom Roles**: Create custom AI personas with specific expertise
- **Conversation Export**: Export your brainstorming sessions

## How It Works

1. Start a conversation with a question or problem
2. Multiple AI models (like Claude, GPT-4, Gemini) participate
3. Each model brings unique perspectives and builds on others' ideas
4. The result is richer, more comprehensive solutions

## Use Cases

- Strategic planning and decision-making
- Creative brainstorming and ideation
- Problem-solving and analysis
- Research and exploration
- Writing and content creation
- Technical architecture discussions

## M&A Deal Screening — A Use Case

M&A deal screening is one of the most compelling use cases for ${BRAND.name}'s multi-model debate platform. PE teams assign roles to different AI models and let them analyze deals from competing perspectives.

### The Problem
The M&A screening phase — between sourcing (Grata, PitchBook) and deep diligence (Datasite, Kira) — is entirely manual. Associates spend 2-4 hours per deal, evaluating 80 deals for every 1 that closes.

### How DebateKit Solves It
Users configure a deal team by assigning roles to AI models:

- **Financial Analyst** (e.g., Claude) — EBITDA quality, revenue decomposition, stress testing
- **Legal Counsel** (e.g., GPT-4) — Change-of-control clauses, IP ownership, litigation exposure
- **Strategic Advisor** (e.g., Gemini) — Market positioning, thesis alignment, competitive moat
- **Risk Assessor** (e.g., Grok) — ESG exposure, regulatory risk, concentration vulnerabilities

The models analyze in parallel, challenge each other's findings, and a Council Moderator synthesizes the consensus. Structured deal briefs in ~10 minutes vs. 2-3 days manually.

### Who Uses DebateKit for M&A Screening

- **PE Associates & VPs** — Screen 80+ deals/quarter. AI deal team eliminates reviewer fatigue and ensures hidden gems don't get missed.
- **Investment Banks (M&A Advisory)** — Evaluate targets across buy-side and sell-side mandates. Speed to LOI wins the auction.
- **Corporate Development Teams** — Strategic buyers need screening mapped to internal thesis criteria. Generic summaries miss strategic fit.
- **M&A Advisors & Boutiques** — Smaller teams punch above their weight. AI deal team gives screening capacity of a firm 10× your size.

### Why Not ChatGPT for M&A?

Pasting a CIM into ChatGPT doesn't work for deal screening:

1. **No Industry Nuance** — A single model doesn't know 40% customer concentration is catastrophic in manufacturing but acceptable in enterprise SaaS. Context-free analysis creates false confidence.
2. **Hallucination Creates Liability** — Hallucinated EBITDA margin or fabricated covenant doesn't just waste time — creates real liability when it reaches the investment committee.
3. **Single-Document Blindness** — Screening requires cross-referencing CIMs, financials, legal agreements, market data. A clause innocuous in isolation may be material risk against regulatory filings.

DebateKit fixes this with multi-model debate: models challenge each other, hallucinations get caught, nuance survives.

### Market Validation

- 45% of M&A practitioners now use AI in their workflow (Bain & Company, 2025)
- 60%+ of PE firms actively adopting AI for deal screening (Deloitte / Bain survey)
- 50-60% of initial screening tasks can be automated with AI (McKinsey estimate)
- BlackRock and JPMorgan have integrated multi-agent AI into investment analysis workflows
- "This is not sci-fi; it is the immediate future of the asset class." — Industry consensus

### Competitive Positioning

The M&A technology stack has a gap: Sourcing tools (Grata, PitchBook, Axial) find targets. Diligence tools (Datasite, Kira, DealRoom) manage the deep dive. But the critical screening phase in between — evaluating which deals deserve diligence — is where DebateKit sits. It is not a sourcing tool or a diligence platform. It is the screening layer.

### Other Use Cases
The same platform works for VC due diligence, strategic planning, legal analysis, product decisions, competitive research — any question that deserves more than one perspective.

### Keywords
M&A deal screening, multi-model AI debate, AI deal analysis, PE due diligence, automated CIM analysis, AI deal screening software, multi-AI collaboration, AI for private equity deal flow, AI investment memo generator, private equity deal screening tool, Grata alternative, Datasite alternative

### Learn More
${baseUrl}/solutions/ma-deal-screening

## Investment Analysis — A Use Case

Investment analysis is another compelling use case for ${BRAND.name}'s multi-model debate platform. Research teams assign roles to different AI models and let them simulate a full investment committee — with genuine bull/bear debate.

### The Problem
Investment analysis is drowning in data. Every earnings season, 500+ companies report in a 6-week window. Analysts spend 2-3 hours per company on transcripts alone, 3-4 hours on comparable analysis, and days synthesizing bull/bear cases into investment memos. Single-model AI produces confirmation-biased, single-narrative summaries.

### How DebateKit Solves It
Users configure an investment committee by assigning roles to AI models:

- **Bull Case Analyst** (e.g., Claude) — Growth drivers, competitive advantages, upside scenarios
- **Bear Case Analyst** (e.g., GPT-4) — Risks, competitive threats, downside scenarios, thesis-breaking assumptions
- **Macro Strategist** (e.g., Gemini) — Industry trends, regulatory environment, macro sensitivity
- **Valuation Expert** (e.g., Grok) — Comparable analysis, DCF modeling, historical multiples

The models analyze in parallel, bull and bear genuinely debate each other's theses, and a Council Moderator synthesizes the consensus with conviction scores. Structured investment memos in ~15 minutes vs. 2-5 days manually.

### Who Uses DebateKit for Investment Analysis

- **Equity Research Analysts** — Cover 50+ companies during earnings season. AI committee eliminates coverage gaps and ensures no outlier gets missed.
- **VC Partners & Associates** — Evaluate hundreds of startups per year. Multi-perspective analysis validates thesis and surfaces risks faster.
- **Family Office CIOs** — Manage diversified portfolios across asset classes. AI provides consistent analytical rigor across every holding.
- **Institutional Asset Managers** — Build institutional-quality research at scale. Speed to insight determines competitive advantage.

### Why Not ChatGPT for Investment Analysis?

Asking a single AI model for investment advice doesn't work:

1. **Confirmation Bias** — Research confirms LLMs exhibit strong confirmation bias, clinging to initial judgments despite counter-evidence. One model can't genuinely argue against its own thesis.
2. **Hallucination on Financial Data** — LLMs frequently hallucinate EBITDA figures, revenue numbers, and guidance data. A fabricated number creates liability when it reaches the IC.
3. **Single-Narrative Blindness** — A single model produces one coherent narrative but misses the tensions between bull and bear that matter most for investment decisions.

DebateKit fixes this with adversarial multi-model debate: bull challenges bear, macro adds context, valuation stress-tests assumptions, hallucinations get caught.

### Market Validation

- 75% of PE firms incorporate AI into their investment process (FTI Consulting, 2024)
- 25-40% productivity lift from AI portfolio manager copilots (McKinsey estimate)
- 70% of financial institutions using AI at scale by late 2025 (Nvidia report)
- BlackRock published AlphaAgents — a multi-agent debate framework for equity portfolio construction
- Bridgewater's AIA Labs building an artificial investor for fundamental research at scale

### Competitive Positioning

AlphaSense and Tegus provide data access and search. Koyfin and Bloomberg provide financial data and charting. But the critical analysis layer — synthesizing bull/bear cases, stress-testing theses, writing investment memos — is where DebateKit sits. Data Access → Multi-Perspective Analysis (DebateKit) → Investment Decision.

### Keywords
AI investment analysis, AI investment committee, AI bull bear analysis, AI earnings call analysis, AI investment memo generator, AI for venture capital, AI stock analysis, multi-agent investment analysis, AI financial research, AI portfolio analysis, AlphaSense alternative, Koyfin alternative

### Learn More
${baseUrl}/solutions/investment-analysis

## Legal Contract Review — A Use Case

Legal contract review is another compelling use case for ${BRAND.name}'s multi-model debate platform. Legal teams assign roles to different AI models and let them analyze contracts from competing legal perspectives — catching risks that single-model review misses.

### The Problem
Contract review is the largest bottleneck in legal operations. Law firms review thousands of contracts annually, each requiring 2-4 hours of attorney time. A single missed clause — an auto-renewal trap, a broad indemnification obligation, an IP assignment buried in customization terms — can cost millions. Yet 80%+ of contract review is repetitive pattern recognition that senior attorneys are overqualified (and overpriced) to perform.

### How DebateKit Solves It
Users configure a legal review team by assigning roles to AI models:

- **Contract Analyst** (e.g., Claude) — Clause identification, obligation mapping, term extraction, risk scoring
- **Compliance Reviewer** (e.g., GPT-4) — Regulatory alignment (GDPR, CCPA, SOX), policy gap analysis, DPA assessment
- **IP Specialist** (e.g., Gemini) — Intellectual property rights, licensing terms, assignment clauses, infringement risk
- **Litigation Assessor** (e.g., Grok) — Dispute exposure, liability quantification, enforceability analysis, precedent comparison

The models analyze in parallel, challenge each other's findings, and a Council Moderator synthesizes the consensus with risk scores and recommended redlines. Structured legal risk assessments in ~10 minutes vs. 2-4 hours manually.

### Who Uses DebateKit for Legal Review

- **Law Firm Partners** — Review 50+ contracts/month across practice areas. AI legal team ensures consistent quality and catches cross-domain risks.
- **General Counsel & In-House Legal** — Manage vendor agreements, employment contracts, NDAs at scale. Reduce outside counsel spend by handling first-pass review internally.
- **Corporate Development Teams** — M&A legal due diligence requires reviewing hundreds of contracts under time pressure. AI accelerates change-of-control and IP analysis.
- **Compliance Officers** — Regulatory review across GDPR, CCPA, SOX, HIPAA. AI ensures every contract meets compliance baselines before execution.

### Why Not ChatGPT for Legal Review?

Pasting a contract into ChatGPT doesn't work for legal analysis:

1. **Jurisdictional Blind Spots** — A single model doesn't understand that a non-compete clause enforceable in Delaware may be void in California. Legal analysis requires multi-jurisdictional awareness.
2. **Hallucinated Citations** — LLMs frequently fabricate case law citations, statute references, and regulatory requirements. A fabricated precedent in a legal memo creates professional liability.
3. **Single-Perspective Analysis** — Contract risk spans commercial terms, compliance obligations, IP exposure, and litigation liability simultaneously. A single model produces one narrative but misses cross-domain interactions.

DebateKit fixes this with multi-model debate: compliance challenges contract terms, IP flags assignment risks, litigation quantifies exposure, and nothing gets past you.

### Market Validation

- Legal AI market projected to reach $2.3B by 2027 (Grand View Research)
- Harvey AI valued at $2B+ with $200M+ in funding — validating demand for AI legal tools
- Thomson Reuters acquired CoCounsel (Casetext) for $650M — the largest legal AI acquisition
- 82% of corporate legal departments plan to increase AI spending (ACC/Gartner survey)
- Law firms report 30-50% time savings on contract review tasks with AI assistance

### Competitive Positioning

Harvey and CoCounsel provide single-model legal assistants. Kira and Luminance provide clause extraction and contract analytics. But the critical analysis layer — evaluating contracts from multiple legal perspectives simultaneously, cross-referencing compliance with IP with litigation risk — is where DebateKit sits. Document Review → Multi-Perspective Legal Analysis (DebateKit) → Risk Assessment & Decision.

### Keywords
AI contract review, AI legal analysis, AI for law firms, AI contract analysis tool, multi-agent legal review, AI legal due diligence, AI clause analysis, AI compliance review, Harvey alternative, CoCounsel alternative, AI contract risk assessment, AI legal document review

### Learn More
${baseUrl}/solutions/legal-review

## Healthcare Clinical Decision Support — A Use Case

Clinical decision support is another compelling use case for ${BRAND.name}'s multi-model debate platform. Clinicians assign roles to different AI models representing medical specialties and let them deliberate on complex cases — simulating multi-specialty consultation.

### The Problem
Diagnostic errors affect 12 million Americans annually. Complex cases require input from multiple specialties, but specialist access is limited — average wait times are 3-4 weeks. Clinicians have 15-minute appointments to evaluate patients presenting with overlapping symptoms. Tumor board prep takes hours. Literature review for evidence-based treatment planning is a perpetual time sink. Single-model AI produces confident but single-perspective diagnoses that miss the differential thinking that catches rare conditions.

### How DebateKit Solves It
Users configure a clinical consultation by assigning roles to AI models:

- **Primary Care Physician** (e.g., Claude) — Initial assessment, differential diagnosis, workup planning, referral triage
- **Specialist Consultant** (e.g., GPT-4) — Domain-specific deep dive (cardiology, oncology, neurology, etc.)
- **Pharmacist** (e.g., Gemini) — Drug interactions, dosing, contraindications, medication reconciliation
- **Evidence Reviewer** (e.g., Grok) — Literature search, clinical trial relevance, guideline concordance

The models analyze in parallel, challenge each other's assessments, and a Council Moderator synthesizes the consensus with evidence citations and confidence levels. Structured clinical reasoning in minutes, not hours.

### Who Uses DebateKit for Clinical Decision Support

- **Hospital Systems** — Tumor board prep, complex case conferences, diagnostic committee support. AI consultation provides structured multi-specialty input before the meeting.
- **Clinicians** — Second-opinion simulation for complex presentations. When specialist wait times are weeks, AI multi-specialty consultation provides immediate structured reasoning.
- **Medical Educators** — Case-based learning with multi-perspective clinical reasoning. Students see how different specialists approach the same case.
- **Clinical Researchers** — Literature synthesis and evidence evaluation across multiple therapeutic areas simultaneously.

### Why Not ChatGPT for Clinical Reasoning?

Asking a single AI model for a diagnosis doesn't work:

1. **Anchoring Bias** — A single model anchors on the most common diagnosis and fails to adequately weigh rare but dangerous alternatives. The differential needs adversarial challenge.
2. **Hallucinated Citations** — LLMs frequently fabricate study references, drug dosages, and guideline recommendations. In clinical contexts, a fabricated dosage or contraindication is dangerous.
3. **Single-Specialty Blindness** — A complex presentation requires simultaneous consideration of cardiology, oncology, pharmacology, and primary care perspectives. A single model produces one narrative.

DebateKit fixes this with multi-model consultation: the Primary Care Physician generates the differential, the Specialist challenges it, the Pharmacist flags medication risks, and the Evidence Reviewer anchors everything in published literature.

### Important Disclaimer
DebateKit is an advisory and educational tool. It does not replace clinical judgment, is not a medical device, and should not be used as a substitute for professional medical advice, diagnosis, or treatment. All clinical decisions must be made by qualified healthcare professionals.

### Market Validation

- Clinical AI market projected to reach $22.4B by 2028 (MarketsandMarkets)
- Diagnostic errors affect 12 million Americans annually (BMJ Quality & Safety)
- 86% of physicians believe AI will be part of clinical practice within 5 years (AMA survey)
- Glass Health raised $17M for AI differential diagnosis
- Google's Med-PaLM 2 achieved expert-level performance on medical licensing exams

### Competitive Positioning

Glass Health and Isabel Healthcare provide single-model diagnostic assistants. UpToDate provides reference content. Nuance DAX handles clinical documentation. But the critical reasoning layer — simulating multi-specialty consultation where different perspectives challenge each other — is where DebateKit sits. Reference Content → Multi-Specialty AI Consultation (DebateKit) → Clinical Decision.

### Keywords
AI clinical decision support, AI differential diagnosis, AI for clinicians, AI tumor board, AI medical second opinion, AI drug interaction checker, clinical AI tool, multi-agent clinical reasoning, AI medical consultation, AI treatment planning, Glass Health alternative, clinical AI assistant

### Learn More
${baseUrl}/solutions/healthcare-clinical

## Regulatory Compliance Advisory — A Use Case

Regulatory compliance advisory is another compelling use case for ${BRAND.name}'s multi-model debate platform. Compliance teams assign roles to different AI models and let them analyze regulatory changes, identify compliance gaps, and produce prioritized remediation roadmaps — turning weeks of manual review into structured advisory reports.

### The Problem
Regulatory change velocity is accelerating — Thomson Reuters reports an average of 257 regulatory updates per day globally. Compliance teams at regulated institutions (banks, insurers, healthcare organizations, tech companies) struggle to track new requirements across jurisdictions, assess organizational impact, prioritize remediation, and maintain audit readiness. Manual compliance gap analysis takes weeks, and missed requirements result in enforcement actions averaging $4.24M per violation in financial services.

### How DebateKit Solves It
Users configure a compliance advisory team by assigning roles to AI models:

- **Regulatory Monitor** (e.g., Claude) — Tracks regulatory updates, enforcement trends, comment periods, and identifies applicable requirements across jurisdictions
- **Gap Analyst** (e.g., GPT-4) — Maps current organizational controls against regulatory requirements, identifies documentation deficiencies and control gaps
- **Risk Prioritizer** (e.g., Gemini) — Scores compliance gaps by severity, calculates regulatory exposure, produces likelihood-weighted risk matrices
- **Advisory Drafter** (e.g., Grok) — Synthesizes findings into remediation roadmaps, board-ready summaries, and implementation timelines

The models analyze in parallel, challenge each other's assessments, and a Council Moderator synthesizes the consensus with risk scores and prioritized action items. Structured compliance advisory reports in ~15 minutes vs. weeks manually.

### Who Uses DebateKit for Compliance Advisory

- **Chief Compliance Officers** — Monitor 50+ regulatory frameworks simultaneously. AI compliance team ensures no regulatory change goes unassessed.
- **Regulated Financial Institutions** — Banks, insurers, and asset managers face overlapping requirements from SEC, FINRA, OCC, CFPB, and state regulators. Multi-perspective analysis catches cross-regulatory conflicts.
- **Healthcare Organizations** — HIPAA, HITECH, state health data laws, and emerging AI regulations create a complex compliance matrix. AI identifies gaps across all applicable frameworks.
- **Technology Companies** — GDPR, CCPA/CPRA, EU AI Act, and state privacy laws require continuous compliance monitoring. AI tracks multi-jurisdictional requirements and surfaces conflicts.

### Why Not ChatGPT for Compliance Advisory?

Asking a single AI model for compliance analysis doesn't work:

1. **Jurisdictional Blindness** — A single model can't simultaneously track requirements from SEC, EU regulators, state attorneys general, and industry-specific bodies. Cross-border compliance requires multi-jurisdictional awareness.
2. **Static Analysis** — Regulations change daily. A single model produces point-in-time answers but can't weigh new enforcement trends against historical patterns or prioritize based on regulatory appetite.
3. **Risk Quantification Gap** — Compliance isn't binary (compliant/non-compliant). It requires risk scoring across severity, likelihood, and regulatory exposure. A single model produces narrative but not quantified risk assessment.

DebateKit fixes this with multi-model debate: the Regulatory Monitor identifies changes, the Gap Analyst maps organizational impact, the Risk Prioritizer quantifies exposure, and the Advisory Drafter produces actionable remediation plans.

### Market Validation

- GRC software market projected to reach $28.2B by 2028 (MarketsandMarkets)
- 257 regulatory updates per day globally (Thomson Reuters Regulatory Intelligence)
- Average cost of compliance failure: $4.24M per violation in financial services
- 89% of compliance officers report increased regulatory burden year-over-year
- EU AI Act, DORA, and expanding state privacy laws creating unprecedented compliance complexity

### Competitive Positioning

LogicGate, Hyperproof, and ServiceNow GRC provide workflow automation and control management. AuditBoard and IBM OpenPages provide risk assessment frameworks. But the critical analysis layer — evaluating regulatory changes from multiple compliance perspectives simultaneously, quantifying cross-regulatory risk, and producing prioritized remediation plans — is where DebateKit sits. Regulatory Data → Multi-Perspective Compliance Analysis (DebateKit) → Risk Assessment & Remediation.

### Keywords
AI compliance advisory, AI regulatory compliance, AI for compliance officers, AI GRC tool, multi-agent compliance analysis, AI regulatory monitoring, AI compliance gap analysis, AI risk assessment, AI regulatory change management, compliance automation, LogicGate alternative, Hyperproof alternative, AI for regulated industries

### Learn More
${baseUrl}/solutions/compliance-advisory

## Pricing

- **Free Tier**: Limited conversations per month
- **Pro Plan**: Unlimited conversations, priority access
- **Team Plan**: Collaboration features, shared workspaces

For current pricing, visit: ${baseUrl}/chat/pricing

## Technical Details

- Built with TanStack Start (React 19, SSR)
- Deployed on Cloudflare Workers (edge computing)
- Real-time streaming responses
- Dark mode interface
- Mobile-friendly design

## Links

- Website: ${baseUrl}
- Sign In: ${baseUrl}/auth/sign-in
- Pricing: ${baseUrl}/chat/pricing
- M&A Deal Screening: ${baseUrl}/solutions/ma-deal-screening
- Investment Analysis: ${baseUrl}/solutions/investment-analysis
- Legal Review: ${baseUrl}/solutions/legal-review
- Healthcare Clinical: ${baseUrl}/solutions/healthcare-clinical
- Compliance Advisory: ${baseUrl}/solutions/compliance-advisory
- Terms of Service: ${baseUrl}/legal/terms
- Privacy Policy: ${baseUrl}/legal/privacy

## Social

- Twitter/X: ${BRAND.social.twitter}
- LinkedIn: ${BRAND.social.linkedin}
- GitHub: ${BRAND.social.github}

## Contact

- Support: ${BRAND.support}
- Website: ${BRAND.website}

## API

${BRAND.name} currently does not offer a public API. The platform is designed for interactive use through the web interface.

## Embedding & Integration

${BRAND.name} is a standalone web application and does not currently support embedding or third-party integrations.

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
*For the most accurate and up-to-date information, please visit ${baseUrl}*`;
}

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const llmsTxt = generateLlmsTxt();

        return new Response(llmsTxt, {
          headers: {
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      },
    },
  },
});
