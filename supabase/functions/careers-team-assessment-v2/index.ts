// Deploy with the Supabase CLI so ../_shared is bundled.
// Scores only from the server item bank. Client weights are ignored.
// The response never includes scores or internal profile labels.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ASSESSMENT_VERSION,
  WORK_SAMPLE_PROMPT,
  buildStoredProfile,
  clientCompleteBody,
  isLegacyWeightedPayload,
  scoreAssessment,
  scoreWorkSample,
  timingFrom,
} from "../_shared/hiring-score.js";

const cors = {
  "Access-Control-Allow-Origin": "https://www.cashasis.com",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const locked = new Set(["hired", "interview", "not_selected", "withdrawn"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function decodeAudio(dataUrl: string) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)(?:;[^,]*)?,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const b64 = match[2].replace(/\s/g, "");
  if (b64.length > 2_800_000) return { error: "too_large" as const };
  let raw: Uint8Array;
  try {
    raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (raw.byteLength > 2 * 1024 * 1024) return { error: "too_large" as const };
  return { mime: match[1].toLowerCase(), raw };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const origin = req.headers.get("origin") || "";
    if (origin && origin !== "https://www.cashasis.com" && origin !== "https://cashasis.com") {
      return json({ ok: false, error: "Origin not allowed" }, 403);
    }
    const body = await req.json();
    const id = String(body.candidate_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "Invalid submission" }, 400);
    if (isLegacyWeightedPayload(body)) {
      return json({ ok: false, error: "Please refresh the page and continue. This assessment was updated." }, 400);
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: candidate, error: ce } = await sb.from("hiring_candidates")
      .select("id,position,stage,screening,assessment_started_at")
      .eq("id", id)
      .single();
    if (ce || !candidate) return json({ ok: false, error: "Candidate not found" }, 404);
    if (locked.has(candidate.stage)) return json({ ok: false, error: "This application is already in review" }, 409);

    if (body.action === "start") {
      if (!candidate.assessment_started_at) {
        const { error } = await sb.from("hiring_candidates")
          .update({ assessment_started_at: new Date().toISOString() })
          .eq("id", id)
          .is("assessment_started_at", null);
        if (error) throw error;
      }
      return json({ ok: true, started: true });
    }

    const scored = scoreAssessment(candidate.position, body.answers);
    if (!scored.ok) return json({ ok: false, error: scored.error }, 400);

    let workSample = null;
    const audioFlags: { code: string; label: string }[] = [];
    if (candidate.position === "Acquisitions") {
      const work = scoreWorkSample(body.work_sample?.text, Boolean(body.work_sample?.pasted));
      if (!work.ok) return json({ ok: false, error: work.error }, 400);
      workSample = work.value;
    }

    let audioPath: string | null = null;
    const audio = body.audio;
    if (candidate.position === "Acquisitions" && audio?.data_url) {
      const duration = Number(audio.duration_ms);
      if (audio.consent !== true) {
        audioFlags.push({ code: "audio_missing_consent", label: "Voice recording was not saved because consent was not given" });
      } else if (Number.isFinite(duration) && duration > 65000) {
        audioFlags.push({ code: "audio_too_long", label: "Voice recording was over 60 seconds and was not saved" });
      } else {
        const decoded = decodeAudio(String(audio.data_url));
        if (!decoded || ("error" in decoded)) {
          audioFlags.push({ code: "audio_not_saved", label: "Voice recording could not be saved" });
        } else {
          const allowed = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a", "audio/m4a"];
          if (!allowed.includes(decoded.mime)) {
            audioFlags.push({ code: "audio_not_saved", label: "Voice recording could not be saved" });
          } else {
            const ext = decoded.mime.includes("mp4") || decoded.mime.includes("m4a") ? "m4a" : decoded.mime.includes("mpeg") ? "mp3" : decoded.mime.includes("wav") ? "wav" : decoded.mime.includes("ogg") ? "ogg" : "webm";
            audioPath = `${id}/intro.${ext}`;
            const up = await sb.storage.from("hiring-audio").upload(audioPath, decoded.raw, { contentType: decoded.mime, upsert: true });
            if (up.error) {
              audioPath = null;
              audioFlags.push({ code: "audio_not_saved", label: "Voice recording could not be saved" });
            }
          }
        }
      }
    }

    const submittedAt = new Date();
    const timing = timingFrom(candidate.assessment_started_at, submittedAt, body.client_elapsed_ms);
    const profile = buildStoredProfile({
      candidateId: id,
      scored,
      screening: candidate.screening,
      workSample,
      timing,
      position: candidate.position,
      completedAt: submittedAt.toISOString(),
    });
    if (audioFlags.length) {
      profile.flags.items.push(...audioFlags);
      profile.flags.audio = audioFlags.map((flag) => flag.code);
    }
    if (audioPath) profile.work_sample = { ...(profile.work_sample || {}), audio_path: audioPath };

    const rows = scored.rows.map((row) => ({ ...row, candidate_id: id, assessment_version: ASSESSMENT_VERSION }));
    if (workSample) {
      rows.push({
        candidate_id: id,
        item_key: "v3w1",
        item_text: WORK_SAMPLE_PROMPT,
        dimension: "work_sample",
        response: 3,
        reverse_keyed: false,
        assessment_version: ASSESSMENT_VERSION,
        item_type: "work_sample",
        response_data: workSample,
      });
    }
    const { error: re } = await sb.from("hiring_team_assessment_responses").upsert(rows, { onConflict: "candidate_id,item_key" });
    if (re) throw re;
    const { error: pe } = await sb.from("hiring_team_assessment_profiles").upsert(profile, { onConflict: "candidate_id" });
    if (pe) throw pe;

    const candidatePatch: Record<string, string> = { stage: "ready_for_review", updated_at: submittedAt.toISOString() };
    if (audioPath) candidatePatch.audio_path = audioPath;
    const { error: ue } = await sb.from("hiring_candidates").update(candidatePatch).eq("id", id);
    if (ue) throw ue;
    return json(clientCompleteBody());
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, 400);
  }
});
