<!-- version: 1.0 | updated: 2026-04-08 | tested: no -->

# Weakness Analysis Prompt

## Task

Given a user's recent attempt data, identify weakness patterns and summarize them into an actionable focus plan.

## Input

- **Recent Attempts** — `{{ recentAttempts }}` (JSON array with status, pattern, solveTime, hintsUsed)
- **Topic Averages** — `{{ topicAverages }}` (JSON: topic → avg solve time)
- **Flagged Topics** — `{{ flaggedTopics }}` (topics auto-flagged by detection engine)

## Detection Thresholds (already applied)

- `failureRate > 40% AND attempts > 3` → marked as **failing**
- `solveTime > avgSolveTime * 1.5` → marked as **slow**
- `hintsUsed > 2 on same topic` → marked as **confused**

## Output Format (JSON)

```json
{
  "weaknesses": [
    {
      "topic": "Dynamic Programming",
      "severity": 3,
      "rootCause": "User struggles with subproblem identification, not memoization",
      "focusPlan": [
        "Review 3 classic DP patterns: Knapsack, LIS, LCS",
        "Solve 2 easy DP problems to rebuild confidence"
      ],
      "estimatedRecoveryDays": 5
    }
  ],
  "summary": "User is solid on Arrays/Strings but hits a wall on DP and Graphs."
}
```

## Rules

1. **Root cause, not symptom** — don't just say "failing at DP"; say *why*
2. **Severity 1-3** — 1 = minor gap, 3 = blocking
3. **Actionable focus plans** — each item must be something the user can *do*, not vague advice
4. **Honest summary** — no cheerleading; tell the user what's actually going on
