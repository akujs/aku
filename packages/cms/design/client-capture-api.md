# Client Capture API

Status: research complete, design TODO.

- auto-extract pageview event - send initial event then another on each navigation, monkey-patching history.pushState / replaceState and listening to `popstate` events. Only send new event if path changed to avoid spurious events from query-string-only or hash-only updates.
- function to send custom event
- preload queueing
- Strip ignored parts of URL - hash and non-utm params, keep click id param name but not value

## Consider further tracking

- **Interaction tracking**: GA4 auto-captures outbound clicks, file downloads, form start/submit, and YouTube video milestones. PostHog's autocapture system records all clicks, inputs, and form submissions on interactive elements, annotating each with a full DOM selector chain. Plausible and Amplitude offer similar features as opt-in extensions.
- **Engagement**: GA4 sends accumulated engagement time on visibility change. Plausible sends scroll depth and time-on-page as an engagement event when the tab is hidden.
- **Web vitals**: PostHog and Amplitude (opt-in).

## Manual event API

All products expose a function to send custom events: `gtag('event', name, params)`, `plausible(name, {props})`, `posthog.capture(name, props)`, `analytics.track(name, props)`, etc. The data shape is consistently an event name string plus a flat properties object.

Pre-load queuing is universal: a lightweight stub pushes calls into an array, and the real library drains the queue on load. GA4's `dataLayer` pattern is the most well-known variant.
