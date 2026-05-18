# Multi-Agent Debate (MAD) — Research Reference

Internal reference doc for `/multi-agent-debate` landing page copy. Not published.

## Key Papers

### Du et al. (2023) — "Improving Factuality and Reasoning in Language Models through Multiagent Debate"
- **Finding**: Multiple LLM agents debating improves factual accuracy and mathematical reasoning
- **Mechanism**: Agents generate responses, share them, then refine based on others' arguments
- **Impact**: Foundational paper establishing MAD as a viable approach

### Khan et al. (ICML 2024, Best Paper) — "Debating with More Persuasive LLMs Leads to More Truthful Answers"
- **Finding**: When a less capable model judges a debate between more capable models, accuracy improves by ~28 percentage points over non-debate baselines
- **Key insight**: Debate as a scalable oversight mechanism — you don't need a superhuman judge
- **DebateKit connection**: This is exactly our moderator synthesis pattern

### Li et al. (NeurIPS 2024) — "More Agents Is All You Need"
- **Finding**: Scaling the number of LLM agents improves performance on diverse tasks
- **Mechanism**: Simple majority voting across agents, with diminishing but consistent returns
- **DebateKit connection**: We go beyond voting with structured deliberation modes

### Wang et al. (ICLR 2025) — "Mixture-of-Agents Surpasses GPT-4 Omni"
- **Finding**: Open-source models collaborating via MoA outperform GPT-4o on AlpacaEval 2.0
- **Key insight**: Collective intelligence of diverse models > any single model
- **DebateKit connection**: We implement this with heterogeneous model councils

## Accuracy Improvements

- **+28 percentage points** accuracy improvement via debate (Khan et al., ICML 2024)
- **70% → 95%** factual accuracy in certain benchmarks (MIT research)
- **Open-source MoA > GPT-4o** on AlpacaEval 2.0 (Wang et al., ICLR 2025)

## Why Debate Works (Mechanisms)

1. **Diverse training data**: Different models trained on different data catch different blind spots
2. **Adversarial pressure**: When models must defend positions against counterarguments, weak reasoning collapses
3. **Iterative refinement**: Multi-round debate allows progressive convergence on stronger answers
4. **Error decorrelation**: Independent model errors are uncorrelated — majority/synthesis filters them

## Related Concepts

- **Mixture of Agents (MoA)**: Layered approach where models build on each other's outputs
- **LLM Council**: Query multiple models, aggregate responses
- **Chain-of-Thought vs Debate**: CoT is single-model reasoning; debate is multi-model adversarial reasoning
- **Ensemble methods**: Traditional ML ensembles vote; LLM debate argues and synthesizes

## Research Gaps DebateKit Addresses

1. Most papers use homogeneous agents (same model). DebateKit uses heterogeneous models.
2. Research focuses on benchmark tasks. DebateKit applies to real-world decisions.
3. Papers show debate works in controlled settings. DebateKit makes it accessible in production.
4. Academic frameworks lack user-facing tooling. DebateKit provides web UI + MCP server.

## Target Search Intent

People searching "multi agent debate" are:
- Researchers wanting to use MAD in practice
- Engineers evaluating multi-model approaches
- People who read the papers and want a tool
- Practitioners looking for "mixture of agents" implementations
