import posthog from 'posthog-js'

/**
 * Analytics wrapper around PostHog (Cycle F).
 *
 * The whole module is a no-op when `VITE_POSTHOG_KEY` is missing — that
 * way local dev, CI, and the auth-bypass smoke-test mode all keep working
 * without PostHog credentials. Every public function checks `enabled` first
 * so callers don't have to gate themselves.
 *
 * What we actually track in Phase 3:
 *   - app_initialized       (once on boot)
 *   - user_identified       (after onboarding completes)
 *   - roadmap_viewed        (RoadmapPage mount)
 *   - tracker_viewed        (TrackerPage mount)
 *
 * That's enough signal for a funnel: did the user sign in → onboard → reach
 * the tracker → come back tomorrow. Granular event capture (clicks, hovers)
 * lands when there's UI worth measuring.
 */

const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const apiHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'

let enabled = false

export function initAnalytics(): void {
  if (!apiKey) {
    // Silent no-op in dev / CI / smoke-test mode.
    return
  }
  if (enabled) return // idempotent — StrictMode double-mount safe

  posthog.init(apiKey, {
    api_host: apiHost,
    capture_pageview: false, // we'll fire explicit page events from React
    persistence: 'localStorage',
    autocapture: false, // explicit events only — keeps the dataset clean
  })
  enabled = true
  track('app_initialized')
}

export function identifyUser(
  userId: string,
  props?: Record<string, string | number | boolean | undefined>
): void {
  if (!enabled) return
  posthog.identify(userId, scrub(props))
  track('user_identified')
}

export function track(
  event: string,
  props?: Record<string, string | number | boolean | undefined>
): void {
  if (!enabled) return
  posthog.capture(event, scrub(props))
}

export function resetAnalytics(): void {
  if (!enabled) return
  posthog.reset()
}

/** Drop undefined fields so PostHog doesn't store them as nulls. */
function scrub(
  props?: Record<string, string | number | boolean | undefined>
): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) out[k] = v
  }
  return out
}
