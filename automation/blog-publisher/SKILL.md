---
name: cash-as-is-autonomous-seo-blog-publisher
description: Operate native ChatGPT Work SEO, AEO and GEO publishing for CashAsIs.com, including read-only GHL seller intelligence, social drafts and up to three daily seller articles and branded thumbnails through Farismadewright/cashasis-site and Netlify. Use for Cash As-Is blog batches, seller content, market analysis, indexing, weekly/monthly SEO reviews and organic seller conversions. Preserve the Astro website design and enforce staged rollout before unattended publishing.
---

# Cash As-Is — Autonomous SEO & Blog Publisher

## Authority and state
Use `Farismadewright/cashasis-site` and `automation/blog-publisher/SKILL.md` as the starting rulebook. Fetch current main and publishing state each run. Read [site-contract.md](references/site-contract.md) before editing. Preserve live design, routing, CSS, layouts, forms, SEO, tracking and official logo assets.

Read [validation-state.json](references/validation-state.json) for initial test evidence; refresh it against current repository state. Determine mode from durable state. Remain **unattended production OFF** until all activation gates pass. Read repository `automation/blog-publisher/state.json`; missing, malformed or inconsistent state means OFF. Read [publishing.md](references/publishing.md). Installation does not schedule or execute publishing. Use ChatGPT Work native scheduling, research, writing and image generation. Configure a paused native runner during validation; do not enable production publishing until every essential gate passes. Do not add Windsor.ai, external writers/image subscriptions, Zapier, Make, external AI runners or paid APIs. Use current tools first. Never buy extra credits or services automatically.

The user authorizes creation and testing, including isolated branches and Netlify previews. The corrected transparent-logo template left-photo-transparent-v2 was approved on 2026-10-13. Preserve its approved asset/renderer hashes and 1200×630 output. Do not request routine thumbnail or article approval. The owner authorizes unattended up-to-three/day publishing after the complete workflow passes; further authorization is required only for template changes or new paid services.

## Execute the pipeline
1. Resolve latest main commit and current Netlify production deploy. Use connected GitHub/Netlify tools and a clean isolated worktree. Never expose secrets.
2. Inventory all blog articles, static seller pages, pending PRs and the durable topic ledger. Run `scripts/inventory.py REPO`. Compare intent, answer and geography manually too; exact hashes are insufficient for cannibalization. Read [editorial.md](references/editorial.md).
3. Read [seller-voice.md](references/seller-voice.md) and analyze accessible Cash As-Is GHL inbound messages read-only. Publish only anonymous recurring patterns; never quotes, names, addresses, contact IDs, private amounts or unique stories. Combine this evidence with search opportunities and existing coverage. Select distinct seller questions. Prioritize Harris/Fort Bend; verify service coverage elsewhere. Use GSC demand if accessible; never invent search volume. Improve existing overlapping content instead of spinning cities or synonyms.
4. Read primary sources and verify facts before drafting. Read [evidence.md](references/evidence.md). Save source URLs, dates, period, geography, units, methodology and supported claims in article evidence records. Never force market facts to favor Cash As-Is.
5. Write an original, conversational seller article that answers immediately, explains options and offers an actionable decision or labeled calculation. Use house/property. Explain convenience, condition flexibility and potential speed honestly; never claim cash always nets more or guarantees foreclosure prevention. Do not imitate inaccurate claims in old articles.
6. Apply [discovery-and-social.md](references/discovery-and-social.md): primary/supporting keywords, title/description/slug/canonical, OG and X metadata using the unique thumbnail, BlogPosting, applicable BreadcrumbList, matching visible FAQs and eligible schema. Add direct answers, credible citations, local context, meaningful internal links and descriptive alt text. Use tables/graphs only when they help; generate charts from retained data, never imagegen. Avoid duplicating the layout FAQ/final CTA. Preserve `ctaLink` attribution for extra CTAs.
7. Read [thumbnail.md](references/thumbnail.md), inspect bundled approved examples, generate illustrative property backgrounds with imagegen and compose using the deterministic template with the exact official logo. Never generate logo lettering.
8. Generate and store Facebook, Instagram, LinkedIn, Google Business Profile drafts, short excerpt and useful hashtags with scripts/social_drafts.py. Never auto-publish social. Retain a per-article record using [record-contract.json](references/record-contract.json): intent, overlaps/difference, sources, image provenance, real/unknown cost, checks and release IDs. Store mutable ledger/state in the repository, not only scratch or this skill. Keep private CRM data out of public GitHub.
9. Run full `npm run build` and `scripts/validate_output.py REPO SLUG`. Inspect desktop/mobile article and card; check source links, table widths, chart labels, crop, FAQ, CTA, canonical/schema, image, sitemap/RSS and tracking. Scripts are necessary, not sufficient.
10. Commit content/images/records to a validation branch, open a draft PR and verify the exact commit's Netlify preview. Mark failures HOLD with reason. Do not merge test fixtures. Publish production only under activated policy in [publishing.md](references/publishing.md); verify runtime release afterward and stop on regression.

