<!-- version: 1.0 | updated: 2026-04-08 | tested: no -->

# Adaptive Roadmap Generator

## Task

Generate a personalized DSA learning roadmap as a topic graph based on the user's profile, mastery data, and detected weak areas.

## Input

- **Experience Level** — `{{ experienceLevel }}` (beginner | intermediate | advanced)
- **Target Role** — `{{ targetRole }}` (frontend | backend | fullstack)
- **Timeline** — `{{ timelineDays }}` days until interview
- **Current Mastery** — `{{ masteryScores }}` (JSON map of topic → 0-100)
- **Weak Areas** — `{{ weakAreas }}` (comma-separated list)
- **Solved Patterns** — `{{ solvedPatterns }}`

## Output Format (JSON)

```json
{
  "nodes": [
    {
      "topic": "Arrays",
      "priority": 1,
      "estimatedHours": 4,
      "prerequisites": [],
      "recommendedPatterns": ["Two Pointers", "Sliding Window"],
      "reason": "Foundation for most problems; user shows low mastery"
    }
  ],
  "focusPlan": {
    "week1": ["Arrays", "Hash Maps"],
    "week2": ["Trees", "DFS"],
    "dailyProblemTarget": 3
  }
}
```

## Rules

1. **Respect the timeline** — fewer days means tighter, weakness-focused plans
2. **Weak areas come first** — prioritize topics with `masteryScore < 40`
3. **Build on strengths** — don't reorder topics the user has already mastered (> 80)
4. **Respect prerequisites** — Arrays before Sliding Window, Trees before DFS, etc.
5. **Role-aware** — backend roles need more system design; frontend needs less graph theory
