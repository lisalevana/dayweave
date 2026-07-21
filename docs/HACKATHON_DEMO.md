# DayWeave: three-minute judge demo

DayWeave is the consumer product. **AURORA — Adaptive User-led Route
Optimization & Recommendation Assistant — is the planning system underneath
it.** Keep that distinction consistent throughout the pitch.

## Before the clock starts

- Run `npm install`, then `npm run dev`, and open the URL printed in the
  terminal.
- Leave `OPENAI_API_KEY` blank for the most reliable demo. The seeded path is a
  deliberate offline adapter, not a recording or a disguised live result.
- Use a 390 × 844 mobile viewport for the core story; keep a 1440 × 900 tab
  ready if judges ask about responsive design.
- Reload to reset. Confirm the opening screen shows **Try the Hong Kong demo**.
- Do not call AURORA “the app” and do not claim that GPT calculated the route.

## Timed script

### 0:00–0:20 — The problem and promise

**Action:** Show the opening postcard, the coral thread, and Wivi.

**Say:** “People save for years for one day like this, then lose precious time
backtracking through a wishlist. DayWeave doesn’t invent another itinerary. It
starts with the places you already chose and makes time for what matters —
without turning the day into a checklist.”

**Action:** Choose **Try the Hong Kong demo**.

### 0:20–0:45 — Messy wishes become confirmable intent

**Action:** Show the preloaded messy sample, choose **Structure my wishes**, then
choose **Confirm what matters** when extraction finishes.

**Say:** “This looks like real trip planning: mixed notes, links, a reservation,
‘Victoria Peak near sunset,’ and ‘shopping last so I don’t carry bags.’ With a
key, GPT-5.6 turns screenshots and text into structured intent. This demo uses
the same schema through a bundled offline adapter, so I’m not pretending a
seeded result is live AI.”

### 0:45–1:05 — The traveller stays in control

**Action:** Point to the nine charms, the three non-color **Must visit** markers,
the fixed booking, pace, and walking comfort. If useful, tap one charm to show
that the priorities are editable.

**Say:** “The model can interpret a wish, but it cannot silently decide what I
care about. I confirm the priorities and constraints first.”

**Action:** Choose **See my tangled thread**.

### 1:05–1:30 — Untangle with deterministic proof

**Action:** Press **Untangle my day** and let the thread settle.

**Say:** “AURORA’s deterministic optimizer now checks every candidate against
opening windows, visit durations, the demo’s seeded travel matrix, the
reservation, walking comfort, sunset, and shopping last. It protects feasible
must-visits and says honestly what belongs another day.”

**Action:** Point out the fit count, time/walking improvement, protected moments,
and gently deferred places.

**Say:** “GPT did not calculate this route. Tested application logic did, and
every change has a reason code.”

### 1:30–1:50 — One calm next decision

**Action:** Choose **Begin my day**. On the single next-place card, choose **Take
me there**, **I’ve arrived**, then **Tie this moment**.

**Say:** “Live mode is intentionally not a dense schedule. It answers one calm
question: where should I go next, and why does that protect something I care
about?”

### 1:50–2:20 — Repair the remaining day

**Action:** Choose **I’m running 40 minutes late**.

**Say:** “Travel days change. DayWeave freezes what already happened and
recalculates only the remainder. It never quietly removes a place.”

**Action:** Compare the two recovery choices, then select **Protect the moments**.

**Say:** “I can protect the reservation and sunset while saving a lower-priority
stop—PMQ—for tomorrow and keep a balanced pace, finishing by 8:35. Or I can
keep every chosen stop with explicitly packed pacing and tighter transition
buffers, finishing by 8:27. No taxi or fare is invented. When a path is
infeasible, DayWeave disables it instead of bluffing. The traveller chooses the
trade-off.”

### 2:20–2:40 — Useful evidence, not viral certainty

**Action:** Choose **View Don’t Miss Here**, then briefly expand **View evidence**.

**Say:** “DayWeave surfaces one detail people often discover too late, with a
source, freshness, recurrence, and confidence. Here, the next stop is Mak’s
Noodle, so the briefing explains the signature wonton-noodle bowl and its
heritage. Weak or conflicting evidence is labelled mixed or unknown and is
never allowed to move the route.”

### 2:40–2:55 — Staying longer is a feature

**Action:** Close the evidence disclosure, choose **Take me there**, then choose
**I’m loving it here** and **+30 minutes**.

**Say:** “This is the emotional feature I care about most: ‘Stay. This is what
the trip is for.’ Enjoying a place longer is not failure. AURORA reshapes the
remaining afternoon while keeping protected moments visible.”

### 2:55–3:00 — Close

**Action:** Keep the re-woven route on screen. If the clicks are rehearsed,
choose **Reweave the rest** and **Finish the demo day** to show the memory thread.

**Say:** “AI understands what matters. Deterministic optimization verifies what
is possible. The traveller remains in control. That is DayWeave.”

## If something goes wrong

- **No AI key / network:** Stay on the seeded Hong Kong path and explicitly say
  it is the offline adapter. This is a supported product state.
- **Animation is disabled:** Continue immediately; reduced-motion mode preserves
  every state and action.
- **A panel is already open:** Reload to return to the opening state.
- **A judge asks why something moved:** Open the visible change explanation and
  point to the structured reason, not a model-generated assertion.
- **A judge asks about discovery:** Explain that a suggestion can be added,
  saved, or rejected, and never enters the route without explicit approval.

## Claims to avoid

- Do not say the demo uses live traffic, live venue availability, or live social
  scraping.
- Do not say GPT optimizes, proves feasibility, or supplies travel times.
- Do not describe one source as local consensus.
- Do not imply deferred places are failures or that completing everything is
  the goal.
