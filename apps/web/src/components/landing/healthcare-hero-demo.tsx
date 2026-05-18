import { ModelIds } from '@debatekit/shared';

import type { HeroDemoData } from './hero-demo-base';
import { HeroDemoBase } from './hero-demo-base';

const DATA: HeroDemoData = {
  composerModels: [
    ModelIds.ANTHROPIC_CLAUDE_SONNET_4,
    ModelIds.OPENAI_GPT_4_1,
    ModelIds.GOOGLE_GEMINI_2_5_PRO,
    ModelIds.X_AI_GROK_4,
  ],
  moderator: `**Consensus:** The council recommends **urgent hematology-oncology workup** \u2014 all four models converge on hematologic malignancy as the leading concern. **Top differential:** Lymphoma (Claude, Grok \u2014 B symptoms + elevated LDH, 73% PPV per Lancet meta-analysis) and Multiple Myeloma (GPT \u2014 back pain + anemia + age). **Key agreements:** (1) Immediate labs: CBC with differential, peripheral smear, SPEP/UPEP, serum free light chains, beta-2 microglobulin, reticulocyte count (GPT), (2) PET-CT preferred over conventional CT for lymphoma evaluation (Grok), (3) Hold NSAIDs immediately \u2014 renal risk in myeloma (Gemini), (4) Complete medication reconciliation before any biopsy (Gemini). **Unresolved:** Autoimmune hemolytic anemia as alternative diagnosis (Claude) \u2014 Coombs test will differentiate. **Next step:** Stat hematology referral with expedited workup.`,
  participants: [
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Primary Care Physician' },
    { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Specialist Consultant' },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Pharmacist' },
    { modelId: ModelIds.X_AI_GROK_4, role: 'Evidence Reviewer' },
  ],
  promptText: '55-year-old male, 3 weeks of progressive fatigue, unexplained weight loss, night sweats, and new-onset lower back pain...',
  responses: [
    `The triad of B symptoms \u2014 fatigue, weight loss, night sweats \u2014 with elevated LDH and low haptoglobin immediately raises concern for hematologic malignancy. The back pain unresponsive to NSAIDs suggests possible bone involvement. My top differential: lymphoma (most likely given B symptoms and LDH), multiple myeloma (back pain, anemia, age), or metastatic solid tumor with bone mets. But I don't want to anchor on malignancy \u2014 the hemolytic markers (low haptoglobin, elevated LDH) could also point to autoimmune hemolytic anemia with a paraneoplastic trigger. **Start with CBC with differential, peripheral smear, SPEP/UPEP, and CT chest/abdomen/pelvis.**`,
    `Claude's differential is solid, but I want to push on the myeloma angle harder. The combination of back pain, anemia, and elevated LDH in a 55-year-old male is textbook myeloma until proven otherwise. Before the CT, I'd add a skeletal survey or low-dose whole-body CT \u2014 lytic lesions would change the workup entirely. Also, check serum free light chains and beta-2 microglobulin alongside the SPEP. If this is myeloma, we need staging markers upfront. **I'd also add a reticulocyte count \u2014 if it's elevated with low haptoglobin, we're looking at active hemolysis, not just marrow failure.**`,
    `Before we finalize the workup, I need to flag a medication consideration. If this patient is on any anticoagulants or antiplatelet agents, the bone marrow biopsy that's likely coming carries bleeding risk that needs managed. More importantly \u2014 GPT raised myeloma, and if confirmed, the treatment protocols (lenalidomide, bortezomib, dexamethasone) have significant drug-drug interaction profiles. We should get a complete medication reconciliation now, not after diagnosis. Also, **NSAIDs should be held if myeloma is suspected \u2014 renal function in myeloma patients is often compromised, and NSAIDs can precipitate acute kidney injury.**`,
    `I want to add evidence context to the discussion. A 2024 Lancet Hematology meta-analysis found that elevated LDH combined with B symptoms has a 73% positive predictive value for lymphoma in adults over 50. However, Gemini's point about holding NSAIDs is critical \u2014 a BMJ Best Practice review notes that 20-40% of newly diagnosed myeloma patients present with renal impairment, and NSAID use is a known precipitating factor. Claude's suggestion of CT CAP is guideline-concordant per NCCN, but **I'd recommend PET-CT over conventional CT if lymphoma is the leading differential \u2014 sensitivity for nodal disease is 90%+ vs 60% for conventional CT.**`,
  ],
  userMessage: '55-year-old male presenting with 3 weeks of progressive fatigue, 8kg unexplained weight loss over 2 months, drenching night sweats, and new-onset lower back pain unresponsive to NSAIDs. Labs show elevated LDH, low haptoglobin, and mild anemia. What\'s the differential and workup plan?',
};

export function HealthcareHeroDemo() {
  return <HeroDemoBase data={DATA} />;
}
