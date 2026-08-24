# Shoort Clips frontend

Shoort Clips is positioned as an **agentic short-form growth platform**: it audits a channel, finds content gaps, directs clips from long-form video, tests hooks and cadence, schedules approved content, and turns performance into the next creative brief.

## Pages

- `index.html` — marketing landing page with sourced short-form facts, agentic workflow, use cases, client-proof placeholders, FAQ, and the 30-day free pilot
- `register.html` — pilot application / workspace creation flow
- `app.html` — product workspace with growth brief, approval queue, creation tools, clip library, test calendar, and channel intelligence

## Preview and build

```bash
npm install
npm run dev
npm run build
```

The production bundle is written to `dist/`. Upload the **contents** of `dist/` to Hostinger `public_html`.

## Backend mode

The product runs in demo mode by default, so every control can be presented before Google Cloud is connected. See [API_INTEGRATION.md](API_INTEGRATION.md) for the runtime switch, endpoint contract, Supabase boundary, and expected job/WebSocket payloads.

## Brand assets

- `assets/shoort-clips-mark.png` — primary icon mark
- `assets/og.png` — editable source copy of the social sharing card
- `public/assets/og.png` — build-ready social sharing card

The design system uses YouTube-inspired red, warm off-white, ink black, Manrope display type, and DM Sans body type. Client case-study cards in the results section are intentionally marked with blank metrics until verified recordings and analytics are provided.