## Quality and pace
Require every originality, editorial, evidence, visual, technical and deployment gate. Never publish filler for volume. Target at most **3/day Monday–Sunday permanently**, with America/Chicago date accounting. Never increase this cap without new owner authorization. Publish fewer if gates fail. Report published/held counts honestly.

## Measure
Read [measurement.md](references/measurement.md). Track GSC indexing/clicks, GA4 original organic landing sessions and successful seller leads, and GHL blog attribution where available. CTA clicks/form starts are intermediate actions. Validate `generate_lead` delivery, key-event status and deduplication; source code alone is not proof. Report unavailable data as unavailable, never zero.

Read [native-runner.md](references/native-runner.md) and use scripts/release_gate.py before production writes. Acquire a durable GitHub Contents API SHA-guarded lease, reserve daily slots before generation, verify lease ownership again before publication, and preserve main branch checks. Native schedules do not preserve scratch; reconstruct source from GitHub and installed skill each run. Record exact deployment commits and outcomes.

Return concise published/held results, reasons, commit/preview/live links, actual activation state, material traffic/lead findings and next action. Do not pretend a skill file executes while idle.

## Analytics separation — owner update 2026-10-13
Treat Google Analytics, Search Console and live conversion-reporting verification as optional reporting capabilities, never publication activation gates. Preserve existing attribution code and validate CTA links locally. Missing reporting access means metrics unavailable, not HOLD for an otherwise safe article. GSC Wizard Starter is now owner-purchased and approved for read-only Search Console/GA4/indexing measurement; use the existing connection when available. Never purchase, renew, or add any analytics service or paid API automatically; Windsor.ai remains prohibited. Keep factual verification, privacy, duplicate prevention, approved thumbnail hashes, build/mobile/metadata/link checks, exact-commit deployment verification, durable leases and spending safeguards mandatory. Activate only after a genuine native unattended end-to-end creation/image/deployment/live verification run has recorded evidence.


## Search-to-seller conversion and indexing QA — owner update 2026-10-14
This section is mandatory for future runs and ongoing SEO improvement. It supplements, never weakens, existing editorial, privacy, visual, release, lease, and spending safeguards. Preserve the 8–9 AM Central native daily run and max 3 published articles/day, seven days/week. Do not change live site design or publishing cadence. A Google API outage remains reporting-unavailable, not a publishing blocker; pre-publication local technical/editorial QA is still mandatory.

