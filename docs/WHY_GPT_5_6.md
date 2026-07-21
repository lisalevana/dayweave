# Why DayWeave uses GPT-5.6 — and does not trust it to optimize

DayWeave is the consumer product. Its underlying planning system is **AURORA:
Adaptive User-led Route Optimization & Recommendation Assistant**.

GPT-5.6 is necessary at AURORA’s *interpretation* boundary because the hardest
input is not a clean form. It is screenshots, pasted links, shorthand notes,
booking prose, mixed place-name translations, and emotionally meaningful
phrases such as “I have to see the Peak near sunset” or “leave shopping until
last.” A rigid parser can extract dates and URLs; it cannot reliably recover the
combined intent while also explaining ambiguity for confirmation.

It is not necessary to replay a known nine-place fixture; deterministic sample
data can do that. It is necessary when DayWeave must generalize from a real
traveller’s unstructured, multimodal material without forcing them to rebuild
their wishlist as a form.

The model is also valuable when permitted evidence uses different names for the
same item, repeats a recommendation in varied language, or contains stale and
conflicting observations. GPT-5.6 can turn that material into a concise proposed
claim and say that the evidence is insufficient. It can translate structured
optimizer reason codes into humane language without making a deferred place
feel like a failure.

The current MVP invokes GPT-5.6 for wishlist extraction only. Its Mak’s Noodle
and Bakehouse briefs and Upper Lascar Row suggestion come from the curated
offline evidence adapter. A future permitted-evidence analysis path may use GPT-5.6 for the
semantic work above, but it must still pass the same provenance and scheduling
gates.

This is why GPT-5.6 was chosen for the prototype (configured as
`gpt-5.6-sol` by default): one model boundary can accept messy text or images,
preserve nuanced constraints, produce schema-shaped output, and explain
uncertainty. The choice is an architectural fit, not a claim that model output
is proof.

## The trust boundary

Language models are probabilistic. A fluent answer may contain a fabricated
opening time, an inconsistent duration, a route that cannot physically fit, or
an explanation that sounds more certain than its evidence. Small numerical
errors compound across a travel day, and an unrepeatable result is difficult to
test or audit.

Therefore GPT-5.6 may propose meaning, but it never decides feasibility or the
winning route.

| GPT-5.6 may propose | Verified application logic must decide |
| --- | --- |
| Place names and likely aliases | Stable resolved place IDs |
| Booking details extracted from prose | Whether the exact booking window is satisfied |
| “Near sunset” as a candidate constraint | Whether a verified timing window fits |
| “Shopping last” as structured intent | Which feasible order respects it |
| Priority cues for traveller confirmation | Final confirmed priority values |
| Evidence clusters and conflicts | Whether provenance/freshness allows scheduling impact |
| A plain-language explanation | The plan, metrics, and structured reason codes |

The deterministic optimizer receives only confirmed places and verified
constraints. It evaluates route and travel feasibility; opening windows; fixed
reservations; visit duration; start and end locations; pace; walking comfort;
protected must-visits; and approved timing constraints. It returns a stable
result, metrics, deferred-place reasons, and a fingerprint for identical input.
Live changes re-run that logic only for the unvisited remainder.

## Contract from model to solver

1. `app/api/extract/route.ts` receives transient user input and invokes the
   server-only adapter in `lib/adapters/openai-extraction.server.ts`.
2. GPT-5.6 returns structured JSON, never executable scheduling instructions.
3. The schemas in `lib/schemas/extraction.ts` reject malformed fields,
   impossible enums, and missing required data.
4. The UI shows the interpretation as editable charms and constraints.
5. The traveller confirms or corrects it.
6. Place, routing, and evidence adapters attach verified application data.
7. Only then does the deterministic optimizer evaluate the day.

A model explanation cannot override a failed constraint. A beautiful sentence
cannot turn an infeasible plan into a feasible one. Fixed bookings are never
silently moved or removed, discoveries are never inserted without approval,
and weak evidence is never converted into a timing constraint.

## Failure and offline behavior

If the API key is missing, input fails validation, or the model is unavailable,
DayWeave offers the seeded Hong Kong demo and a safe path to retry or edit. The
demo adapter returns a clearly labelled fixture that uses the same downstream
contracts; it does not impersonate GPT-5.6. Likewise, the seeded travel matrix
replaces a remote routing adapter without pretending to be live traffic.

Screenshots are transient and are not retained after extraction. The endpoint
uses no-store response headers and the Responses API request sets `store: false`;
screenshots are not stored as evidence or fixtures. Only the structured fields
the traveller confirms may proceed to planning.

The result is a useful division of labor:

> **GPT-5.6 understands messy human meaning. Deterministic code verifies the
> day. The traveller authorizes every meaningful trade-off.**
