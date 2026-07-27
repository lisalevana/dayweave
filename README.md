# DayWeave

**Make time for what matters.**

DayWeave recommends the day worth taking and makes the point of every stop
clear. Name a destination, optionally share places already saved, and the
service returns one sourced thread with **Why people come**, **Don't miss**,
and **Worth knowing** guidance. Every recommended day can continue into the
same interactive journey with progress, breaks, delays, skips, extra time,
recovery choices, and a memory thread. The Hong Kong example adds richer
verified timing constraints. DayWeave is not a notes organizer, generic
checklist generator, or replacement for a maps app.

> Your time is precious, but it should never feel rushed. DayWeave protects the
> moments you saved for.

The consumer product is **DayWeave**. Its underlying planning system is
**AURORA: Adaptive User-led Route Optimization & Recommendation Assistant**.
AURORA interprets wishes, verifies feasible routes, and explains trade-offs;
the traveller always confirms priorities and chooses recovery options.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
cd /Users/elisabethlevana/Documents/iOS/dayweave
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed in the terminal. An OpenAI key is optional.
Hong Kong, Singapore, Seoul, Cheung Chau, and Johor Bahru recommendations are curated
into the service and work without a model provider. The destination combobox
searches countries worldwide and also accepts any city, island, or region.
Other destinations use the no-key Wikivoyage knowledge adapter when enough
specific sourced listings are available. Broad country guides may need a more
specific city or region. Every returned day has a **Start this day live**
action. It uses source-aware planning estimates and sends each real movement to
Maps for current directions. **Try the Hong Kong demo** also offers a fuller
scripted route with bookings and timing constraints, without remote AI or
routing services. A key adds screenshot reading and support for messier Hong
Kong phrasing. The screenshot action stays hidden unless that capability is
actually available.

### Environment

```dotenv
# Optional. Enables server-side GPT-5.6 extraction for user-supplied text/images.
OPENAI_API_KEY=

# Optional override; defaults to the GPT-5.6 family model below.
OPENAI_MODEL=gpt-5.6-sol
```

Keep secrets in `.env.local`; never expose the key through a `NEXT_PUBLIC_`
variable. With no key, the app automatically uses its local Hong Kong text
reader. It never labels local or seeded output as a live model or routing
result.

## Demo journey

For the full scripted version, see [docs/HACKATHON_DEMO.md](docs/HACKATHON_DEMO.md).

1. Choose **Try the Hong Kong demo**. DayWeave first reveals the three essential
   stops, why they matter, and what not to miss.
2. Choose **Start this journey live** to follow those sourced essentials, or
   **Open the complete Hong Kong demo** for the truthful 7-of-9 route with lunch
   and sunset protected.
3. Read the route. Each row includes its departure cue,
   directions from the prior stop, and a place-specific **Don’t miss here** cue.
4. Choose **Try the live journey**. **Start this leg**, **I’ve arrived**, and **Done
   with this stop** make the simulation state explicit.
5. After completing the first stop, choose **I’m running 40 minutes late**,
   compare the two valid repairs, and approve the trade-off you prefer.
6. Choose **Stay a little longer** and add time. AURORA replans only the
   unvisited remainder and never shames the change.

The intended emotional result is not “I completed everything.” It is “the time
I spent was protected, and I was free to enjoy it.”

For another destination, choose a country or type a city, island, or region.
Pasting saved places is optional. When at least three trustworthy local
listings are available, DayWeave brings back three service-owned
recommendations, labels which places came from the traveller, shows an
independently sourced **Don't miss** detail for every stop, and creates one
interactive companion per area-based day. The planner uses verified
coordinates when the source supplies them and an explicitly labelled
route-order buffer otherwise. Maps remains responsible for current directions
and travel times. Traveller notes never become recommendation evidence.

## Product preview

![DayWeave postcard weaving a city, park and coast into one calm route](public/og-v2.png)

The running product is the source of truth for the latest interface. The sample
uses the same three-step flow as a pasted list and produces an actionable
itinerary with constraint reasons, local insight, directions links, explicit
recovery choices, and a memory thread made only from stops the traveller
actually completed.

## Architecture and adapter boundaries

DayWeave keeps interpretation, verification, and consent separate:

