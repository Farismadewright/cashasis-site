// Deploy with the Supabase CLI. Dashboard HTML is unchanged.
// Detail responses now include a signed audio_url when a voice recording exists,
// and prefer interview questions stored at assessment time. The /hiring page
// does not render those fields.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://www.cashasis.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function interviewGuide(scores: Record<string, number> | null, applied: string, quality: { uniformly_favorable?: boolean; consistency_flags?: number; interpretation?: string } | null) {
  const qs: { area: string; reason: string; question: string }[] = [];
  const low = Object.entries(scores || {}).sort((a, b) => a[1] - b[1]).slice(0, 2).map((x) => x[0]);
  const high = Object.entries(scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
  const names: Record<string, string> = {
    initiative: "initiative and self-starting",
    persistence: "persistence",
    social: "social confidence",
    assertiveness: "assertiveness",
    conscientiousness: "follow-through",
    process: "CRM/process discipline",
    self_direction: "independent work",
    adaptability: "adaptability",
    composure: "composure under pressure",
  };
  for (const d of high) qs.push({ area: names[d], reason: "Verify a strongly reported tendency with a concrete example.", question: "Tell me about a specific time your " + names[d] + " materially affected a result. What did you personally do, and what happened?" });
  for (const d of low) qs.push({ area: names[d], reason: "Explore a comparatively lower preference and how the candidate manages it.", question: "Tell me about a situation where " + names[d] + " was especially important. What was difficult about it, and how did you handle it?" });
  if (applied === "Virtual Closer") qs.push({ area: "closing evidence", reason: "This role requires prior closing/high-ticket experience.", question: "Walk me through a difficult deal you personally closed: lead source, offer or price, objections, follow-up timeline, and what you did that changed the outcome." });
  else if (applied === "Field Agent") qs.push({ area: "field initiative", reason: "Field work requires self-directed prospecting and rejection resilience.", question: "Imagine you have been in the field for two hours with almost no conversations. What would you actually do for the next two hours?" });
  else qs.push({ area: "pipeline ownership", reason: "Acquisitions requires consistent seller follow-up and pipeline development.", question: "Tell me about a pipeline or book of business you personally built. What did your daily activity and follow-up system look like?" });
  if (quality?.uniformly_favorable || (quality?.consistency_flags || 0) > 0) qs.push({ area: "response verification", reason: quality?.interpretation || "Assessment response pattern should be verified.", question: "Give me an example of a work habit you have had to improve. What was happening, and what did you change?" });
  return qs.slice(0, 6);
}

