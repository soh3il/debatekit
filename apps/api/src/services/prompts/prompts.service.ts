import type { PlaceholderPrefix, QueryAnalysisResult, WebSearchActiveAnswerMode } from '@debatekit/shared/enums';
import { PlaceholderPrefixes, QueryAnalysisComplexities, WebSearchActiveAnswerModes, WebSearchDepths } from '@debatekit/shared/enums';
import type { z } from '@hono/zod-openapi';

import type { AttachmentCitationInfo } from '@/types/citations';

// ============================================================================
// Re-exports from @debatekit/shared/prompts (Single Source of Truth)
// ============================================================================

export type {
  AnalyzeModelInfo,
  AnalyzeRecommendedParticipant,
  DetectedLanguage,
  ModeratorProjectContext,
  ParticipantResponse,
} from '@debatekit/shared/prompts';
export {
  buildAnalyzeSystemPrompt,
  buildCouncilModeratorSystemPrompt,
  buildLanguageDirective,
  buildModeratorParticipantList,
  buildModeratorTranscript,
  buildParticipantSystemPrompt,
  enforceProviderDiversity,
  extractProvider,
  MODE_SPECIFIC_PROMPTS,
  PARTICIPANT_GLOBAL_PREAMBLE,
  PARTICIPANT_GLOBAL_RULES,
  PARTICIPANT_ROSTER_PLACEHOLDER,
} from '@debatekit/shared/prompts';

export type PromptPlaceholder<T>
  = T extends (infer U)[]
    ? PromptPlaceholder<U>[]
    : T extends object
      ? { [K in keyof T]: PromptPlaceholder<T[K]> }
      : string;

export type TypedPromptTemplate<TSchema extends z.ZodTypeAny> = PromptPlaceholder<z.infer<TSchema>>;

export type ValidatePromptTemplate<T> = PromptPlaceholder<T>;

// ============================================================================
// PLACEHOLDER FACTORY UTILITIES
// ============================================================================

/**
 * Creates a placeholder string with consistent formatting
 *
 * @param prefix - Type of placeholder (FROM_CONTEXT, COMPUTE, EXTRACT, OPTIONAL)
 * @param description - Description of what value should be
 * @returns Formatted placeholder string like '<COMPUTE: description>'
 */
export function placeholder(prefix: PlaceholderPrefix, description: string) {
  return `<${prefix}: ${description}>`;
}

/**
 * Shorthand placeholder creators
 */
export const p = {
  compute: (desc: string) => placeholder(PlaceholderPrefixes.COMPUTE, desc),
  context: (desc: string) => placeholder(PlaceholderPrefixes.FROM_CONTEXT, desc),
  extract: (desc: string) => placeholder(PlaceholderPrefixes.EXTRACT, desc),
  optional: (desc: string) => placeholder(PlaceholderPrefixes.OPTIONAL, desc),
} as const;

/**
 * Type guard that validates a template matches the schema structure at compile time.
 *
 * Usage:
 * ```typescript
 * const template = createPromptTemplate<typeof MySchema>({
 *   field1: '<COMPUTE: ...>',
 *   field2: '<FROM_CONTEXT: ...>',
 * });
 * ```
 *
 * This will error at compile time if the structure doesn't match.
 */
export function createPromptTemplate<TSchema extends z.ZodTypeAny>(
  template: TypedPromptTemplate<TSchema>,
): TypedPromptTemplate<TSchema> {
  return template;
}

// ============================================================================
// Application-Specific Prompts - Single Source of Truth
// ============================================================================

export const TITLE_GENERATION_PROMPT = 'Generate a concise, descriptive title (3-7 words) for this conversation. The title MUST be a complete phrase — never end with prepositions (in, on, of, for), conjunctions (and, or, but), articles (a, the), or verbs that need an object. Use "Topic: Subtopic" format when appropriate. Write the title in the same language as the user\'s message. Output only the title, no quotes or extra text.';

// ============================================================================
// Image Analysis Prompts - Single Source of Truth
// ============================================================================

export const IMAGE_ANALYSIS_FOR_SEARCH_PROMPT = `Analyze the following image(s) and describe what you see in detail. Focus on:
1. Main subjects, objects, or people visible
2. Any text, labels, logos, or identifiable content
3. Context clues about location, time period, or setting
4. Technical details if it's a diagram, chart, or screenshot
5. Anything that would help formulate a relevant web search query

Provide a concise but comprehensive description that captures the key elements someone would want to search for more information about.`;

