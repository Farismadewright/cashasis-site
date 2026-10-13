# Inspected site contract
Inspected main 82f37ebee3cf38cf9bed9399d1b3065fec763d94 on 2026-10-13. Refresh before execution.
Repository Farismadewright/cashasis-site; Netlify cashasis-blog, site ID a00e8950-5064-4a85-880a-86acf9041c35; canonical https://www.cashasis.com.

- Articles `src/content/blog/*.md`; schema `src/content/config.ts`.
- `src/pages/blog/[...slug].astro` excludes drafts. Blog index has curated cards plus automatically rendered remaining collection; don't create duplicate cards.
- `src/layouts/BlogPost.astro`: Nav, navy hero, white article card, 1200×630 image, body, frontmatter FAQ, final offer CTA, Footer. Preserve it.
- `public/styles.css`: Inter, navy #0D1B2A, orange #F26D21, teal #1B6F7A; responsive grid. Never change global CSS for a post.
- `src/components/BaseHead.astro`: canonical, OG/Twitter, BlogPosting and FAQ JSON-LD. Visible FAQ and schema must agree. No promise of rich results.
- `src/pages/rss.xml.js` excludes drafts; `astro.config.mjs` builds sitemap with site=https://www.cashasis.com.
- `npm run build`: Astro plus attribution and DNI injectors. Don't bypass injectors; Node 22 in netlify.toml.
- `src/config.ts` ctaLink(slug,placement): utm_source=blog, medium=cta, campaign=blog_cta, content=slug, term=placement. Offer destination https://www.cashasis.com.
- Preserve GA4 G-LW591K1QYF, Meta 992265673072496 and HighLevel external tracking. Main form contains generate_lead/form_start code, but runtime validation is required.

Frontmatter title ≤70, description 50–160, pubDate date. author default CashAsIs; category default Seller Guide; tags array of strings. Optional updatedDate, readTime, image, imageAlt, draft boolean, faq array {q,a}. Publisher requires image/alt. Use lowercase-hyphen slugs, ISO dates, accurate category and /images/<slug>.png.

Routine releases may add content/images/publisher records only. Do not edit homepage, layouts, CSS, navigation, forms/functions, tracking, dependencies or Netlify settings. Hold separate infrastructure fixes for their own scope. Charts are standalone assets with alt and data table; ensure tables fit mobile without global CSS edits.