function roleSignals(scores: Record<string, number>, applied: string) {
  const s = (k: string) => Number(scores?.[k] || 0);
  const roles = [
    { role: "Field Agent", score: .24 * s("initiative") + .22 * s("social") + .18 * s("persistence") + .14 * s("self_direction") + .12 * s("composure") + .10 * s("conscientiousness") },
    { role: "Acquisitions", score: .18 * s("initiative") + .17 * s("social") + .17 * s("assertiveness") + .16 * s("persistence") + .12 * s("adaptability") + .10 * s("conscientiousness") + .10 * s("composure") },
    { role: "Virtual Closer", score: .20 * s("persistence") + .18 * s("assertiveness") + .17 * s("social") + .15 * s("composure") + .12 * s("conscientiousness") + .10 * s("process") + .08 * s("adaptability") },
    { role: "Lead Manager", score: .22 * s("conscientiousness") + .22 * s("process") + .16 * s("persistence") + .14 * s("social") + .14 * s("self_direction") + .12 * s("composure") },
    { role: "Dispositions", score: .22 * s("social") + .20 * s("assertiveness") + .16 * s("initiative") + .14 * s("persistence") + .12 * s("adaptability") + .08 * s("process") + .08 * s("composure") },
    { role: "Marketing", score: .20 * s("initiative") + .18 * s("adaptability") + .16 * s("self_direction") + .16 * s("conscientiousness") + .12 * s("social") + .10 * s("process") + .08 * s("persistence") },
  ].map((x) => ({ ...x, score: Math.round(x.score) })).sort((a, b) => b.score - a.score);
  return { applied_role: applied, role_patterns: roles, alternate_to_explore: roles.find((x) => x.role !== applied)?.role || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: ue } = await admin.auth.getUser(token);
    if (ue || !user?.email) return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: cors });
    const email = user.email.toLowerCase();
    const { data: allowed } = await admin.from("hiring_admins").select("email").eq("email", email).maybeSingle();
    if (!allowed) return new Response(JSON.stringify({ ok: false, error: "Not authorized for hiring dashboard" }), { status: 403, headers: cors });

    if (req.method === "GET") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (id) {
        const [{ data: c }, { data: q }, { data: p }, { data: a }, { data: r }] = await Promise.all([
          admin.from("hiring_candidates").select("*").eq("id", id).single(),
          admin.from("hiring_questionnaire_responses").select("question_key,question_text,answer,created_at").eq("candidate_id", id).order("created_at"),
          admin.from("hiring_team_assessment_profiles").select("*").eq("candidate_id", id).maybeSingle(),
          admin.from("hiring_team_assessment_responses").select("item_key,item_text,dimension,response,reverse_keyed").eq("candidate_id", id),
          admin.from("hiring_candidate_reviews").select("*").eq("candidate_id", id).maybeSingle(),
        ]);
        if (!c) return new Response(JSON.stringify({ ok: false, error: "Not found" }), { status: 404, headers: cors });
        let resume_url = null;
        if (c.resume_path) {
          const { data: s } = await admin.storage.from("hiring-resumes").createSignedUrl(c.resume_path, 900);
          resume_url = s?.signedUrl || null;
        }
        let audio_url = null;
        if (c.audio_path) {
          const { data: s, error } = await admin.storage.from("hiring-audio").createSignedUrl(c.audio_path, 900);
          if (!error) audio_url = s?.signedUrl || null;
        }
        const signals = p ? roleSignals(p.scores, c.position) : null;
        const storedQuestions = Array.isArray(p?.interview_questions) ? p.interview_questions : [];
        const interview_questions = storedQuestions.length
          ? storedQuestions
          : (p ? interviewGuide(p.scores, c.position, p.response_quality) : []);
        return new Response(JSON.stringify({ ok: true, candidate: c, questionnaire: q || [], profile: p, assessment: a || [], review: r, resume_url, audio_url, signals, interview_questions }), { headers: cors });
      }
      const { data: list, error } = await admin.from("hiring_candidates").select("id,brand,full_name,email,phone,city,state,position,stage,experience,availability,created_at,questionnaire_completed_at,heard_from,utm_source,utm_medium,utm_campaign,utm_content,landing_url,first_touch_at").order("created_at", { ascending: false }).limit(250);
      if (error) throw error;
      const ids = (list || []).map((x: { id: string }) => x.id);
      const { data: profiles } = ids.length
        ? await admin.from("hiring_team_assessment_profiles").select("candidate_id,profile_label,scores,completed_at").in("candidate_id", ids)
        : { data: [] };
      const map: Record<string, { scores: Record<string, number> }> = {};
      for (const row of profiles || []) map[row.candidate_id] = row;
      const enriched = (list || []).map((c: { id: string; position: string }) => ({
        ...c,
        profile: map[c.id] || null,
        signals: map[c.id] ? roleSignals(map[c.id].scores, c.position) : null,
      }));
      return new Response(JSON.stringify({ ok: true, candidates: enriched }), { headers: cors });
    }

    if (req.method === "POST") {
      const b = await req.json();
      const id = String(b.candidate_id || "");
      if (b.stage) {
        const allowedStages = new Set(["ready_for_review", "interview", "hired", "not_selected", "withdrawn"]);
        if (!allowedStages.has(b.stage)) return new Response(JSON.stringify({ ok: false, error: "Invalid stage" }), { status: 400, headers: cors });
        const { error } = await admin.from("hiring_candidates").update({ stage: b.stage, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
      if (typeof b.admin_notes === "string" || typeof b.interview_notes === "string") {
        const payload: Record<string, string> = { candidate_id: id, updated_at: new Date().toISOString() };
        if (typeof b.admin_notes === "string") payload.admin_notes = b.admin_notes.slice(0, 20000);
        if (typeof b.interview_notes === "string") payload.interview_notes = b.interview_notes.slice(0, 20000);
        const { error } = await admin.from("hiring_candidate_reviews").upsert(payload, { onConflict: "candidate_id" });
        if (error) throw error;
      }
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }
    return new Response(JSON.stringify({ ok: false }), { status: 405, headers: cors });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Failed" }), { status: 500, headers: cors });
  }
});
