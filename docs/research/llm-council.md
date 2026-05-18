# LLM Council — Research Reference

Internal reference doc for `/llm-council` landing page copy. Not published.

## The Concept

**Origin**: Andrej Karpathy (2024) proposed the "LLM council" idea — query multiple LLMs on the same question, then aggregate or deliberate over their responses. The intuition: no single model is best at everything, and collective reasoning surfaces blind spots.

**Key insight**: Different LLMs have different training data, RLHF policies, and reasoning patterns. When they disagree, that disagreement is signal. When they agree, confidence is warranted.

## Existing "Council" Tools

| Tool | Approach | Limitation |
|------|----------|------------|
| **Karpathy's concept** | Query N models, pick best or vote | No structured deliberation — parallel, not sequential |
| **Council AI** | Multi-agent framework | Developer tool, not production UI |
| **CouncilMind** | Research prototype | Academic, not productized |
| **LM Council** | Benchmark evaluation framework | Evaluation-focused, not deliberation |
| **ChatHub / TypingMind** | Side-by-side model comparison | Display-only — models don't read/challenge each other |

## How DebateKit Differs

1. **Sequential deliberation**: Each model reads and responds to previous outputs (not parallel display)
2. **Structured modes**: Debating, Analyzing, Brainstorming, Problem Solving — each shapes the deliberation differently
3. **Role-based personas**: Assign specific expertise (Security Reviewer, Performance Engineer, etc.)
4. **Moderator synthesis**: Council Moderator reads all arguments and produces structured verdict
5. **MCP integration**: Use via Claude Code, Cursor, VS Code — not just web UI
6. **Research-validated**: Built on MAD framework (ICML 2024 Best Paper), MoA (ICLR 2025)

## Target Search Intent

People searching "llm council" already understand multi-model value. They want:
- A production tool (not a paper or concept)
- Structured deliberation (not side-by-side display)
- Something they can use today

## Key Differentiator Copy Points

- "Karpathy's LLM council concept, built for production"
- "Models don't just answer in parallel — they read, challenge, and build on each other"
- "From concept to tool: structured deliberation validated at ICML 2024"
- "The council approach works. We made it usable."