```text
destination ──► curated knowledge ──┐
                                    ├──► sourced day recommendation
saved places, optional ─────────────┘          │
                                               ▼
                                  per-day journey materializer
                                               │
                                               ├──► deterministic live companion
                                               └──► Maps for each current move

Hong Kong notes ──► local catalog reader ──┐
screenshot / messier phrasing ──► optional AI reader
                                           │
                                           ▼
                               validated structured intent ──► traveller confirms
                                                                    │
verified routing/place/evidence adapters ────────────────────────────┤
                                                                    ▼
                                            deterministic optimizer (AURORA)
```

- `app/dayweave-app.tsx` contains the three-step client journey and live route;
  `app/thread-map.tsx`
  renders the accessible charm/thread visualization, and `app/wivi.tsx` renders
  Wivi, DayWeave’s pixel travel-thread spirit.
- `lib/dayweave/` contains domain types, deterministic optimization, and
  live-day replanning. `lib/dayweave/materialize-recommendation.ts` turns every
  sourced area thread into a complete, source-labelled planning matrix without
  inventing hours or bookings. `lib/dayweave/demo.ts` owns the nine-place Hong Kong
  input, locally generated walk/transit matrix, tangled order, 40-minute delay,
  experience brief, and discovery fixture.
- `lib/adapters/` holds the local/AI extraction and curated-evidence boundaries;
  `lib/adapters/day-recommendations.server.ts` supplies curated and Wikivoyage
  destination knowledge. `lib/schemas/` validates every boundary with Zod.
  `app/api/recommendations/route.ts` is the no-store recommendation endpoint;
  `app/api/extract/route.ts` remains the optional GPT-5.6 extraction endpoint.
- `tests/` covers deterministic invariants and the rendered/core journey.
- `worker/` and `vite.config.ts` provide the vinext/Cloudflare runtime boundary.

The adapter seams are intentional:

| Boundary | Production responsibility | Offline demo behavior |
| --- | --- | --- |
| Intent extraction | Turn text/screenshots into structured, confirmable intent | Matches supported pasted text locally; the scripted demo remains distinct |
| Place resolution | Resolve aliases to stable place records | Uses the Hong Kong fixture IDs |
| Routing | Supply current walk/transit options and distances | Uses verified coordinates when present, otherwise visible route-order planning buffers; Maps checks every live move |
| Experience evidence | Return permitted, dated claims with provenance | Uses curated destination claims and attributed Wikivoyage listings |
| Day recommendation | Choose a clear, sourced thread and show what not to miss | Uses bundled Hong Kong, Singapore, Seoul, Cheung Chau, and Johor Bahru knowledge |
| Optimization | Produce a feasible plan and structured reason codes | Runs the same local deterministic engine |

The extraction boundary is concrete: `GET /api/extract` reports both local-text
and live screenshot availability, while `POST /api/extract` accepts validated
`{ text, imageDataUrl, sourceKind }` input. `LocalHongKongExtractionAdapter`
handles supported pasted notes with no network call. `OpenAiExtractionAdapter`
handles optional live server-side requests; `SeededHongKongExtractionAdapter`
supplies the explicit scripted fixture. `CuratedHongKongEvidenceAdapter`
supplies the offline Mak’s Noodle and Bakehouse evidence briefs.

For up to 12 places, `optimizeDay` in `lib/dayweave/optimizer.ts` runs an exact,
deterministic prize-collecting subset/permutation search with Pareto and branch
pruning. It respects opening windows, exact reservations, duration, start/end
locations, walking comfort, pace, timing constraints, and “shopping last.”
Fixed bookings and explicitly required IDs are hard constraints. Candidate
comparison protects the maximum feasible number of must-visits first, then
balances prize value, travel, walking, fare, and finish time with a stable
tie-break. Identical input produces the same fingerprint and result; the seeded
balanced demo truthfully fits 7 of 9 places.

Use the `@/lib/dayweave` barrel for `hongKongDemo`, `optimizeDay`,
`createLiveState`, `applyLiveEvent`, `simulateFortyMinuteDelay`,
`buildRecoveryChoices`, `applyDiscoveryDecision`, and the evidence guards.
Every optimization and replan returns structured reason codes.

## Interpretation versus deterministic responsibility

The local reader can match supported Hong Kong place names and explicit phrases
such as “near sunset,” “shopping last,” or “must visit.” GPT-5.6 may additionally
read screenshots, interpret messier phrasing, identify uncertainty, and explain
a verified reason code in natural language. Every extraction path must pass Zod
validation and traveller confirmation.

