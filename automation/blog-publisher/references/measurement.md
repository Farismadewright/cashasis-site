# Traffic and seller outcomes
Prefer direct Google Analytics/Search Console. Respect user's preference for direct GA rather than expired third-party analytics; don't repeatedly probe expired services. Verify account/property IDs, date windows, source filters, timezone and reporting lag. Never infer GA property ID from measurement ID.
Baseline and weekly comparable windows: GSC exact-URL inspection/canonical, clicks/impressions/CTR/position/queries; GA4 original organic landing sessions, engagement, offer_cta_click, form_start, successful generate_lead and key-event configuration; GHL deduplicated blog-attributed sellers, qualified leads, offers/contracts/funded outcomes if accessible.
Indexing isn't ranking; sitemap success isn't indexing. Click/form-start isn't seller conversion. Existing internal CTA uses blog/cta/blog_cta and utm_content=slug; preserve original organic acquisition separately through existing attribution. Validate slug/acquisition survives form and CRM. Don't label all CTA sessions organic or silently rewrite UTM keys.
Current frontend has multiple generate_lead paths including detail updates; validate deduplication before equating events with sellers. Require successful backend response, actual analytics delivery and distinct CRM lead evidence in sanctioned test. Do not send fake live leads or alter analytics configuration as part of skill installation.
Keep private person-level data out of public GitHub; store aggregate public-safe metrics. Report unavailable as unavailable, not zero. Weekly brief: published/held/errors, indexed/pending/unknown URLs, organic sessions, successful seller leads, attribution coverage, useful pages, cannibalization/decay, next updates. Match denominators/windows, disclose small samples and don't increase volume solely from publication count.

Do not add another analytics service as a workaround. 2026-10-13 preflight: GSC Wizard returns payment_required; no direct Google Analytics or GSC connector is exposed. Do not repeatedly probe that subscription. Unavailable direct Google access affects reporting only; it does not block publishing. Never use GSC Wizard or Windsor.ai.



## October17 monitoring extension
Read [monitoring.md](monitoring.md) for mandatory post-publication checks, bounded indexing follow-ups, weekly settled comparisons, monthly reviews, durable state and quiet deduplicated notifications. Execute in the same existing daily publisher, including zero-publication days; preserve schedule, cap, Google reporting separation and all existing safeguards.
