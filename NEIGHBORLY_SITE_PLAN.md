# Neighborly Offer site plan

This branch is for building a separate Neighborly Offer seller site while leaving the existing Cash As-Is production site unchanged.

## Goals
- Reuse the proven Cash As-Is seller funnel flow and protected form mechanics.
- Keep Cash As-Is production files untouched on `main`.
- Give Neighborly Offer its own clean, light, crisp visual identity.
- Use the existing aqua/teal + charcoal brand direction from the supplied Neighborly Offer logo.
- Preserve GHL lead routing and bot-protected submission behavior, but point Neighborly Offer to its own acquisition/subaccount routing when configured.
- Design the site so each acquisition subaccount can eventually have a professional branded spoke site while Cash As-Is remains the primary hub brand.

## Proposed visual direction
- White/light background
- Aqua/teal accent
- Charcoal/black typography
- Softer, approachable neighborhood tone versus the bolder Cash As-Is brand
- Refined Neighborly Offer wordmark with simplified house/N icon
- Mobile-first seller CTA and short lead form

## Funnel sections
1. Hero + address/offer CTA
2. Trust/value proposition
3. How it works
4. Why sellers choose Neighborly Offer
5. Situation/problem cards
6. Testimonials/social proof
7. FAQ
8. Final CTA/form

## Guardrails
- Do not modify Cash As-Is branding or production site behavior on `main`.
- Keep Neighborly Offer as a separate deployment/domain.
- Maintain protected lead submission path.