/**
 * Image description prompt for web search results
 * Used by web-search.service.ts for generating image descriptions
 */
export const IMAGE_DESCRIPTION_PROMPT = 'Analyze this image and provide a concise 1-2 sentence description focusing on key visual elements and context. Be factual and descriptive.';

// ============================================================================
// Answer Summary Prompts - Single Source of Truth
// ============================================================================

/**
 * Basic answer summary system prompt
 * Used by web-search.service.ts for basic answer synthesis
 */
export const ANSWER_SUMMARY_BASIC_PROMPT = 'You are a helpful assistant. Provide a clear, concise answer based on the search results. Focus on the most important information.';

/**
 * Advanced answer summary system prompt
 * Used by web-search.service.ts for advanced answer synthesis
 */
export const ANSWER_SUMMARY_ADVANCED_PROMPT = 'You are an expert research analyst. Provide a comprehensive, well-structured answer based on the search results. Include specific details, key insights, and synthesize information across sources. Be thorough but concise.';

/**
 * Get answer summary prompt based on mode
 * @param mode - WebSearchActiveAnswerMode (basic or advanced)
 * @returns Appropriate system prompt for answer generation
 */
export function getAnswerSummaryPrompt(mode: WebSearchActiveAnswerMode) {
  return mode === WebSearchActiveAnswerModes.ADVANCED ? ANSWER_SUMMARY_ADVANCED_PROMPT : ANSWER_SUMMARY_BASIC_PROMPT;
}

// ============================================================================
// Auto-Parameter Detection Prompt - Single Source of Truth
// ============================================================================

/**
 * Auto-parameter detection prompt for search optimization
 *
 * Purpose: Analyze query and recommend topic, timeRange, searchDepth
 *
 * @param query - Search query to analyze
 * @returns Formatted prompt for parameter detection
 */
export function buildAutoParameterDetectionPrompt(query: string) {
  return `Analyze this search query and recommend optimal search parameters.

Query: "${query}"

Determine:
1. Topic category: general, news, finance, health, scientific, or travel
2. Time relevance: day, week, month, year, or null if timeless
3. Search depth: basic (quick answer) or advanced (comprehensive research)

Respond in JSON format:
{
  "topic": "general|news|finance|health|scientific|travel",
  "timeRange": "day|week|month|year|null",
  "searchDepth": "basic|advanced",
  "reasoning": "Brief explanation of choices"
}`;
}

// ============================================================================
// Query Complexity Detection
// ============================================================================

/**
 * Patterns that indicate a simple query (1 query, basic depth)
 */
