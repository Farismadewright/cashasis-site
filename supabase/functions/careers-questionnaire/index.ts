// Deploy with the Supabase CLI so ../_shared is bundled.
// Finishing the questionnaire only marks the Team & Position Assessment as the
// next step. It does not create a Predictive Index row or mark anyone ready.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { stageAfterQuestionnaire } from "../_shared/hiring-score.js";

const cors = {
  "Access-Control-Allow-Origin": "https://www.cashasis.com",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false }), { status: 405, headers: cors });
  try {
    const origin = req.headers.get("origin") || "";
    if (origin && origin !== "https://www.cashasis.com" && origin !== "https://cashasis.com") {
      return new Response(JSON.stringify({ ok: false, error: "Origin not allowed" }), { status: 403, headers: cors });
    }
    const body = await req.json();
    const candidateId = String(body.candidate_id || "");
    const answers = Array.isArray(body.answers) ? body.answers : [];
    if (!/^[0-9a-f-]{36}$/i.test(candidateId) || answers.length < 5 || answers.length > 20) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid submission" }), { status: 400, headers: cors });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: candidate, error: ce } = await sb.from("hiring_candidates").select("id,position,stage").eq("id", candidateId).single();
    if (ce || !candidate) return new Response(JSON.stringify({ ok: false, error: "Candidate not found" }), { status: 404, headers: cors });

    const rows = answers.map((a: Record<string, unknown>) => {
      const raw = a?.answer;
      const pasted = Boolean(a?.pasted || (raw && typeof raw === "object" && (raw as { pasted?: boolean }).pasted));
      const text = typeof raw === "string" ? raw : String((raw as { value?: string } | null)?.value || "");
      return {
        candidate_id: candidateId,
        question_key: String(a?.key || "").slice(0, 100),
        question_text: String(a?.question || "").slice(0, 500),
        answer: pasted ? { value: text.trim().slice(0, 5000), pasted: true } : { value: text.trim().slice(0, 5000) },
      };
    });
    if (rows.some((row) => !row.question_key || !row.answer.value)) {
      return new Response(JSON.stringify({ ok: false, error: "Please answer each question." }), { status: 400, headers: cors });
    }
    const { error: ie } = await sb.from("hiring_questionnaire_responses").upsert(rows, { onConflict: "candidate_id,question_key" });
    if (ie) throw ie;
    const now = new Date().toISOString();
    const stage = stageAfterQuestionnaire(candidate.stage);
    const patch: Record<string, string> = { questionnaire_completed_at: now, updated_at: now };
    if (stage !== candidate.stage) patch.stage = stage;
    const { error: ue } = await sb.from("hiring_candidates").update(patch).eq("id", candidateId);
    if (ue) throw ue;
    return new Response(JSON.stringify({ ok: true, next: "team_assessment", position: candidate.position }), { headers: cors });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Failed" }), { status: 500, headers: cors });
  }
});
