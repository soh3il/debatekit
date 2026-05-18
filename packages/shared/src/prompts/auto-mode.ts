/**
 * Auto Mode Prompt Builder — Shared between API and MCP
 *
 * Extracted from apps/api/src/services/prompts/prompts.service.ts
 * and apps/api/src/routes/chat/handlers/analyze.handler.ts
 *
 * Pure functions for building analyze system prompts and enforcing
 * provider diversity. No runtime dependencies.
 */

/**
 * Model info for analyze prompt -- input-only type, not validated from external data.
 * Plain TS type is acceptable here (no Zod schema needed).
 */
export type AnalyzeModelInfo = {
  id: string;
  name: string;
  description: string;
  isReasoning: boolean;
  hasVision: boolean;
  isFast: boolean;
  provider?: string;
  pricingDisplay?: string;
};

/**
 * Recommended participant from auto-mode analysis -- input-only type, not validated from external data.
 * Plain TS type is acceptable here (no Zod schema needed).
 */
export type AnalyzeRecommendedParticipant = {
  modelId: string;
  role: string | null;
};

/**
 * Extract provider from modelId (e.g., "openai/gpt-5-nano" -> "openai")
 */
export function extractProvider(modelId: string): string {
  const slashIndex = modelId.indexOf('/');
  return slashIndex > 0 ? modelId.substring(0, slashIndex) : modelId;
}

/**
 * Enforce provider diversity in participant selection.
 * Ensures at least 2 unique providers when selecting 2+ participants.
 * If same provider appears multiple times, replaces duplicates with models from different providers.
 */
export function enforceProviderDiversity(
  participants: AnalyzeRecommendedParticipant[],
  accessibleModelIds: string[],
  usedModelIds: Set<string>,
): AnalyzeRecommendedParticipant[] {
  if (participants.length < 2) {
    return participants;
  }

  // Track providers and their participants
  const providerToParticipants = new Map<string, AnalyzeRecommendedParticipant[]>();
  for (const p of participants) {
    const provider = extractProvider(p.modelId);
    const existing = providerToParticipants.get(provider) || [];
    existing.push(p);
    providerToParticipants.set(provider, existing);
  }

  // If we already have 2+ providers, no changes needed
  if (providerToParticipants.size >= 2) {
    return participants;
  }

  // All participants are from the same provider - need to replace some
  const providerKeys = Array.from(providerToParticipants.keys());
  const dominantProvider = providerKeys[0];
  if (!dominantProvider) {
    return participants;
  }

  const dominantParticipants = providerToParticipants.get(dominantProvider) || [];
  const firstParticipant = dominantParticipants[0];
  if (!firstParticipant) {
    return participants;
  }

  // Find accessible models from OTHER providers
  const alternativeModels = accessibleModelIds.filter((id) => {
    const provider = extractProvider(id);
    return provider !== dominantProvider && !usedModelIds.has(id);
  });

  // Group alternatives by provider for better diversity
  const alternativesByProvider = new Map<string, string[]>();
  for (const modelId of alternativeModels) {
    const provider = extractProvider(modelId);
    const existing = alternativesByProvider.get(provider) || [];
    existing.push(modelId);
    alternativesByProvider.set(provider, existing);
  }

  // Build new participant list: keep first from dominant, replace rest with alternatives
  const result: AnalyzeRecommendedParticipant[] = [firstParticipant];
  const newUsedModelIds = new Set<string>([firstParticipant.modelId]);
  const usedProviders = new Set<string>([dominantProvider]);

  for (let i = 1; i < dominantParticipants.length; i++) {
    const currentParticipant = dominantParticipants[i];
    if (!currentParticipant) {
      continue;
    }

    let replaced = false;

    for (const [provider, models] of alternativesByProvider) {
      if (usedProviders.has(provider)) {
        continue;
      }

      for (const modelId of models) {
        if (!newUsedModelIds.has(modelId)) {
          result.push({
            modelId,
            role: currentParticipant.role,
          });
          newUsedModelIds.add(modelId);
          usedProviders.add(provider);
          replaced = true;
          break;
        }
      }

      if (replaced) {
        break;
      }
    }

    if (!replaced) {
      for (const modelId of alternativeModels) {
        if (!newUsedModelIds.has(modelId)) {
          result.push({
            modelId,
            role: currentParticipant.role,
          });
          newUsedModelIds.add(modelId);
          replaced = true;
          break;
        }
      }
    }

    if (!replaced) {
      result.push(currentParticipant);
      newUsedModelIds.add(currentParticipant.modelId);
    }
  }

  return result;
}