const SIMPLE_QUERY_PATTERNS = [
  // Simple definitions/facts
  /^what is \w+\??$/i,
  /^who is \w+\??$/i,
  /^when (did|was|is) \w+\??$/i,
  /^where is \w+\??$/i,
  /^define \w+$/i,
  // Single word or short queries
  /^\w+\??$/,
  /^\w+ \w+\??$/,
  // Simple questions
  /^what does \w+ mean\??$/i,
  /^what('s| is) the (definition|meaning) of \w+\??$/i,
];

/**
 * Patterns that indicate a moderate query (2 queries)
 */
const MODERATE_QUERY_PATTERNS = [
  // Comparisons (need 2 queries for balanced view)
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bcompare\b/i,
  /\bcomparison\b/i,
  /\bdifference between\b/i,
  /\bor\b.+\bwhich\b/i,
  // Simple how-tos
  /^how (do|to|can) (i|you|we) \w+/i,
];

/**
 * Patterns that indicate a complex query (3 queries max)
 */
const COMPLEX_QUERY_PATTERNS = [
  // Multi-part questions
  /\band\b.+\band\b/i,
  // Best practices / comprehensive guides
  /\bbest practices\b/i,
  /\bcomplete guide\b/i,
  /\bcomprehensive\b/i,
  // Architecture / design questions
  /\barchitecture\b/i,
  /\bdesign patterns?\b/i,
  /\bimplementation\b/i,
  // Multiple aspects
  /\badvantages and disadvantages\b/i,
  /\bpros and cons\b/i,
];

/**
 * Analyze query complexity to determine search strategy
 *
 * @param userMessage - The user's question/prompt
 * @returns Complexity analysis with recommended search parameters
 */
export function analyzeQueryComplexity(userMessage: string): QueryAnalysisResult {
  const trimmed = userMessage.trim().toLowerCase();
  const wordCount = trimmed.split(/\s+/).length;

  // Very short queries are simple by default
  if (wordCount <= 3) {
    return {
      complexity: QueryAnalysisComplexities.SIMPLE,
      defaultSearchDepth: WebSearchDepths.BASIC,
      defaultSourceCount: 2,
      maxQueries: 1,
      reasoning: 'Short query - single focused search sufficient',
    };
  }

  // Check for simple patterns
  for (const pattern of SIMPLE_QUERY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        complexity: QueryAnalysisComplexities.SIMPLE,
        defaultSearchDepth: WebSearchDepths.BASIC,
        defaultSourceCount: 2,
        maxQueries: 1,
        reasoning: 'Simple fact/definition lookup - one query sufficient',
      };
    }
  }

  // Check for complex patterns first (they should take precedence)
  for (const pattern of COMPLEX_QUERY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        complexity: QueryAnalysisComplexities.COMPLEX,
        defaultSearchDepth: WebSearchDepths.ADVANCED,
        defaultSourceCount: 3,
        maxQueries: 3,
        reasoning: 'Complex multi-faceted query - multiple angles needed',
      };
    }
  }

  // Check for moderate patterns
  for (const pattern of MODERATE_QUERY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        complexity: QueryAnalysisComplexities.MODERATE,
        defaultSearchDepth: WebSearchDepths.ADVANCED,
        defaultSourceCount: 3,
        maxQueries: 2,
        reasoning: 'Comparison/how-to query - two search angles recommended',
      };
    }
  }

  // Long queries (>15 words) are likely complex
  if (wordCount > 15) {
    return {
      complexity: QueryAnalysisComplexities.COMPLEX,
      defaultSearchDepth: WebSearchDepths.ADVANCED,
      defaultSourceCount: 3,
      maxQueries: 3,
      reasoning: 'Long detailed query - multiple search angles recommended',
    };
  }

  // Default to moderate for medium-length queries
  return {
    complexity: QueryAnalysisComplexities.MODERATE,
    defaultSearchDepth: WebSearchDepths.ADVANCED,
    defaultSourceCount: 3,
    maxQueries: 2,
    reasoning: 'Standard query complexity - balanced search approach',
  };
}

/**
 * Build web search complexity analysis system prompt with current date
 *
 * @returns System prompt with current date context
 */