### Before publishing each new article
- Inventory current live article and seller-page topics, query intent, city, canonical and topical overlaps. Check near-duplicate phrasing and meaning, not only hashes. Improve or consolidate an existing page instead of publishing overlapping city/synonym variants. Flag thin/template-like pages.
- Record the target seller question, primary query intent, supporting queries, unique answer/value, actual service geography and factual sources. Never invent Google search demand.
- Verify response quality, up-to-date primary-source evidence, honest closing/tax/legal caveats, helpful original detail, and no unsupported claims. Reject keyword stuffing and fabricated local expertise.
- Validate production URL eligibility: expected HTTP 200, crawlable/no robots or meta noindex, self-consistent canonical, sitemap/RSS inclusion, structured data, metadata, meaningful inbound/outbound internal links and correct CTA/form attribution. Preview URLs must remain noindex; production URLs must not.
- Verify at least one natural path to a relevant service/offer form without misleading promises; check that the form and GA4 attribution can actually record a lead when reporting is available.
- Record pass/HOLD for each gate. Never fill a daily quota with low-value duplicate pages.

### After publishing and in periodic optimization
- Use the owner's existing GSC Wizard Search Console/GA4 connection and active indexing tracker (created 2026-10-14) to reconcile live sitemap, article inventory, canonical URLs and actual Google URL Inspection verdicts. Distinguish 'indexed', 'crawled not indexed', 'discovered not indexed', 'unknown', 'redirect/canonical', and technical errors. Search impressions are NOT an exact indexed count. New pending tracker entries are NOT Google rejections.
- For nonindexed URLs first verify the page actually exists and returns a valid live response, canonical, robots/index directives, internal links, sitemap and content distinctiveness. Do not request indexing for broken, duplicate, noindex, redirected or obsolete pages. Where appropriate, propose/request indexing through the supported Google Search Console UI; do not claim the GSC URL Inspection API itself submits indexing requests or guarantees indexing. Ask owner before manual indexing requests that change Google state.
- For the /blog/ hub, evaluate whether the very long article directory provides distinctive topical navigation, seller help and conversion paths; recommend small content/navigation improvements without altering the site's approved design until owner approves.
- Prioritize genuinely relevant pages with stable impressions and average positions approximately 11–30; inspect actual queries, CTR, competing Cash As-Is URLs, topical completeness, internal links, title/snippet alignment, local relevance and conversion paths. Tiny impression counts imply uncertainty; never promise first-page ranking.
- Track article -> impressions -> Google clicks -> GA4 organic landing sessions -> CTA/form starts -> validated lead -> qualified seller -> agreement -> funded retained GP where attribution evidence exists. Never infer downstream conversion from page views; unknown remains unknown. Report source, period, data lag and any event-tracking gap. Feed useful, verified findings to Lead Acquisition Engine/COO, not a duplicate dashboard.
- Run a weekly SEO opportunity and indexing-exception review; preserve article-level change logs and before/after comparisons. Do not rewrite, redirect, merge or delete live articles without specific owner approval and a validated rollback plan.

### Immediate investigation queue (do not blindly rewrite)
- /blog/: last GSC inspection 'Crawled - currently not indexed'; Google crawl/index directives allowed and canonical matched. Review index hub's original utility, category navigation, excessive similar entries and seller conversion flow.
- /blog/how-fast-sell-house-cash-houston/: inspection has alternated 'Discovered - currently not indexed' and 'URL unknown'; check actual production HTTP response, sitemap, internal links and overlap with Houston cash-sale timeline articles before any indexing request.
- /blog/sell-house-back-taxes-harris-county/: 'URL unknown'; check live response, sitemap, links and differentiation from the Houston back-taxes page (which has early search impressions).


## Organic Seller Acquisition Architecture — Carrot-style strategy, owner update 2026-10-14
The business goal is a seller-lead conversion system built around Google search, not article count. CashAsIs.com previously produced roughly two seller leads/month during a prior Carrot-era implementation; treat that as owner-reported historical context, not a verified current benchmark. Preserve the current Astro/Netlify design and existing attribution infrastructure. Reproduce useful principles, not Carrot proprietary code/content.

