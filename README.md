# CashAsIs Blog (Astro + Netlify)

A fast, SEO/AEO-optimized blog you can grow by dropping in markdown files.
No hand-editing HTML — add a post, push, Netlify rebuilds and publishes it.

## Add a new post (the whole workflow)

1. Create a new file in `src/content/blog/your-slug.md`
2. Copy the frontmatter block from any existing post and fill it in:

```markdown
---
title: "Your SEO title (<=70 chars)"
description: "Meta description, 50-160 chars — this is what shows in Google."
pubDate: 2026-06-12
author: "CashAsIs"
tags: ["topic", "houston"]
image: "/images/your-photo.jpg"
imageAlt: "Describe the photo"
faq:
  - q: "A question people actually search?"
    a: "A direct 2-3 sentence answer."
---

Your article in markdown. First paragraph should answer the title directly
in 2-3 sentences — that's what Google and AI search pull as the answer.

## Use real H2 headings that read like questions
```

3. Drop the hero image into `public/images/`
4. Commit + push → Netlify auto-builds and the post is live.

Set `draft: true` in frontmatter to build it but keep it hidden until ready.

## Run locally
```
npm install
npm run dev      # preview at localhost:4321
npm run build    # outputs to /dist
```

## Deploy to Netlify (first time)
1. Push this folder to a GitHub repo.
2. In Netlify: Add new site → Import from GitHub → pick the repo.
3. Netlify reads netlify.toml automatically (build: `npm run build`, publish: `dist`).
4. Deploy. You get a URL like `cashasis-blog.netlify.app`.

## Wire to cashasis.com/blog later
Two options once it's live:
- Subdomain `blog.cashasis.com`: add a CNAME in your DNS → Netlify. Easy, you can do it.
- Subfolder `cashasis.com/blog`: the MAIN site proxies `/blog/*` to this Netlify
  site (a rewrite rule on the main site's host). This is the SEO-best option but
  usually needs your funnel guy to add the proxy rule. Update `site:` in
  astro.config.mjs to `https://cashasis.com` when you do this.

## What's built in (you don't touch these)
- Per-post `<title>`, meta description, canonical
- Open Graph + Twitter cards
- BlogPosting JSON-LD on every article
- FAQPage JSON-LD when a post has `faq` (gets you AI answers + Google FAQ results)
- Auto sitemap.xml + RSS feed

---

## Adding your tracking (when ready)

Open `src/components/BaseHead.astro` and paste your IDs near the top:

```js
const GA4_ID = 'G-XXXXXXXXXX';   // Google Analytics 4 Measurement ID
const META_PIXEL_ID = '1234567890'; // Meta Pixel ID
```

Leave them blank to keep tracking off. Once pasted, GA4 + Meta Pixel fire on
every page automatically — no per-post work.

**Google Search Console** (do this after deploy — most important for ranking):
1. Go to Search Console → add your property (the live URL).
2. Verify (DNS record or the HTML-tag method).
3. Submit your sitemap: `https://your-site/sitemap-index.xml` (auto-generated).
That's how Google finds and indexes new posts fast.

## Auto-share new posts to social (later)
The site generates an RSS feed at `/rss.xml`. Point a free tool (Buffer, or
Zapier/Make) at it: every new post auto-posts to your social channels and drives
readers back to the blog. (Share blog → social. Don't embed social → blog.)

## Each post's design fields
- `category`: the pill shown on the card + article hero (e.g. "Foreclosure")
- `readTime`: e.g. "6 min read" (optional)
- `image`: hero + card thumbnail + OG share image

---

## CTA + UTM standard (automatic on every post)

All blog CTAs link to your main-site offer form and carry UTM tags so you can
see in GA4/GHL which post generated a lead. You never set these by hand.

**The standard (locked in `src/config.ts`):**
```
https://www.cashasis.com/?utm_source=blog&utm_medium=cta&utm_campaign=blog_cta&utm_content=<post-slug>&utm_term=<placement>
```
- `utm_content` = the post's slug (auto-filled) → tells you WHICH post converted
- `utm_term` = placement: `top` (nav button), `post` (bottom of article), `inline` (mid-article), `index` (blog home)

**To change where CTAs point** (one place): edit `OFFER_URL` in `src/config.ts`.
- Today it's `https://www.cashasis.com` (Option A — reader lands on homepage, clicks your offer button).
- When your funnel guy adds an auto-open trigger (Option B), change it to e.g.
  `https://www.cashasis.com/#offer` and EVERY CTA updates automatically.

**Reading the data:** In GA4 or GHL, filter by `utm_campaign = blog_cta` to see all
blog-driven leads, then break down by `utm_content` to see which posts convert best.

**Why the modal isn't duplicated on the blog:** the offer modal is wired to GHL on
the main site (one form, one pipeline). The blog just links to it. One source of
truth, nothing to re-sync.

**Optional mid-article CTA:** rename a post from `.md` to `.mdx` and drop
`<InlineCta slug="post-slug" />` where you want a nudge in the middle of the article.