export function buildWebSearchComplexityAnalysisPrompt() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });
  const currentDay = now.getDate();

  return `You are an expert search query optimizer like ChatGPT or Claude. Your job is to analyze user questions and generate OPTIMAL KEYWORD SEARCHES that will retrieve the most relevant, current information.

📅 **TODAY'S DATE: ${currentMonth} ${currentDay}, ${currentYear}**

## KEYWORD EXTRACTION STRATEGY (Like ChatGPT/Claude)

**Your goal is to extract the BEST search keywords**, not rephrase questions. Think like a search engine expert:

1. **Extract core concepts** - Identify the main nouns, technologies, actions
2. **Remove filler words** - Strip "how do I", "what is the", "can you tell me"
3. **Add specificity** - Include version numbers, frameworks, specific terms
4. **Prioritize recent info** - Use timeRange or year when content evolves

## TIME-SENSITIVITY DETECTION

**ADD YEAR (${currentYear}) to queries when topic is TIME-SENSITIVE:**
- Technology tutorials/docs (versions change): "React hooks tutorial ${currentYear}"
- Best practices (evolve): "Docker security best practices ${currentYear}"
- Comparisons of evolving tech: "PostgreSQL vs MongoDB performance ${currentYear}"
- News, events, trends: "AI regulations ${currentYear}"
- Pricing, availability: "AWS Lambda pricing ${currentYear}"
- Library/framework updates: "Next.js 15 features ${currentYear}"

**DO NOT ADD YEAR when topic is TIMELESS:**
- Math/science fundamentals: "Pythagorean theorem proof"
- Historical facts: "when was Python created"
- Language basics: "JavaScript array methods"
- Definitions: "what is recursion"
- Universal concepts: "design patterns singleton"

**USE timeRange field for RECENCY-CRITICAL queries:**
- "day": Breaking news, outages, live events
- "week": Recent updates, current prices
- "month": New releases, recent changes
- "year": Annual trends, yearly reports

**CRITICAL: INTERPRET UPLOADED CONTENT FIRST**
When the user's message includes <file-context> or [Image Content Analysis], you MUST:
1. READ and UNDERSTAND the content/description FIRST
2. COMBINE the user's text message with the file content to understand their TRUE intent
3. Generate search queries about WHAT'S IN THE FILES, not about the user's literal words

Example:
- User says: "What is this?" with an image showing a circuit board
- Image analysis: "[Image Content Analysis] A green PCB circuit board with capacitors and an Arduino microcontroller"
- CORRECT search: "Arduino microcontroller getting started guide"
- WRONG search: "what is this" (ignoring the image content!)

**CRITICAL RULE**: Generate MULTIPLE DIFFERENT queries that explore DIFFERENT aspects - NEVER just rephrase the user's question into a single query!

## MULTI-QUERY STRATEGY

Analyze complexity and break it down (MAXIMUM 3 QUERIES):
- **1 query**: Ultra-simple fact lookups (e.g., "What year was X founded?")
- **2 queries**: Comparisons (A vs B) - search each separately for balanced view
- **3 queries**: Multi-faceted or complex topics - break into distinct components

## QUERY DECOMPOSITION RULES
**Each query MUST target a DIFFERENT aspect**
- Use 3-8 keywords (not sentences, not questions)
- Extract core concepts, remove question words
- Include year ${currentYear} ONLY for time-sensitive topics (see rules above)
- Set appropriate timeRange for recency-critical searches
- Each query should uncover UNIQUE information

## EXAMPLES

BAD - Just rephrasing:
Q: "How do I set up Docker for production?"
Bad: {"totalQueries":1,"queries":[{"query":"Docker production setup"}]}

GOOD - Multiple angles with smart date handling:
Q: "How do I set up Docker for production?"
Good: {"totalQueries":3,"queries":[
  {"query":"Docker production configuration best practices ${currentYear}","rationale":"Current best practices (evolving)","searchDepth":"advanced"},
  {"query":"Docker security hardening production ${currentYear}","rationale":"Security (evolving threats)","searchDepth":"advanced"},
  {"query":"Docker container monitoring observability","rationale":"Monitoring concepts (stable)","searchDepth":"advanced"}
]}

GOOD - Timeless topic (no year needed):
Q: "Explain the singleton design pattern"
Good: {"totalQueries":1,"queries":[
  {"query":"singleton design pattern implementation examples","rationale":"Classic pattern, timeless","searchDepth":"basic","complexity":"basic"}
]}

GOOD - Mixed time-sensitivity:
Q: "Best database for a startup in 2026"
Good: {"totalQueries":3,"queries":[
  {"query":"best database startups ${currentYear}","rationale":"Current recommendations","searchDepth":"advanced","timeRange":"year"},
  {"query":"PostgreSQL vs MongoDB startup comparison ${currentYear}","rationale":"Current comparison","searchDepth":"advanced"},
  {"query":"database scaling strategies startups","rationale":"Timeless architecture concepts","searchDepth":"advanced"}
]}

GOOD - News/current events:
Q: "Latest developments in AI regulation"
Good: {"totalQueries":2,"queries":[
  {"query":"AI regulation news ${currentYear}","rationale":"Current developments","searchDepth":"advanced","timeRange":"month","topic":"news"},
  {"query":"AI governance policy updates ${currentMonth} ${currentYear}","rationale":"Most recent policy","searchDepth":"advanced","timeRange":"week","topic":"news"}
]}

## OUTPUT REQUIREMENTS

**SEARCH DEPTH** (MAX 3 sources per query):
- "basic": Quick facts, definitions - 1-2 sources
- "advanced": How-tos, tutorials, comparisons - 3 sources (MAX)

**COMPLEXITY LEVELS** (lowercase):
- "basic": Simple facts - 1-2 sources, "basic" depth
- "moderate": How-tos, guides - 2-3 sources
- "deep": Research, analysis - 3 sources (MAX), "advanced" depth

**IMAGE DECISIONS**:
- includeImages: true for visual queries (UI/UX, design, diagrams, architecture)
- includeImageDescriptions: true if images need AI analysis

Return ONLY valid JSON. Extract optimal keywords and strategically decide when to add dates!`;
}