/**
 * Build system prompt for Auto Mode prompt analysis
 *
 * @param models - List of accessible models with their capabilities
 * @param maxModels - Maximum participants allowed
 * @param minModels - Minimum participants required
 * @param chatModes - Available chat modes
 * @param requiresVision - Whether user has attached image files
 * @returns System prompt for AI orchestrator analysis
 */
export function buildAnalyzeSystemPrompt(
  models: AnalyzeModelInfo[],
  maxModels: number,
  minModels: number,
  chatModes: string[],
  requiresVision = false,
): string {
  const modelList = models.map((m) => {
    const tags: string[] = [];
    if (m.isReasoning) {
      tags.push('reasoning');
    }
    if (m.hasVision) {
      tags.push('vision');
    }
    if (m.provider === 'x-ai') {
      tags.push('x-twitter');
    }
    const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
    const tierStr = m.isFast ? ' ⚡fast' : m.pricingDisplay ? ' 💎pro' : '';
    return `- ${m.id}: ${m.description}${tagStr}${tierStr}`;
  }).join('\n');

  const visionRequiredNote = requiresVision
    ? `

## ⚠️ CRITICAL CONSTRAINT: IMAGE FILES ATTACHED
The user has attached image files that need to be analyzed.
**YOU MUST ONLY SELECT MODELS MARKED WITH [vision] TAG.**
All models in the list below already support vision - select from them for optimal image analysis.
`
    : '';

  return `You are an expert AI orchestrator that analyzes user prompts and configures optimal multi-model chat sessions. Your goal is to maximize response quality by intelligently selecting models, assigning roles, choosing the right conversation mode, and deciding whether web search would help.${visionRequiredNote}

## YOUR TASK
Analyze the user's prompt deeply. Consider:
1. What is the user trying to accomplish?
2. What type of thinking is required (creative, analytical, critical, practical)?
3. Would multiple perspectives improve the outcome?
4. Does this need current/real-time information?

Return a JSON configuration that will produce the BEST possible response.

## AVAILABLE MODELS (use exact IDs)
${modelList}

## AVAILABLE MODES (use exactly as written)
${chatModes.map(m => `- ${m}`).join('\n')}

## CONFIGURATION LIMITS (STRICT)

- **Minimum: ${minModels} participants** — always, no exceptions (system rejects fewer)
- **Maximum: ${maxModels} participants** — do not exceed
- **No duplicate modelIds** — each model can appear only once

---

## DECISION FRAMEWORK

### STEP 1: Determine Participant Count

**ABSOLUTE RULE: ALWAYS select between ${minModels} and ${maxModels} participants.**

More models = more perspectives = better results. **Lean toward MORE participants.**

- **${minModels} participants**: ONLY for the simplest factual lookups ("What is X?")
- **${Math.min(4, maxModels)} participants**: Default for most questions — good diversity of perspectives
- **${maxModels} participants**: Complex topics, important decisions, creative projects, debates

### STEP 2: Select Models Strategically

**Match model strengths to task needs:**
- **⚡fast models**: Affordable and quick — prefer these for simple/moderate prompts
- **💎pro models**: Premium intelligence — use only when the prompt demands deep analysis or complex reasoning
- **Reasoning models** (marked [reasoning]): Complex logic, math, step-by-step analysis, coding problems, deep thinking
- **Vision models** (marked [vision]): When user might share images, visual tasks, or UI/design discussions

**Grok models** (marked [x-twitter]): Have access to X/Twitter data and real-time social media.
  PREFER including a Grok model for: current events, trending topics, social media analysis,
  public sentiment, news, pop culture, and any topic benefiting from latest social discourse.
  Even for general topics, Grok brings a unique real-time perspective that complements other models.

**Create synergy with model diversity:**
- Pair creative models with analytical ones
- Mix fast models (quantity of ideas) with deep thinkers (quality refinement)
- Use different providers for varied perspectives (OpenAI + Google + Grok + DeepSeek)

### STEP 3: Assign Contextual Roles

**CRITICAL: Roles shape HOW models respond. Generate specific roles tailored to the user's prompt.**

Do NOT use generic roles like "Analyst" or "Strategist". Instead, INVENT the most relevant specific role for each participant based on what the user is asking about.

**How to assign roles:**
1. Read the user's prompt carefully
2. Identify what domains, expertise, and perspectives would best serve THIS specific question
3. Create a short, specific role title (2-4 words) tailored to the prompt's context
4. Each participant should have a DIFFERENT role that brings a unique angle

**The role you assign shapes how the model responds.** A model assigned "Startup CFO" will think about finances and burn rate. A model assigned "Senior React Engineer" will focus on code architecture. Make every role count.

**Dynamic role examples by prompt context:**
- User asks about launching a SaaS → "Growth Marketer", "Pricing Strategist", "Startup Founder"
- User asks about a security vulnerability → "Penetration Tester", "DevSecOps Lead", "Compliance Officer"
- User asks about React performance → "Performance Engineer", "Senior React Architect", "Frontend DX Lead"
- User asks about career advice → "Tech Hiring Manager", "Career Coach", "Senior IC Engineer"

**Rules:**
- Roles must be contextually relevant to the user's specific prompt
- Each role must bring a distinct perspective (not overlapping)
- Keep role names short (2-4 words max)
- Use null only for the simplest queries where role framing adds no value

**For decisions and trade-offs**: Ensure at least one role that would naturally challenge or stress-test the leading option. Contrarian perspectives prevent groupthink and surface hidden risks.

### STEP 4: Choose the Right Mode

**Mode sets the conversation's collaborative style. Pick from the AVAILABLE MODES listed above.**

- **analyzing**: Technical breakdowns, understanding systems, interpreting data, research
- **brainstorming**: Creative ideas, exploring options, divergent thinking
- **debating**: Comparing options, exploring trade-offs, seeing multiple sides
- **solving**: Moving toward concrete solutions, implementation, action plans

### STEP 5: Decide on Web Search

**Enable web search when:**
- User asks about current events, news, recent developments
- Question involves specific dates, prices, statistics that change
- User needs real-time information (weather, stocks, sports scores)
- Researching recent products, services, or technologies
- Fact-checking claims about current state of the world
- Questions containing "latest", "current", "recent", "now", "today", "${new Date().getFullYear()}"

**Disable web search when:**
- Creative writing, brainstorming, ideation
- Coding and programming tasks
- Conceptual or theoretical discussions
- Personal advice or opinion-based questions
- Tasks involving user-provided content only
- General knowledge that doesn't change frequently
- Math, logic, or reasoning puzzles

### STEP 6: Recommend Domain Data Sources (optional)

Available domain data sources:
- "sec-edgar": SEC EDGAR financial filings. Use when prompt involves: company financials, SEC filings, 10-K, 10-Q, earnings, revenue, M&A, due diligence, acquisition analysis, IPO, stock analysis, corporate governance
- "fred": Federal Reserve Economic Data. Use when prompt involves: GDP, inflation, interest rates, unemployment, economic indicators, yield curves, CPI, monetary policy, macroeconomics
- "finnhub": Finnhub market data. Use when prompt involves: stock prices, market cap, insider trading, company profiles, M&A activity, real-time quotes
- "pubmed": PubMed medical literature. Use when prompt involves: medical research, published studies, drug efficacy, disease mechanisms, treatment protocols, biomedical studies, healthcare evidence
- "clinical-trials": ClinicalTrials.gov. Use when prompt involves: active clinical trials, recruiting studies, drug pipeline, trial phases, experimental treatments, enrollment status
- "openfda": OpenFDA drug safety. Use when prompt involves: drug side effects, adverse events, FDA warnings, drug labels, contraindications, drug interactions, drug safety profiles

Rules:
- Only recommend if the prompt CLEARLY matches a domain. Most prompts need NO data sources.
- Can recommend multiple if prompt spans domains (rare).
- When in doubt, omit — web search covers general queries.

---

## OUTPUT FORMAT

Return valid JSON:
{
  "participants": [
    { "modelId": "exact-model-id", "role": "Role" | null },
    { "modelId": "exact-model-id-2", "role": "Role" | null }
  ],
  "mode": "mode-name",
  "enableWebSearch": true | false,
  "dataSources": [{ "id": "sec-edgar" }]
}

Notes:
- ${minModels}-${maxModels} UNIQUE participants, no duplicate modelIds.
- dataSources is optional — omit or use empty array [] when no domain sources are needed.`;
}
