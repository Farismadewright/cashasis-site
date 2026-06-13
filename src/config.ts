// ───────────────────────────────────────────────────────────────────
// SITE CONFIG — edit these in ONE place.
// ───────────────────────────────────────────────────────────────────

// Where the cash-offer modal lives. Today: main site homepage (Option A).
// Later, when your funnel guy adds the auto-open trigger (Option B),
// change this to e.g. 'https://cashasis.com/#offer' and every CTA updates.
export const OFFER_URL = 'https://www.cashasis.com';

// UTM standard for ALL blog CTAs. Do not change the keys — only values.
// utm_content is filled per-post automatically from the post slug.
export function ctaLink(slug, placement = 'cta') {
  const params = new URLSearchParams({
    utm_source: 'blog',
    utm_medium: 'cta',
    utm_campaign: 'blog_cta',
    utm_content: slug || 'index',
    utm_term: placement, // 'top' | 'cta' | 'inline' — where on the page
  });
  const joiner = OFFER_URL.includes('?') ? '&' : '?';
  return `${OFFER_URL}${joiner}${params.toString()}`;
}