GPT-5.6 never invents travel times or opening hours, decides route feasibility,
moves a fixed booking, silently changes a priority, treats one opinion as
consensus, or makes the final recovery choice. Those responsibilities remain in
tested application logic and explicit user actions.

**Interpretation captures what matters. Deterministic optimization verifies
what is possible. The traveller remains in control.** See
[docs/WHY_GPT_5_6.md](docs/WHY_GPT_5_6.md) for the design rationale.

## Offline and failure behavior

“Offline-capable demo” means the product story has no runtime dependency on an
OpenAI, maps, place-resolution, or evidence API. After local dependencies are
installed, the seeded Hong Kong path runs against bundled fixtures. It is not a
claim that arbitrary cities can be resolved offline or that this prototype is
an installable PWA.

When live AI is absent or temporarily unavailable, destination recommendations
still work through the curated knowledge service and the no-key Wikivoyage
adapter. Supported Hong Kong notes receive the richer local catalog
interpretation. Screenshot-only input asks for pasted text rather than
pretending the image was read. The seeded demo remains a separate, clearly
labelled option. A route repair changes only the remaining day and completed
stops stay fixed.

## Privacy

Screenshots are **transient input**. They are used only to extract the current
wishlist, are not stored in D1/R2, are not added to evidence, and are not
retained after processing. The live adapter calls the Responses API with
`store: false`; `/api/extract` sends `Cache-Control: no-store`, and provider
errors never echo user material. Local text matching does not send the notes to
an AI provider, and the seeded demo does not upload a screenshot at all.
After confirmation, the structured itinerary and live progress are saved in
this browser so a refresh cannot erase the day. The local snapshot does not
include the raw pasted note or screenshot, and **Explore another place** clears
that transient input while keeping the confirmed day available to resume.
Production deployments must preserve this no-retention
contract and avoid request-body logging. The current hosting configuration does
not declare a D1 or R2 binding.

An imported link or note remains user-supplied material; it does not become a
community recommendation or a scheduling fact merely because it was imported.

## Evidence policy

Experience claims may use only official venue/tourism information,
user-supplied material, licensed sources, manually curated sources, or consented
post-visit confirmations. DayWeave does not scrape or cache restricted platform
content.

Each claim carries its place, source URL/type, observation date, last-checked
date, confidence, recurrence classification, conflicting evidence, and a flag
stating whether it may affect scheduling. Weak, isolated, or conflicting
evidence is labelled `mixed` or `unknown` and cannot move the route. Only a
high-confidence, strongly recurring claim from a permitted verified source,
with no conflict and separately verified timing, may become a deterministic
timing constraint. The scheduling gate in `lib/dayweave/evidence.ts` also
requires a parsable timing window and a `lastCheckedDate` no more than 365 days
before the planning date. Source links and freshness stay available without
turning the interface into a research dashboard.

## Accessibility

The experience uses semantic controls, keyboard navigation, visible focus
states, high-contrast deep-teal ink, and at least 44px touch targets. Priority
is conveyed by words, icons, and protected-knot shapes rather than color alone.
The thread has a screen-reader description, decorative pixel art is hidden or
labelled appropriately, and `prefers-reduced-motion` removes ambient and
reweaving movement without blocking interaction.

## Verification commands

```bash
npm run lint
npm run test:unit
npm run test:unit -- tests/optimizer.test.ts
npm test
npm run test:e2e
npm run build
```

`test:unit` runs the Vitest solver, recommendation materialization, and
transformation invariants; the targeted form runs only the core
optimizer/replan/evidence tests. `npm test`
runs those checks, builds the production vinext bundle, and verifies the
server-rendered HTML. `test:e2e` runs the separate Playwright core journey; on a
new machine, install its browser runtime first with `npx playwright install`.

## MVP limits

This prototype provides complete curated recommendations for Hong Kong,
Singapore, Seoul, Cheung Chau, and Johor Bahru, with a no-key Wikivoyage fallback for
destinations whose guide exposes enough specific sourced listings. Every
returned area-based day can enter the deterministic live companion. Travel
numbers outside the seeded Hong Kong example are clearly labelled geographic
estimates or route-order planning buffers, never live routing. The worldwide
country picker is a discovery aid, not a claim of complete coverage for every
country. Worldwide venue-hour verification, live traffic guarantees, and
background navigation remain out of scope. A service recommendation stays
labelled and sourced, while the traveller remains responsible for starting and
changing the day.
