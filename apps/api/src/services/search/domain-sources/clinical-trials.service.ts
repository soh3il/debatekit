/**
 * ClinicalTrials.gov v2 Data Source Service
 *
 * Fetches active clinical trial registrations from the ClinicalTrials.gov API v2.
 * API: https://clinicaltrials.gov/data-api/api (free, no auth, ~50 req/min)
 *
 * Flow:
 * 1. Extract condition/intervention terms from user message
 * 2. Search for matching studies
 * 3. Format trial details as markdown context with citations
 */

import { z } from 'zod';

import type { CitableSource } from '@/types/citations';

import type { DataSourceResult } from './registry';

const CT_BASE = 'https://clinicaltrials.gov/api/v2';

const ClinicalTrialStudySchema = z.object({
  protocolSection: z.object({
    armsInterventionsModule: z.object({
      interventions: z.array(z.object({
        name: z.string(),
        type: z.string(),
      })).optional(),
    }).optional(),
    conditionsModule: z.object({
      conditions: z.array(z.string()).optional(),
    }).optional(),
    contactsLocationsModule: z.object({
      locations: z.array(z.object({
        city: z.string(),
        country: z.string(),
        facility: z.string(),
        state: z.string().optional(),
      })).optional(),
    }).optional(),
    descriptionModule: z.object({
      briefSummary: z.string().optional(),
    }).optional(),
    designModule: z.object({
      designInfo: z.object({
        allocation: z.string().optional(),
        interventionModel: z.string().optional(),
        maskingInfo: z.object({ masking: z.string().optional() }).optional(),
        primaryPurpose: z.string().optional(),
      }).optional(),
      enrollmentInfo: z.object({ count: z.number(), type: z.string() }).optional(),
      phases: z.array(z.string()).optional(),
      studyType: z.string().optional(),
    }).optional(),
    identificationModule: z.object({
      briefTitle: z.string(),
      nctId: z.string(),
      officialTitle: z.string().optional(),
      organization: z.object({ fullName: z.string() }).optional(),
    }),
    statusModule: z.object({
      completionDateStruct: z.object({ date: z.string() }).optional(),
      overallStatus: z.string(),
      startDateStruct: z.object({ date: z.string() }).optional(),
    }),
  }),
});
const ClinicalTrialsSearchResultSchema = z.object({
  studies: z.array(ClinicalTrialStudySchema),
  totalCount: z.number(),
});
type ClinicalTrialsSearchResult = z.infer<typeof ClinicalTrialsSearchResultSchema>;

/**
 * Extract clinical/medical terms from user message for trial search.
 */
function extractTrialQuery(userMessage: string): string {
  const cleaned = userMessage
    .replace(/(?:clinical trials?|studies|trials?|what (?:is|are)|tell me about|any (?:new|active|recruiting)|treatments? for|therapy for|drugs? for)\s*/gi, '')
    .replace(/[?.!,]/g, '')
    .trim();
  return cleaned || userMessage.slice(0, 200);
}

/**
 * Search ClinicalTrials.gov for studies matching the query.
 */
async function searchTrials(query: string, maxResults = 8): Promise<ClinicalTrialsSearchResult | null> {
  const params = new URLSearchParams({
    'format': 'json',
    'pageSize': String(maxResults),
    'query.term': query,
    'sort': 'LastUpdatePostDate:desc',
  });

  try {
    const res = await fetch(`${CT_BASE}/studies?${params}`);
    if (!res.ok) {
      return null;
    }
    return ClinicalTrialsSearchResultSchema.parse(await res.json());
  } catch {
    return null;
  }
}

/**
 * Format study phase for display.
 */
function formatPhases(phases?: string[]): string {
  if (!phases?.length) {
    return 'N/A';
  }
  return phases.join(', ').replace(/PHASE/gi, 'Phase');
}