/**
 * Web search query generation user prompt template
 *
 * @param userMessage - The user's question to search for
 * @returns Formatted prompt for query generation
 */
export function buildWebSearchQueryPrompt(userMessage: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });

  // Check if message contains file context
  const hasFileContext = userMessage.includes('<file-context>') || userMessage.includes('[Image Content Analysis]');

  const contextInstruction = hasFileContext
    ? `
**IMPORTANT: FILE/IMAGE CONTEXT DETECTED**
The user has uploaded content. You MUST:
1. ANALYZE the content in <file-context> or [Image Content Analysis] tags
2. UNDERSTAND what the content shows/contains
3. Generate searches about THE CONTENT, informed by the user's question
4. The user's short message (e.g., "what is this?") is asking about the FILE CONTENT

`
    : '';

  return `${contextInstruction}USER INPUT: "${userMessage}"

**TODAY: ${currentMonth} ${currentYear}**

**YOUR TASK**: ${hasFileContext ? 'Interpret the uploaded content AND the user\'s question together, then' : ''} Extract OPTIMAL SEARCH KEYWORDS that will retrieve the most relevant results. Think like ChatGPT or Claude search.

**KEYWORD EXTRACTION** (Not rephrasing!):
- Extract core nouns, technologies, actions
- Remove question words ("how do I", "what is")
- Add specificity (versions, frameworks, specific terms)
- Use 3-8 keywords per query

**DATE HANDLING** (Be smart about this):
- ADD ${currentYear} for: tutorials, best practices, comparisons, evolving tech, news, pricing
- SKIP year for: math/science fundamentals, definitions, historical facts, timeless concepts
- Use timeRange ("day"/"week"/"month"/"year") for recency-critical queries

**REQUIRED JSON STRUCTURE**:
{
  "totalQueries": <1-3 based on complexity - MAXIMUM 3>,
  "analysisRationale": "<explain your keyword extraction strategy and time-sensitivity decisions>",
  "queries": [<array of DISTINCT query objects - MAX 3>]
}

**EACH QUERY OBJECT MUST HAVE**:
- query: 3-8 keywords targeting ONE specific aspect (add ${currentYear} ONLY if time-sensitive)
- rationale: What UNIQUE aspect this explores + why you did/didn't add year
- searchDepth: "basic" or "advanced"
- complexity: "basic" | "moderate" | "deep" (lowercase)
- sourceCount: Number of sources (1-3, based on complexity)

**OPTIONAL FIELDS** (include when relevant):
- topic: "general" | "news" | "finance" | "health" | "scientific" | "travel"
- timeRange: "day" | "week" | "month" | "year" (for recency-critical)
- needsAnswer: "basic" | "advanced" (if synthesis needed)
- includeImages: true (for visual queries)
- includeImageDescriptions: true (if images need AI analysis)

**EXAMPLES**:

Q: "What is GraphQL?"
Timeless definition, no year needed:
{"totalQueries":1,"analysisRationale":"Basic definition - timeless concept","queries":[{"query":"GraphQL API query language overview","rationale":"Fundamental concept, no year needed","searchDepth":"basic","complexity":"basic","sourceCount":2}]}

Q: "Best React state management library"
Evolving landscape, add year:
{"totalQueries":2,"analysisRationale":"Library recommendations evolve - need current info","queries":[
  {"query":"React state management comparison ${currentYear}","rationale":"Current library landscape","searchDepth":"advanced","complexity":"moderate","sourceCount":3,"timeRange":"year"},
  {"query":"Zustand Redux Jotai React comparison","rationale":"Specific popular options","searchDepth":"advanced","complexity":"moderate","sourceCount":3}
]}

Q: "Explain the Pythagorean theorem"
Timeless math, no year:
{"totalQueries":1,"analysisRationale":"Mathematical theorem - completely timeless","queries":[{"query":"Pythagorean theorem proof explanation examples","rationale":"Timeless math concept","searchDepth":"basic","complexity":"basic","sourceCount":2}]}

Q: "Latest Next.js 15 features"
Very time-sensitive, add year and timeRange:
{"totalQueries":2,"analysisRationale":"New release - very time-sensitive","queries":[
  {"query":"Next.js 15 new features ${currentYear}","rationale":"Latest release info","searchDepth":"advanced","complexity":"moderate","sourceCount":3,"timeRange":"month"},
  {"query":"Next.js 15 migration guide ${currentYear}","rationale":"Current upgrade path","searchDepth":"advanced","complexity":"moderate","sourceCount":3,"timeRange":"month"}
]}

**REMEMBER**: Extract optimal keywords, decide intelligently about dates based on time-sensitivity!

Return ONLY valid JSON, no other text.`;
}