### Three-layer search architecture
Maintain a durable keyword-to-page and cluster map in the repository before selecting new topics. Every commercially important seller intent gets ONE designated primary page; supporting pages must strengthen that primary page and not compete with it.
1. PRIMARY ACQUISITION / MONEY PAGES: high-intent direct-sale searches such as sell my house fast Houston, cash home buyers Houston, we buy houses Houston, plus validated service-area city pages. These pages must clearly explain who CashAsIs is, what it buys, seller tradeoffs, process, proof/credibility where verified, and a low-friction offer path.
2. SELLER-PROBLEM PAGES: one primary page for each meaningful problem/intent such as inherited/probate, back taxes, foreclosure, vacant property, major repairs, fire/flood damage, tenants/tired landlord, liens/title complications, divorce and other evidence-supported seller situations.
3. SUPPORTING EDUCATION: detailed questions, checklists, timelines and local explainers. Every supporting article should naturally link upward to the designated problem or acquisition page and laterally only where useful. Primary pages should link to their strongest supporting guides.

### Keyword-to-page governance
- Maintain a canonical intent map with: target query family, primary URL, supporting URLs, geography, funnel stage, current GSC clicks/impressions/position, GA4 landing sessions/key events, status and next optimization.
- Before creating a page, search this map and current content. If a primary already exists, improve it. Do not create another page merely for a synonym.
- If multiple existing URLs compete for the same intent, HOLD new content and propose consolidation/internal-link/title changes; redirects/merges/deletions require owner approval.
- Search Console query/page evidence overrides speculative keyword targeting. Tiny samples are directional only.

### Conversion optimization
- Preserve existing design and forms. Verify mobile and desktop paths from search landing page to offer request/call; keep CTA language accurate and low pressure.
- Every primary/problem page should have an obvious relevant next action and contextual links to useful evidence/education. Do not overload pages with CTAs.
- Use the existing UTM/blog attribution and lead-submit/GHL attribution system; never replace a working attribution mechanism casually.
- Treat form_start/CTA events as intermediate. generate_lead requires validation; qualified seller, agreement and funded GP require CRM/transaction evidence.
- Report organic conversion as: query -> landing page -> session -> CTA/form start -> validated lead -> qualified seller -> agreement -> funded retained GP.

### Local authority and trust
Strengthen real Houston-area usefulness using verified service geography, primary local sources, real seller stories/testimonials already approved for public use, transparent process/cost/timing explanations, and accurate local problem guidance. Never fabricate offices, neighborhoods served, transactions, reviews, seller outcomes or local statistics. Do not create doorway pages with swapped city names.

### Lead magnets/tools
Prefer genuinely useful, low-friction tools that answer a seller decision and can earn links/return visits. Candidate backlog, requiring normal build/evidence/privacy QA before production:
- As-Is vs. Repair/List Net Proceeds Comparator using user-entered assumptions with clear labels; never present an estimate as an appraisal or guaranteed net.
- Cost of Waiting calculator: mortgage/taxes/insurance/utilities/maintenance assumptions -> monthly/90-day holding estimate.
- Seller Situation Checklist selector: inherited/probate, taxes, foreclosure, tenants, vacant, repairs -> personalized checklist and relevant verified guides.
- Cash Sale Readiness checklist: ownership/signers, occupancy, access, title/payoff/tax issues, desired timing.
- Texas/Houston seller deadline organizer for user-entered known dates; no invented legal deadline or legal advice.
Tools may offer the existing cash-offer path after delivering value. Do not gate every educational tool behind contact capture. Any lead magnet collecting personal data must use existing privacy/consent infrastructure and minimum necessary fields.

### Off-page authority
Track legitimate citation/backlink opportunities: local/industry resource mentions, useful tools worth citing, public seller education, partner/resource relationships and earned media. Never buy spam links, use PBNs, mass directory spam, fake reviews or automated link schemes. Monitor referring domains/backlinks when an approved data source is available; otherwise mark unavailable.