/**
 * Format study status with color-coding hint.
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE_NOT_RECRUITING: 'Active (not recruiting)',
    COMPLETED: 'Completed',
    ENROLLING_BY_INVITATION: 'Enrolling by invitation',
    NOT_YET_RECRUITING: 'Not yet recruiting',
    RECRUITING: 'Recruiting',
    SUSPENDED: 'Suspended',
    TERMINATED: 'Terminated',
    WITHDRAWN: 'Withdrawn',
  };
  return statusMap[status] ?? status;
}

/**
 * Main fetch function for ClinicalTrials.gov data source.
 */
export async function fetchClinicalTrialsData(
  userMessage: string,
  _config?: Record<string, string>,
  _env?: import('./registry').DomainSourceEnv,
): Promise<DataSourceResult> {
  const query = extractTrialQuery(userMessage);
  const searchResult = await searchTrials(query);

  if (!searchResult?.studies?.length) {
    return {
      formattedPrompt: `\n\n## ClinicalTrials.gov\nNo clinical trials found for "${query}". Try specific condition names, drug names, or NCT IDs.`,
    };
  }

  const citableSources: CitableSource[] = [];
  const trialEntries = searchResult.studies.map((study) => {
    const id = study.protocolSection.identificationModule;
    const status = study.protocolSection.statusModule;
    const design = study.protocolSection.designModule;
    const conditions = study.protocolSection.conditionsModule?.conditions ?? [];
    const interventions = study.protocolSection.armsInterventionsModule?.interventions ?? [];
    const nctId = id.nctId;
    const trialUrl = `https://clinicaltrials.gov/study/${nctId}`;
    const citationId = `dom_ct_${nctId.toLowerCase()}`;

    citableSources.push({
      content: `${id.briefTitle}. Status: ${formatStatus(status.overallStatus)}. ${conditions.join(', ')}`,
      id: citationId,
      metadata: {
        description: `Clinical Trial ${nctId} — ${formatStatus(status.overallStatus)}, ${formatPhases(design?.phases)}`,
        domain: 'clinicaltrials.gov',
        query,
        url: trialUrl,
      },
      sourceId: `ct-${nctId}`,
      title: `ClinicalTrials.gov: ${nctId}`,
      type: 'domain',
    });

    const interventionList = interventions.length > 0
      ? interventions.map(i => `${i.type}: ${i.name}`).join('; ')
      : 'Not specified';

    const enrollment = design?.enrollmentInfo
      ? `${design.enrollmentInfo.count} (${design.enrollmentInfo.type})`
      : 'N/A';

    const sponsor = id.organization?.fullName ?? 'N/A';
    const startDate = status.startDateStruct?.date ?? 'N/A';
    const completionDate = status.completionDateStruct?.date ?? 'N/A';

    const designDetails: string[] = [];
    if (design?.designInfo?.allocation) {
      designDetails.push(design.designInfo.allocation);
    }
    if (design?.designInfo?.maskingInfo?.masking) {
      designDetails.push(design.designInfo.maskingInfo.masking);
    }
    if (design?.designInfo?.primaryPurpose) {
      designDetails.push(design.designInfo.primaryPurpose);
    }

    return `[${citationId}] **${id.briefTitle}** (${nctId})
Status: ${formatStatus(status.overallStatus)} | Phase: ${formatPhases(design?.phases)} | Type: ${design?.studyType ?? 'N/A'}
Conditions: ${conditions.join(', ') || 'N/A'}
Interventions: ${interventionList}
Enrollment: ${enrollment} | Sponsor: ${sponsor}
Dates: ${startDate} → ${completionDate}${designDetails.length > 0 ? `\nDesign: ${designDetails.join(', ')}` : ''}
URL: ${trialUrl}`;
  });

  const totalCount = searchResult.totalCount;
  const formattedPrompt = `

## ClinicalTrials.gov: Active Trials
### Search: "${query}" (${totalCount} total matches)

${trialEntries.join('\n\n')}

*${searchResult.studies.length} of ${totalCount} trials shown from ClinicalTrials.gov (${new Date().toISOString().split('T')[0]}). Cite using [ct_NCTID] identifiers. For informational purposes only — consult healthcare providers for treatment decisions.*`;

  return { citableSources, formattedPrompt };
}
