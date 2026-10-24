-- Applicant source tracking (UTM). Additive only: nullable columns, no data touched.
-- Apply BEFORE deploying the careers-intake and hiring-admin functions that use them.
-- hiring_candidates.source stays the constant 'cashasis-careers' and is never overwritten.

alter table public.hiring_candidates
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists landing_url text,
  add column if not exists first_touch_at timestamptz;

comment on column public.hiring_candidates.utm_source is
  'Sanitized, lower-cased utm_source (or ?src= alias) from the careers link the applicant came through. Null = untagged/direct.';
comment on column public.hiring_candidates.utm_medium is 'Sanitized, lower-cased utm_medium (post, dm, job, sms, email, board, print).';
comment on column public.hiring_candidates.utm_campaign is 'Sanitized, lower-cased utm_campaign, e.g. oct26-acq.';
comment on column public.hiring_candidates.utm_content is 'Sanitized, lower-cased utm_content (optional creative / poster / group id).';
comment on column public.hiring_candidates.landing_url is
  'Origin + path (no query string) of the cashasis.com page the attributed visit landed on.';
comment on column public.hiring_candidates.first_touch_at is
  'Browser-reported time of the first recorded cashasis.com visit (30-day window). Informational, server-validated range.';

-- Small table (4 rows today); an index is only useful for the dashboard filter later.
create index if not exists hiring_candidates_utm_source_idx
  on public.hiring_candidates (utm_source)
  where utm_source is not null;