### Optimization cadence
Daily publishing is a maximum, not a quota. On any run, improving a high-opportunity existing page can be more valuable than a new article. Prioritize: (a) primary acquisition pages, (b) problem pages, (c) striking-distance pages with meaningful GSC evidence, then (d) genuinely uncovered supporting questions. Maintain the 3/day article publication cap; optimization of existing pages must still pass build/release checks and must not silently redirect/delete/merge pages.

### Initial intent map from GSC settled through 2026-10-11
Use as starting evidence, not permanent truth:
- Houston direct-sale cluster: /blog/sell-my-house-fast-houston/ (17 impressions, avg pos ~62.2), /blog/cash-home-buyers-houston/ (1, ~10), /blog/sell-house-for-cash-houston/ (4, ~43). Audit whether the website homepage should be the commercial Houston hub before consolidating or changing canonicals.
- Back taxes Houston: /blog/sell-house-behind-on-taxes-houston/ (14, ~23) is current optimization priority and should be the broad Houston tax-problem hub unless later evidence supports another primary.
- City direct-sale striking-distance candidates: Pearland /blog/sell-house-fast-pearland-tx/ (7, ~16.1); Montgomery County (7, ~19.1); Missouri City (4, ~19.8); Tomball (11, ~21.6); Katy (12, ~22.9); Cypress (12, ~29.8). Do not infer stable ranking from low impressions.
- Problem pages with early strong but tiny samples include tenant-occupied Houston (~pos 4 on 2 impressions), vacant Houston (~3.75 on 4), liens Harris County (~1 on 1), inherited Harris County (~11 on 1), probate Harris County (~13.7 on 3). Preserve uncertainty.

### Success objective
First milestone: establish repeatable, verified organic seller acquisition and work toward recovering the owner-reported historical baseline of about 2 organic seller leads/month. Then scale qualified organic leads, agreements and funded retained GP. This is an operating target, never a guarantee.



## Ongoing SEO monitoring — owner extension 2026-10-17
Read [monitoring.md](references/monitoring.md) on every publishing run and SEO review. Extend this same publisher and existing schedule; never create a competing skill, runner or SEO schedule. Continue up to three quality articles/day with unchanged safeguards.

After each publication verify live accessibility, canonical, sitemap/RSS, structured data, meaningful internal links and seller path; record the actual publication timestamp, Google URL Inspection result/source/time and next follow-up. Review due indexing observations in later existing daily runs, including days with no new publication. Treat initial unknown/pending statuses and API errors correctly; investigate persistent failures with repeat evidence and fresh local QA.

Review settled GSC impressions/clicks/CTR/average position/top queries and GA4 original organic traffic/meaningful conversion evidence weekly. Identify visibility gains, impression-with-few-click opportunities and position11–30 pages. Recommend evidence-based existing-content improvements before more volume. Compare completed settled months with prior months; report indexed-page evidence/coverage, comparable ranking changes, organic traffic, seller outcomes and overlapping/low-value pages for editorial review. Never infer leads or funded GP from raw events or promise rankings.

Use `scripts/monitoring_queue.py` and the durable monitoring checkpoint for follow-ups, period receipts and alert deduplication. Store actual evidence in the existing article records/runs structure. Keep Google unavailability optional for publication, preserve privacy and read-only measurement, and never buy paid indexing services or use unsupported indexing shortcuts.

Apply the quiet-notification policy in monitoring.md instead of routine daily all-clear messages: retain publication counts/URLs in durable run logs; deliver concise requested weekly/monthly reviews and only actionable publishing/indexing failures, sustained meaningful ranking gains or verified organic-lead changes between reports. Suppress unchanged repeats and normal discovery delays. On-demand owner questions still receive actual status. Preserve the existing ACTIVE08:00–09:00 America/Chicago window, daily cap3, approved thumbnails, design and all factual/privacy/duplicate/build/deploy/lease/spending protections.
