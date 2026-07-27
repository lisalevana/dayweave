# DayWeave: two-minute judge demo

DayWeave is the consumer product. AURORA, the Adaptive User-led Route
Optimization & Recommendation Assistant, is the verified planning system
underneath it.

## Before the clock starts

- Run `npm install`, then `npm run dev`, and open the local URL.
- If a server-side `OPENAI_API_KEY` is available, screenshot reading can be
  shown. Never place the key in a public or client-side variable.
- If live vision is unavailable, choose **Try the Hong Kong demo**. Its local
  insight and adaptive planner are deterministic, not a prerecorded result.
- Keep the app at a comfortable mobile or desktop width.
- Do not claim GPT calculates routes, travel times, or feasibility.

## Timed script

### 0:00 to 0:25 | One job, understood immediately

**Show:** The opening composer and the three steps: name, recommend, reveal.

**Say:** “DayWeave recommends the day worth taking and tells me what not to
miss at every stop. My input can shape the result, but the insight comes from
the service, not from my own note repeated back.”

**Choose:** **Try the Hong Kong demo**.

### 0:25 to 0:50 | Protect the point of the trip

**Show:** The visual Hong Kong recommendation, its three-stop thread, and the
source-backed detail not to miss at Man Mo Temple, Star Ferry, and Victoria
Peak.

**Say:** “DayWeave gives me the local point of every stop before it gives me a
schedule. Now I can continue into a full day where lunch and sunset are
protected.”

**Choose:** **Continue to the full adaptive day**.

### 0:50 to 1:15 | One actionable, truthful route

**Show:** The 7-of-9 result, departure cues, reasons for protected times, real
directions from each prior stop, local cues, and the places calmly saved for
another day.

**Say:** “This is not another generated checklist. AURORA checked opening
windows, visit durations, walking comfort, a fixed lunch booking, Victoria Peak
near sunset, and shopping last. Seven places honestly fit. Two remain visible
for another day.”

**Optional proof:** Open **How DayWeave decided**.

**Say:** “OpenAI interprets messy intent when connected. Validated application
logic verifies what is possible. The traveller approves every meaningful
change.”

**Say:** “Knowing where to go is not enough. The route also tells me the detail
worth noticing at every supported stop, like the shrimp wontons and duck-egg
noodles at Mak’s.”

### 1:15 to 1:40 | A changed day, without a hidden compromise

**Choose:** **Try the live journey**, **Start this leg**, **I’ve arrived**, and
**Done with this stop**. Then choose **I’m running 40 minutes late**.

**Say:** “Forty minutes later, DayWeave recalculates only what remains. It shows
two valid paths: protect the emotional anchors and defer a lower-priority stop,
or keep every stop with tighter buffers. Nothing disappears until I choose.”

**Choose:** **Protect the moments**.

### 1:40 to 1:55 | Staying longer is success

**Show:** Approve **Protect the moments**, go to the next stop, then choose
**Stay a little longer** and **+30 minutes**.

**Say:** “This is the emotional feature I care about most. Enjoying a place
longer is not failure. DayWeave reshapes the unvisited day while completed
moments, bookings, and protected timing stay visible.”

### 1:55 to 2:00 | Close

**Say:** “AI understands what matters. Deterministic planning verifies what is
possible. The traveller remains in control. DayWeave protects the point of the
trip, not the size of the checklist.”

## Destination recommendation path, if asked

1. Enter **Singapore**. Saved places are optional.
2. Choose **Show me what not to miss**.
3. Show the service headline and the three-stop recommended thread.
4. Point out **Why it earns the stop**, **Don't miss here**, and the dated
   source on every row.
5. Explain that saved places and DayWeave picks are labelled separately.
6. Choose **Use this recommendation in Maps** only if opening a new tab is
   useful for the demo.

Hong Kong, Singapore, Seoul, Cheung Chau, and Johor Bahru work from curated
destination knowledge with no model key. Other destinations use attributed
Wikivoyage listings when the guide exposes enough specific recommendations.
The worldwide picker helps locate a destination, but a broad country may still
need a city, island, or smaller region. The explicit Hong Kong example keeps
the full adaptive-route demonstration. The screenshot control appears only
when vision is connected.

## Claims to avoid

- Do not say the demo uses live traffic, live venue availability, or live
  social scraping.
- Do not say GPT optimizes, proves feasibility, or supplies travel times.
- Do not imply that one source represents local consensus.
- Do not call deferred places failures.
- Do not label a planned stop as a memory. Only explicitly completed stops
  appear on the memory thread.
