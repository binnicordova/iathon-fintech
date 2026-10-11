# BRASPER MVP Plan — WhatsApp chat to tracked operation

> Product exploration and MVP plan for **BRASPER**, a Brazil ⇄ Peru money-transfer / currency-exchange service (PIX ⇄ PEN). It turns a manual, WhatsApp-and-spreadsheet workflow into a tracked, auditable operation with automatic electronic invoicing (SUNAT) and a PDF receipt.

**🔗 Live page: https://binnicordova.github.io/iathon-fintech/**

[![Preview of the BRASPER MVP plan page](docs/assets/explore-preview.png)](https://binnicordova.github.io/iathon-fintech/)

*(Static preview of [`reference/explore.html`](reference/explore.html) — click it to open the full interactive page.)*

## What's in the page

- **The idea:** every operation gets a record (Web App or chat → database → VIEW → Fact invoicing).
- **How it works today** vs. the new flow drawn on the team whiteboard.
- **Benchmark** of the [Kambista](reference/kambista-benchmark.html) app and what to borrow.
- **Who does what**, the client Web App and the team VIEW, PDF receipt delivery.
- **AI chat assistant** and an optional extra.
- **What ships in four days** (MVP) and the open questions.

Longer write-up: [`explore-long-version.html`](reference/explore-long-version.html).

## Repository layout

| Path | Purpose |
|------|---------|
| `reference/` | Static planning docs, screenshots and whiteboard (published to GitHub Pages) |
| `docs/assets/` | README images |
| `.github/workflows/pages.yml` | Deploys **only** `reference/` to Pages |
| *(repo root)* | Reserved for the **Expo Go** app (`app.json`, `package.json`, `app/`, `src/`, …) |

## GitHub Pages and the Expo app

Pages is deployed by a GitHub Actions workflow that copies `reference/` into a temporary `_site/` folder (with `explore.html` served as `index.html`). It only runs when `reference/**` changes, so the Expo app code at the repo root can't conflict with the site and doesn't trigger it.

## Local preview

```bash
open reference/explore.html
```

## License

Not yet specified.
