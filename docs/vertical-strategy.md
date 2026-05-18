# Vertical Strategy & Roadmap

## Why Verticals

Multi-LLM has structural advantage in domains requiring second opinions and advisory councils:
- **M&A Due Diligence**: Multiple advisors (financial, legal, strategic) analyzing deals
- **Investment Committees**: Bull/bear case analysis, risk assessment from different lenses
- **Clinical Boards**: Multi-specialist diagnostic reasoning, treatment recommendations
- **Legal Review**: Contract analysis from compliance, IP, litigation perspectives

Single-LLM chatbots commoditize. Multi-LLM councils add value where diverse expert perspectives matter.

## Vertical Analysis

| Vertical | Pain Sharpness | Buyer Accessibility | Competition | Free Data Sources |
|----------|---------------|--------------------| ------------|------------------|
| M&A Advisory | High ($100K+ per deal) | PE/IB professionals | Low (no multi-LLM) | SEC EDGAR |
| Investment Analysis | High (bad decisions = $M losses) | VCs, PEs, analysts | Medium | SEC EDGAR |
| Healthcare/Clinical | Very High (patient outcomes) | Hospitals, clinicians | Low | PubMed, OpenFDA |
| Legal Review | High ($500/hr saved) | Law firms, GCs | Medium | Court records |
| Compliance | Medium | Compliance officers | Low | Regulatory feeds |

## Decision: M&A + Investment + Healthcare First

1. **M&A & Investment** share SEC EDGAR data source — build once, use twice
2. **Healthcare** has PubMed (free, comprehensive) — immediate differentiation
3. All three have clear multi-expert value prop (councils, not chatbots)

## Architecture: Presets as Composable Vertical Configs

```
Preset = {
  models + roles + systemPrompts + dataSources[] + moderatorFormat + mode + searchEnabled
}
```

When preset selected → `dataSources` and `moderatorFormat` stored on thread metadata.
When round executes → backend fetches domain APIs in parallel, customizes moderator output.

## Data Source Landscape

### Free (MVP)
- **SEC EDGAR** (`efts.sec.gov/LATEST/`): Company filings, XBRL financials, 10 req/sec
- **PubMed** (`eutils.ncbi.nlm.nih.gov`): Medical literature, abstracts, 3 req/sec (10 with API key)

### Paid (Post-MVP)
- Crunchbase: Private company data (enterprise sales required)
- Alpha Vantage: Stock/financial data (25 req/day free — too limited)
- PitchBook: Deal data (enterprise only)

## Model Landscape

No domain-specific models on OpenRouter. Differentiation comes from:
1. **What data flows into models** (domain APIs → system prompt context)
2. **How output is structured** (custom moderator templates per vertical)
3. **Domain system prompts** (role-specific expertise framing)

## Roadmap

### Phase 1: MVP (Current)
- 3 vertical presets: M&A Advisory, Investment Committee, Clinical Board
- SEC EDGAR + PubMed data source integration
- Custom moderator output formats (Deal Brief, Investment Memo, Clinical Summary)
- Domain-specific system prompts per participant role

### Phase 2: Growth
- Landing pages per vertical (SEO + conversion)
- Crunchbase integration for private company data
- Custom preset builder with data source selection
- Vertical-specific onboarding flows

### Phase 3: Monetization
- Vertical-specific pricing (per-deal, per-analysis)
- Enterprise/team features
- Usage-based billing for data source API calls
- White-label vertical deployments

### Phase 4: Moat
- Fine-tuned models if domain data improves sufficiently
- Additional verticals (Legal, Compliance, Academic Research)
- Proprietary data partnerships
- Vertical-specific RAG pipelines
