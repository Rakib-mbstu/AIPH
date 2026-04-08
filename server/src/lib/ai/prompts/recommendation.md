<!-- version: 1.0 | updated: 2026-04-08 | tested: no -->

# Problem Recommendation Engine

## Task

Recommend the next 3-5 problems for the user to attempt based on their current mastery, weak areas, and roadmap position.

## Input

- **Current Topic** — `{{ currentTopic }}`
- **Weak Areas** — `{{ weakAreas }}`
- **Pattern Mastery** — `{{ patternMastery }}` (JSON: pattern → score)
- **Recently Solved** — `{{ recentProblems }}` (avoid re-suggesting)
- **Available Problems** — `{{ problemPool }}` (JSON array of candidate problems)

## Output Format (JSON)

```json
{
  "recommendations": [
    {
      "problemId": "two-sum",
      "reason": "Reinforces Hash Map pattern (weak area)",
      "difficulty": "easy",
      "estimatedMinutes": 20,
      "priority": 1
    }
  ]
}
```

## Selection Rules

1. **Target weak areas** — 60% of recommendations should address weaknesses
2. **Progressive difficulty** — mix easy/medium, avoid hard if mastery < 50
3. **Pattern variety** — don't recommend 5 problems of the same pattern
4. **Avoid repetition** — never recommend a recently solved problem
5. **Cap at 5 recommendations** — quality over quantity

## Why Each Recommendation Needs a Reason

The user sees the `reason` field in the UI. It must clearly explain *why this problem, why now* — not generic filler like "good practice."