// ============================================================================
// Moderator format templates
// ============================================================================

export { getModeratorFormatSection, MODERATOR_FORMAT_TEMPLATES } from './moderator-formats';

// ============================================================================
// Attachment Context Prompt (Clean XML Format)
// ============================================================================

/**
 * Build formatted prompt for thread attachments
 *
 * Following AI SDK v6 patterns: Uses clean XML-style formatting with citation IDs.
 * AI can reference files using [att_xxxxx] markers for inline citations.
 *
 * @param attachments - Attachment metadata with citation IDs
 * @returns Formatted prompt section with file contents and citation instructions
 */
export function buildAttachmentCitationPrompt(attachments: AttachmentCitationInfo[]) {
  if (attachments.length === 0) {
    return '';
  }

  const fileEntries = attachments.map((att, index) => {
    const sizeKB = (att.fileSize / 1024).toFixed(1);

    if (att.textContent) {
      // Text/code files - include content with citation ID
      return `<file id="${att.citationId}" index="${index + 1}" name="${att.filename}" type="${att.mimeType}" size="${sizeKB}KB">
${att.textContent}
</file>`;
    } else {
      // Binary files (images, PDFs) - metadata only, content passed as multimodal
      return `<file id="${att.citationId}" index="${index + 1}" name="${att.filename}" type="${att.mimeType}" size="${sizeKB}KB">
[Visual/document content provided as multimodal input - cite this file when referencing its content]
</file>`;
    }
  });

  // Build citation ID list with emphasis
  const citationList = attachments
    .map((att, i) => `  ${i + 1}. "${att.filename}" → cite as [${att.citationId}]`)
    .join('\n');

  // Strong citation requirements with specific excerpt instructions
  return `

## MANDATORY: File Citation Requirements

**YOU MUST CITE uploaded files when using their content. This is NOT optional.**

### Available Files to Cite:
${citationList}

### Citation Rules (MUST FOLLOW):

1. **EVERY claim from a file needs a citation**
   When you state ANY fact, name, date, number, or detail from a file, add the citation marker immediately after.

2. **Use the EXACT citation format: [att_xxxxxxxx]**
   Do NOT abbreviate, modify, or skip the citation ID. Copy it exactly as shown above.

3. **Quote or paraphrase specific content**
   Don't just cite - show WHAT you're citing by quoting or describing the specific part.

### Correct Citation Examples:

GOOD (shows specific content + citation):
- "According to the document, the user's first workplace was 'Company ABC' [${attachments[0]?.citationId || 'att_example'}]."
- "The resume states: 'Worked at XYZ Corp from 2018-2020' [${attachments[0]?.citationId || 'att_example'}]."
- "The file shows the configuration uses port 3000 [${attachments[0]?.citationId || 'att_example'}]."

BAD (no citation or no specific content):
- "The first workplace was Company ABC." -- MISSING CITATION
- "Based on the document, they worked somewhere." -- TOO VAGUE
- "The file mentions some experience." -- NOT SPECIFIC

### For PDFs and Images:
When referencing visual content (PDFs, images), you MUST still cite:
- "The PDF shows the user worked at Company X from 2017-2020 [${attachments[0]?.citationId || 'att_example'}]."
- "Looking at the resume image, the education section lists MIT [${attachments[0]?.citationId || 'att_example'}]."

<uploaded-files>
${fileEntries.join('\n\n')}
</uploaded-files>

---
**Remember: NO citation = INCOMPLETE RESPONSE. Always cite your sources from the uploaded files.**`;
}
