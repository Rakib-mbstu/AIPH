/** Returns a Tailwind bg-* class for a 0–100 mastery/score value. */
export function scoreBarColor(value: number): string {
  if (value >= 80) return 'bg-emerald-500'
  if (value >= 50) return 'bg-indigo-500'
  if (value > 0)   return 'bg-amber-500'
  return 'bg-gray-200'
}

/** Returns a Tailwind text-* class for a 0–100 score. */
export function scoreTextColor(value: number): string {
  if (value >= 80) return 'text-emerald-600'
  if (value >= 50) return 'text-indigo-600'
  return 'text-amber-600'
}

/** Returns combined bg-* + border-* classes for a score badge. */
export function scoreBadgeClass(value: number): string {
  if (value >= 80) return 'bg-emerald-50 border-emerald-200'
  if (value >= 50) return 'bg-indigo-50 border-indigo-200'
  return 'bg-amber-50 border-amber-200'
}
