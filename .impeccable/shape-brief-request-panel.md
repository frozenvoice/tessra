# Shape brief — Tessra Request Panel redesign

<!-- draft until user confirms; shape does not implement -->

## Assumptions (stated)

- Discovery confirmation page closed twice without answer; proceeding on the **editor status strip** contract from critique + user redesign mandate.
- Direction decision page closed without answer; **recommended / assigned direction = REPL Command Strip**. Confirm or correct in chat.
- Current request panel visual language is **anti-reference**, not polish baseline.
- PRODUCT.md principles and functional/message contracts stay unchanged.

## Job and audience

- **Who:** Developers/API workers inside VS Code, mid-task, wanting Thunder Client speed without cloud gates.
- **Mode:** Operate.
- **Job:** Compose → send/connect → inspect body → adjust → resend, with env/defaults available but not loud.

## Outcome and proof

- Primary path: **Method → URL → Send → Response Body** is the only first-glance hierarchy.
- Success: user can resend and read the body without scanning chip walls or nested cards.
- Product-specific truth: local-first, `{{variables}}`, active-environment resolution, VS Code-hosted density — not a SaaS dashboard.

## Selected direction (recommended)

**REPL Command Strip** (terminal multiplexer / developer REPL grammar)

- **Visual authority:** Flat VS Code panels, status bar, monospace URL, hairline rules. No 999px pills, nested cards, soft CTAs, bounce easings.
- **Thesis:** The request is a command line; the response body is scrollback.
- **First viewport:** Thin status strip (Env · Profile · Defaults as text links) → one command row (Method | URL | Send) → underline request tabs → split with Response Body owning canvas; one sticky status line owns success color.
- **Progressive disclosure:** Variable usage, default-headers detail, compare/mode behind expand/overflow — never always-on pill bands.
- **DEFAULT HEADERS:** One-line summary in Headers tab or strip `Defaults ›`; nested banner card removed.
- **Success green:** Single owner on response sticky summary (Send is action-only).
- **Tessra identity:** Method colors as small badges/text, local-first cues in strip — not dashboard spectacle.
- **Density:** Keep high information density; remove extraneous chrome, not useful data.
- **Themes:** One Tessra system on VS Code tokens; existing panel theme presets reinterpreted later under the same grammar (not four competing dashboard looks).

### Alternates weighed

| Direction | Audience ID | Product clarity | Verdict |
|-----------|-------------|-----------------|--------|
| **REPL Command Strip** | High (devs) | High (prompt→output) | **Recommend / build** |
| **Teletext Reveal Grid** | Medium (retro risk) | High if palette→tokens | Strong for REVEAL meta; gimmick risk in VS Code |
| **Concourse Decision Bands** | Medium–high | High hierarchy | Strong bands; yellow accent must stay one-band or regresses to decoration |
| **Canon (TC/Insomnia/Bruno straight)** | High familiarity | High | Standing exit — safer, weaker Tessra world |

Challengers dropped from hand as fuses poorly for Operate API work: arcade CRT glow, botanical folio, cloud iridescence, gravity-rain garden.

Seed key (for later build contract): `75e467bd` · assigned grounded index 3 = REPL lineage.

## Scope and boundaries

- **Fidelity:** Production redesign of request panel webview visual/interaction chrome.
- **Breadth:** Request panel surface (`requestPanelHtml` chrome/CSS/structure); sidebar TreeViews untouched unless needed for consistency notes.
- **Untouched:** HTTP/WS execution, storage, import/export, message types, script runner contracts, backup schema, localization keys’ meanings (copy may clarify, not invent features).
- **Anti-goals:** Partial polish of current chips/cards; AI dashboard grammar; lowering density by hiding needed API fields; changing functional contracts.

## States and ranges

- Empty / first request, composing, sending, success, error, canceled, WS connect/log, collection runner overlay, narrow panel width, many tabs overflow, unresolved variables, imported untrusted scripts.
- Typical: 1–3 open tabs, small JSON/XML body; max: large XML, many headers, runner results.

## Interaction and layout (intent)

1. Status strip always one line; expand for env switch / defaults manage / profile.
2. Command row is the focal affordance; keyboard Enter / Ctrl+Enter unchanged.
3. Request editor tabs: underline/active only — same grammar as response tabs.
4. Headers tab: kv-rows primary; defaults as one summary row.
5. Response: sticky `status · time · size · type` + Body; Compare/Mode in `…` until engaged.
6. Motion: ≤200ms state feedback only; no bounce/slam choreography.

## Constraints and open decisions

- Platform: VS Code Webview · tokens from host theme.
- A11y: keyboard + visible focus bar retained.
- i18n: en/ko/ja strings stay; structure must not depend on English length alone.
- **Open for user confirm:** Accept REPL as world? Prefer Teletext/Airport/Canon instead? Keep four theme preset slots under the new grammar?

## Anti-reference (do not revive)

Pill walls, nested DEFAULT HEADERS cards, triple success green, gradient Send glow, empty-state orbits, card shadows, hover lift as identity.
