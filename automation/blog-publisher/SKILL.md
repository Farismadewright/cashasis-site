# Cash As-Is Autonomous Blog Publisher — Skill Rules
Version: 1.0 | Status: editorial specification, automation NOT enabled

## Mission
Produce original, accurate, conversion-aware content for CashAsIs.com that helps Texas property sellers make informed choices. Do not manufacture favorable statistics, imply a cash offer always nets more, or use fear or unsupported claims. Publish only when quality gates pass.

## Existing site is the source of truth
- Repository: Farismadewright/cashasis-site
- Astro collection: src/content/blog/*.md
- Schema: src/content/config.ts
- Page layout: src/layouts/BlogPost.astro
- Preserve existing navigation, hero, article body, FAQ, CTA, footer, tracking, CSS, routing, sitemap, RSS and schema; do not overwrite templates without explicit authorization.
- Frontmatter: title <=70 characters; description 50–160; pubDate; optional updatedDate, author, category, readTime, tags, image, imageAlt, draft, faq[{q,a}]. Validate against Astro schema. Use existing conventions for slug and image paths.

## Visual design lock
- Reference artwork: user-approved CashAsIs.com examples: vacant house Spring TX and sell house Humble TX.
- Maintain exact transparent CashAsIs.com logo asset, orange/white/navy-black palette, bold legible type and realistic property photography. Output exactly 1200×630 to match the existing Astro article/card/OG contract. Use public/images/cashasis-logo-white-transparent-v2.png on dark areas or public/images/cashasis-logo-navy-transparent-v2.png on light areas. Never add a block background behind the logo; preserve aspect ratio and alpha. Inspect current stored thumbnails before each batch.
- Thumbnail text: one curiosity-provoking but accurate headline of 3–7 words; avoid clutter, small disclaimers, paragraphs, and multiple slogans. Full SEO title belongs in article metadata.
- Implement image rendering as a deterministic branded template with an approved logo overlay; AI may create background property imagery only. Never depict a real listed property as a documented specific home without rights/source. Check readability, cropping, and logo placement.
- First template and test images require one-time owner sign-off; subsequent production must use locked template and automated visual QA. If template asset/service unavailable, HOLD publishing rather than substitute an inconsistent image.

## Editorial content
- Topic buckets: seller problems (vacancy, inheritance, tax delinquency, pre-foreclosure, tenants, repairs), Houston-area location guides, honest cash-vs-listing comparisons, local market analysis, timelines, selling-cost explainers.
- Prioritize Harris and Fort Bend; expand only where actual service coverage is verified.
- Before drafting: inventory existing posts and Search Console queries; reject keyword cannibalization, duplicate topics, spun city variants and thin content.
- Answer the reader's question immediately; give actionable specifics and nuance; use original calculations or examples clearly labeled hypothetical.
- Differentiate Cash As-Is on simplicity, condition flexibility, potential speed and no-repair option when supported; never claim best financial outcome for everyone.
- Avoid legal/tax advice or guarantee of stopping foreclosure. High-stakes claims need verified authoritative sources and review or must be held.
- Add useful tables, FAQ, comparisons, and charts only where supported. All chart data must include source, geography, date, unit and methodology. No invented numbers.
- Every article should have helpful headings, relevant internal links, accurate metadata, descriptive image alt text, and a natural offer CTA. Preserve sitewide CTA; do not break tracking.
- Do not invent customer testimonials, transactions, credentials, statistics or authors.

## Publication gate (all must pass)
1. Source freshness, factual checks, especially law/tax/foreclosure/market stats.
2. Originality and overlap scan with existing blog.
3. Editorial usefulness and fair comparisons.
4. Brand thumbnail validation and asset availability.
5. Schema/frontmatter, Astro build, internal links, image paths, structured data, sitemap/RSS checks.
6. Deployment health: page returns success, metadata and CTA render, tracking remains intact.
7. Log sources, generation cost, slug, commit, deployment, result and any errors.
On failure: do not publish; queue for review, retry safely, and never silently push questionable content.

## Scheduling and rollout
- Initial 14 days: target up to 3 articles/day, not a quota; only quality-passing articles.
- Then up to 5/day; allow up to 10 only after evidence of indexing, quality, and lead performance.
- Use an external scheduled runner (GitHub Actions or Railway) with secured API credentials, generation and image service, idempotent article IDs, budget ceiling, rate limits, and alerting. A skill file alone does not execute autonomously.
- Publish to staging/test branch first; verify exact Astro content shape and deploy before enabling live automatic writes.
- Track GSC impressions/clicks/indexing, GA4 organic leads, and GHL lead attribution where available. Weekly report: published/held, quality errors, top pages, organic leads and conversion rates. Avoid confusing indexing with guaranteed rankings.
- Do not turn on production schedule, spend money, or change live site layout until runner, image provider, and initial approval are verified.

## Safety
- Respect Google Search policies against scaled low-value content.
- Do not publish fabricated or misleading market claims to make Cash As-Is look favorable.
- Never commit secrets or private lead data to the public repository.
