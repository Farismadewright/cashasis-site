---
name: cash-as-is-autonomous-seo-blog-publisher
description: Create, validate, publish and measure CashAsIs.com SEO seller articles and branded thumbnails through Farismadewright/cashasis-site and Netlify. Use for Cash As-Is blog batches, seller content, market analysis, indexing and organic seller conversions. Preserve the Astro website design and enforce staged rollout before unattended publishing.
---

# Cash As-Is — Autonomous SEO & Blog Publisher

## Authority and state
Use `Farismadewright/cashasis-site` and `automation/blog-publisher/SKILL.md` as the starting rulebook. Fetch current main and publishing state each run. Read [site-contract.md](references/site-contract.md) before editing. Preserve live design, routing, CSS, layouts, forms, SEO, tracking and official logo assets.

Start in **VALIDATION / unattended production OFF**. Read repository `automation/blog-publisher/state.json`; missing, malformed or inconsistent state means OFF. Read [publishing.md](references/publishing.md). Installation does not schedule or execute publishing. Do not enable cron, runner, auto-merge or paid API services during validation.

The user authorizes creation and testing, including isolated branches and Netlify previews. The supplied Humble and Spring examples approve visual direction. Obtain one-time sign-off on the new locked template as required by the repository rulebook; example approval is not template approval. Prepare reviewable results before asking.

## Execute the pipeline
1. Resolve latest main commit and current Netlify production deploy. Use connected GitHub/Netlify tools and a clean isolated worktree. Never expose secrets.
2. Inventory all blog articles, static seller pages, pending PRs and the durable topic ledger. Run `scripts/inventory.py REPO`. Compare intent, answer and geography manually too; exact hashes are insufficient for cannibalization. Read [editorial.md](references/editorial.md).
3. Select distinct seller questions. Prioritize Harris/Fort Bend; verify service coverage elsewhere. Use GSC demand if accessible; never invent search volume. Improve existing overlapping content instead of spinning cities or synonyms.
4. Read primary sources and verify facts before drafting. Read [evidence.md](references/evidence.md). Save source URLs, dates, period, geography, units, methodology and supported claims in article evidence records. Never force market facts to favor Cash As-Is.
5. Write an original, conversational seller article that answers immediately, explains options and offers an actionable decision or labeled calculation. Use house/property. Explain convenience, condition flexibility and potential speed honestly; never claim cash always nets more or guarantees foreclosure prevention. Do not imitate inaccurate claims in old articles.
6. Add metadata, meaningful internal links, alt text and useful frontmatter FAQs. Use tables/graphs only when they help; generate charts from retained data, never imagegen. Avoid duplicating the layout FAQ/final CTA. Preserve `ctaLink` attribution for extra CTAs.
7. Read [thumbnail.md](references/thumbnail.md), inspect bundled approved examples, generate illustrative property backgrounds with imagegen and compose using the deterministic template with the exact official logo. Never generate logo lettering.
8. Retain a per-article record using [record-contract.json](references/record-contract.json): intent, overlaps/difference, sources, image provenance, real/unknown cost, checks and release IDs. Store mutable ledger/state in the repository, not only scratch or this skill. Keep private CRM data out of public GitHub.
9. Run full `npm run build` and `scripts/validate_output.py REPO SLUG`. Inspect desktop/mobile article and card; check source links, table widths, chart labels, crop, FAQ, CTA, canonical/schema, image, sitemap/RSS and tracking. Scripts are necessary, not sufficient.
10. Commit content/images/records to a validation branch, open a draft PR and verify the exact commit's Netlify preview. Mark failures HOLD with reason. Do not merge test fixtures. Publish production only under activated policy in [publishing.md](references/publishing.md); verify runtime release afterward and stop on regression.

## Quality and pace
Require every originality, editorial, evidence, visual, technical and deployment gate. Never publish filler for volume. Begin up to 3/day for 14 production days, then up to 5 after review. Permit 10 only after owner tier activation and indexing/quality/conversion evidence. Report published/held counts honestly.

## Measure
Read [measurement.md](references/measurement.md). Track GSC indexing/clicks, GA4 original organic landing sessions and successful seller leads, and GHL blog attribution where available. CTA clicks/form starts are intermediate actions. Validate `generate_lead` delivery, key-event status and deduplication; source code alone is not proof. Report unavailable data as unavailable, never zero.

Return concise published/held results, reasons, commit/preview/live links, actual activation state, material traffic/lead findings and next action. Do not pretend a skill file executes while idle.
