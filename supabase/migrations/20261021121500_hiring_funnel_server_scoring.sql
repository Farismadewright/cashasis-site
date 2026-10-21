-- Hiring funnel: store screening flags, server-scored assessment evidence,
-- acquisitions fit, and interview questions.
--
-- DO NOT APPLY until this pull request is approved.
-- Apply before deploying the careers-intake, careers-questionnaire,
-- careers-team-assessment-v2, and hiring-admin edge functions.
-- Existing rows are kept. New columns are nullable.
-- Applicants stay in Supabase. This migration does not write to GoHighLevel.

alter table public.hiring_candidates
  add column if not exists screening jsonb,
  add column if not exists assessment_started_at timestamptz,
  add column if not exists audio_path text;

comment on column public.hiring_candidates.screening is
  'Structured application screening answers and flag-only codes. Never an automatic rejection.';
comment on column public.hiring_candidates.assessment_started_at is
  'Server time when the Team & Position Assessment was first opened. Used for the finished-too-fast flag.';
comment on column public.hiring_candidates.audio_path is
  'Private hiring-audio object path for the optional voice introduction.';

alter table public.hiring_team_assessment_profiles
  add column if not exists flags jsonb,
  add column if not exists acquisitions_fit integer,
  add column if not exists interview_questions jsonb,
  add column if not exists work_sample jsonb,
  add column if not exists timing jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hiring_team_assessment_profiles_fit_check'
  ) then
    alter table public.hiring_team_assessment_profiles
      add constraint hiring_team_assessment_profiles_fit_check
      check (acquisitions_fit is null or (acquisitions_fit >= 0 and acquisitions_fit <= 100));
  end if;
end $$;

comment on column public.hiring_team_assessment_profiles.flags is
  'Query flags: attention_check_failed, finished_too_fast, response-quality, screening codes. Not shown to applicants.';
comment on column public.hiring_team_assessment_profiles.acquisitions_fit is
  'Internal 0-100 Acquisitions fit. Evidence for review, never an automatic hire or rejection.';
comment on column public.hiring_team_assessment_profiles.interview_questions is
  'Structured interview questions generated at assessment completion.';
comment on column public.hiring_team_assessment_profiles.work_sample is
  'Acquisitions typed-reply rubric and optional audio path.';
comment on column public.hiring_team_assessment_profiles.timing is
  'Assessment duration used for the finished-too-fast flag.';

create index if not exists hiring_profiles_acquisitions_fit_idx
  on public.hiring_team_assessment_profiles (acquisitions_fit desc nulls last);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hiring-audio',
  'hiring-audio',
  false,
  2097152,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/m4a']::text[]
)
on conflict (id) do nothing;

-- People who finished the questionnaire under the old Predictive Index handoff,
-- and who never completed a Team & Position Assessment, are waiting on that
-- assessment. They are not ready for review. Historical Predictive Index rows
-- in hiring_assessments are left as-is.
update public.hiring_candidates c
set stage = 'assessment_pending',
    updated_at = now()
where c.stage = 'pi_pending'
  and not exists (
    select 1
    from public.hiring_team_assessment_profiles p
    where p.candidate_id = c.id
  );

-- Assistant query after the functions are deployed:
-- select c.full_name, c.position, c.stage, c.screening, c.audio_path,
--        p.acquisitions_fit, p.flags, p.interview_questions, p.work_sample, p.scores, p.profile_label
-- from public.hiring_candidates c
-- left join public.hiring_team_assessment_profiles p on p.candidate_id = c.id
-- where c.stage = 'ready_for_review'
-- order by p.acquisitions_fit desc nulls last;
