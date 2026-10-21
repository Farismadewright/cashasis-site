// Deploy with the Supabase CLI so ../_shared is bundled. Do not paste this file
// alone into the dashboard editor. Applicants are written to Supabase only.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildScreening } from "../_shared/hiring-score.js";

const cors = {
  "Access-Control-Allow-Origin": "https://www.cashasis.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers: cors });

  try {
    const origin = req.headers.get("origin") || "";
    if (origin && origin !== "https://www.cashasis.com" && origin !== "https://cashasis.com") {
      return new Response(JSON.stringify({ ok: false, error: "Origin not allowed" }), { status: 403, headers: cors });
    }

    const p = await req.json();
    const fullName = String(p.full_name || "").trim().slice(0, 160);
    const phone = String(p.phone || "").trim().slice(0, 40);
    const email = String(p.email || "").trim().toLowerCase().slice(0, 254);
    const position = String(p.position || "").trim().slice(0, 100);
    if (!fullName || !phone || !email || !position || !email.includes("@")) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), { status: 400, headers: cors });
    }
    const screening = buildScreening(p.screening || {}, new Date());
    if (!screening.ok) {
      return new Response(JSON.stringify({ ok: false, error: screening.error }), { status: 400, headers: cors });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const brand = p.brand === "Neighborly Offer" ? "Neighborly Offer" : "Cash As-Is";

    const { data: candidate, error } = await supabase.from("hiring_candidates").insert({
      brand,
      full_name: fullName,
      first_name: String(p.first_name || "").trim().slice(0, 80) || null,
      last_name: String(p.last_name || "").trim().slice(0, 80) || null,
      phone,
      email,
      city: String(p.city || "").trim().slice(0, 120) || null,
      state: String(p.state || "").trim().slice(0, 80) || null,
      position,
      availability: String(p.availability || "").trim().slice(0, 80) || null,
      experience: String(p.experience || "").trim().slice(0, 80) || null,
      has_transportation: p.has_transportation === true || p.has_transportation === "Yes",
      cover_letter: String(p.cover_letter || "").trim().slice(0, 8000) || null,
      portfolio_link: String(p.portfolio_link || "").trim().slice(0, 1000) || null,
      heard_from: String(p.heard_from || "").trim().slice(0, 300) || null,
      resume_link: String(p.resume_link || "").trim().slice(0, 1000) || null,
      screening: screening.value,
      source: "cashasis-careers",
      stage: "questionnaire_pending",
    }).select("id,position,brand").single();

    if (error) {
      if (error.code === "23505") {
        return new Response(JSON.stringify({ ok: false, error: "An application for this email and position is already on file." }), { status: 409, headers: cors });
      }
      throw error;
    }

    if (p.resume_data_url && p.resume_filename) {
      const match = String(p.resume_data_url).match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        if (!allowed.includes(mime)) throw new Error("Unsupported resume type");
        const raw = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        if (raw.byteLength > 10 * 1024 * 1024) throw new Error("Resume exceeds 10 MB");
        const safe = String(p.resume_filename).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160);
        const resumePath = `${candidate.id}/${safe}`;
        const up = await supabase.storage.from("hiring-resumes").upload(resumePath, raw, { contentType: mime, upsert: false });
        if (up.error) throw up.error;
        await supabase.from("hiring_candidates").update({ resume_path: resumePath }).eq("id", candidate.id);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      candidate_id: candidate.id,
      next: "questionnaire",
      position: candidate.position,
      brand: candidate.brand,
    }), { status: 200, headers: cors });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Submission failed";
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: cors });
  }
});
