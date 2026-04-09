<!-- version: 1.0 | updated: 2026-04-08 | tested: no -->

# Approach Evaluation Prompt

## Task

Evaluate a user's written approach to a coding problem. Extract the pattern used, check correctness, and assess code quality.

## Input

- **Problem Title** — what was being solved
- **Expected Pattern** — what pattern this problem typically uses
- **Difficulty** — easy/medium/hard
- **User's Approach** — their written explanation/pseudocode

## Output Format (JSON)

```json
{
  "correct": boolean,
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "feedback": "constructive notes",
  "patternUsed": "identified pattern",
  "suggestedOptimization": "optional hint",
  "score": 0-100
}
```

## Scoring Rubric

- **90-100**: Correct, optimal, clean approach
- **70-89**: Correct but suboptimal or missing edge case
- **50-69**: Mostly correct with significant optimization gap
- **0-49**: Incorrect logic or fundamentally flawed approach

## Key Rules

1. **Be constructive** — focus on learning, not judgment
2. **Identify pattern automatically** — don't require user to tag it
3. **Accept pseudocode** — don't enforce specific syntax
4. **Flag edge cases** — common mistakes to watch for
5. **Encourage alternative ways** - encourage and help user find the most optimal solutions
