import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  acquisitionsApplicantCopy,
  acquisitionsFit,
  buildScreening,
  buildStoredProfile,
  clientCompleteBody,
  isLegacyWeightedPayload,
  profileLabel,
  publicBank,
  scoreAssessment,
  scoreWorkSample,
  stageAfterQuestionnaire,
  timingFrom,
} from "../supabase/functions/_shared/hiring-score.js";

const BANNED = /\b(negotiate|negotiating|negotiation|agent|agents|represent|representing|representation|personality)\b/i;

function answersFor(position, checkValue = 3, attention = 2) {
  const bank = publicBank();
  const role = bank.roles[position] || bank.roles.Acquisitions;
  const answers = [];
  for (const item of bank.forced) answers.push({ key: item.key, most: "a", least: "d", d: "initiative", w: { initiative: 99 } });
  for (const item of [...bank.scenarios, ...role]) answers.push({ key: item.key, choice: "a", w: { initiative: 99 } });
  for (const item of bank.checks) answers.push({ key: item.key, value: checkValue, reverse: false, d: "social" });
  answers.push({ key: bank.attention.key, value: attention });
  return answers;
}

function walkKeys(value, keys = []) {
  if (Array.isArray(value)) value.forEach((entry) => walkKeys(entry, keys));
  else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key);
      walkKeys(entry, keys);
    }
  }
  return keys;
}

test("public bank has prompts only and matches the checked-in file", () => {
  const bank = publicBank();
  const checkedIn = JSON.parse(readFileSync(new URL("../public/careers/team-assessment/bank.json", import.meta.url)));
  assert.deepEqual(checkedIn, bank);
  const keys = new Set(walkKeys(bank));
  for (const secret of ["dimension", "weights", "reverse", "profile_label", "expected", "d", "w"]) {
    assert.equal(keys.has(secret), false, secret);
  }
  assert.equal(bank.forced.length, 8);
  assert.equal(bank.scenarios.length, 4);
  assert.equal(bank.checks.length, 8);
  assert.equal(bank.roles.Acquisitions.length, 3);
  assert.equal(JSON.stringify(bank).includes("The Hunter"), false);
  assert.equal(JSON.stringify(bank).includes("personality"), false);
});

test("server scoring ignores client weights and locks the v3 formula", () => {
  const tainted = answersFor("Acquisitions");
  const clean = tainted.map(({ d, w, reverse, ...rest }) => rest);
  const a = scoreAssessment("Acquisitions", tainted);
  const b = scoreAssessment("Acquisitions", clean);
  assert.equal(a.ok, true);
  assert.deepEqual(a.scores, b.scores);
  assert.deepEqual(a.scores, {
    initiative: 68,
    persistence: 56,
    social: 69,
    assertiveness: 71,
    conscientiousness: 45,
    process: 56,
    self_direction: 69,
    adaptability: 67,
    composure: 69,
  });
  assert.equal(a.profile_label, "The Connector");
  assert.equal(profileLabel(a.scores), a.profile_label);
  assert.equal(a.quality.attention_check_failed, false);
  assert.equal(a.quality.consistency_flags, 0);
  const forced = a.rows.find((row) => row.item_type === "forced_choice");
  assert.deepEqual(Object.keys(forced.response_data.options[0]).sort(), ["id", "text"]);
  assert.equal(JSON.stringify(forced.response_data).includes("weights"), false);
});

test("opposite consistency pairs flag disagreement and ignore matched reverse answers", () => {
  const consistent = answersFor("Acquisitions");
  const bank = publicBank();
  for (const row of consistent) {
    if (row.key === "v3k1") row.value = 1;
    if (row.key === "v3k5") row.value = 5;
  }
  assert.equal(scoreAssessment("Acquisitions", consistent).quality.consistency_flags, 0);
  const inconsistent = answersFor("Acquisitions", 5, 2);
  const scored = scoreAssessment("Acquisitions", inconsistent);
  assert.equal(scored.quality.consistency_flags, 4);
  assert.equal(bank.checks.length, 8);
});

test("attention miss is stored and does not reject the submission", () => {
  const scored = scoreAssessment("Field Agent", answersFor("Field Agent", 3, 5));
  assert.equal(scored.ok, true);
  assert.equal(scored.quality.attention_check_failed, true);
  assert.equal(scored.rows.find((row) => row.item_type === "attention").response, 5);
});

test("another position's items are not accepted", () => {
  const answers = answersFor("Acquisitions");
  assert.equal(scoreAssessment("Field Agent", answers).ok, false);
});

test("legacy weighted payloads are recognized and not scored", () => {
  assert.equal(isLegacyWeightedPayload({ forced: [{ most: "a", options: [{ d: "social", w: { social: 3 } }] }] }), true);
  assert.equal(isLegacyWeightedPayload({ answers: answersFor("Acquisitions") }), false);
});

test("screening flags never become a rejection", () => {
  const now = new Date("2026-10-21T18:00:00Z");
  const flagged = buildScreening({
    commission_1099: "no",
    calling_4h: "no",
    hours_per_week: "10_19",
    earliest_start: "2026-12-01",
    houston_area: "no",
  }, now);
  assert.equal(flagged.ok, true);
  assert.equal(flagged.reject, undefined);
  assert.deepEqual(flagged.value.flags.map((flag) => flag.code), [
    "commission_1099_not_ok",
    "calling_under_4h",
    "limited_weekly_hours",
    "not_houston_area",
    "start_more_than_14_days",
  ]);
  const clear = buildScreening({
    commission_1099: "yes",
    calling_4h: "yes",
    hours_per_week: "40_plus",
    earliest_start: "2026-10-25",
    houston_area: "yes",
  }, now);
  assert.equal(clear.ok, true);
  assert.deepEqual(clear.value.flags, []);
  assert.equal(buildScreening({ commission_1099: "maybe" }, now).ok, false);
});

test("work sample rubric scores a direct reply and a handling description", () => {
  const strong = scoreWorkSample("I understand this is disappointing. What were you hoping for?");
  assert.equal(strong.ok, true);
  assert.equal(strong.value.score, 4);
  assert.deepEqual(strong.value.points, { calm: 1, curious: 1, empathetic: 1, not_pushy: 1 });
  assert.match(strong.value.prompt, /Write what you'd say back, or how you'd handle this response\./);
  const handling = scoreWorkSample("I would listen first and find out the reason they are disappointed, without any pressure.");
  assert.equal(handling.ok, true);
  assert.equal(handling.value.score, 4);
  assert.deepEqual(handling.value.points, { calm: 1, curious: 1, empathetic: 1, not_pushy: 1 });
  const described = scoreWorkSample("I'd stay calm, acknowledge their feelings, and ask about the number they had in mind.");
  assert.equal(described.value.score, 4);
  const pushy = scoreWorkSample("This is the final offer. Take it or leave it!!");
  assert.equal(pushy.ok, true);
  assert.equal(pushy.value.score, 0);
  assert.deepEqual(pushy.value.points, { calm: 0, curious: 0, empathetic: 0, not_pushy: 0 });
  assert.equal(scoreWorkSample("too short").ok, false);
  const pasted = scoreWorkSample("I hear you. What feels off about that number?", true);
  assert.equal(pasted.value.pasted, true);
  assert.equal(pasted.value.score, 4);
  assert.ok(pasted.value.flags.includes("likely_pasted"));
});

test("acquisitions fit is internal, clamped, and lower when flags fire", () => {
  const scored = scoreAssessment("Acquisitions", answersFor("Acquisitions"));
  const screening = buildScreening({
    commission_1099: "yes",
    calling_4h: "yes",
    hours_per_week: "40_plus",
    earliest_start: "2026-10-25",
    houston_area: "yes",
  }, new Date("2026-10-21T18:00:00Z")).value;
  const work = scoreWorkSample("I understand this is disappointing. What were you hoping for?").value;
  const timing = timingFrom("2026-10-21T18:00:00Z", "2026-10-21T18:10:00Z", 600000);
  assert.equal(timing.too_fast, false);
  const fit = acquisitionsFit({ scores: scored.scores, screening, workSample: work, quality: scored.quality, tooFast: false });
  assert.equal(fit.components.acquisitions_pattern, 64);
  assert.equal(fit.score, 75);
  const fast = timingFrom("2026-10-21T18:00:00Z", "2026-10-21T18:01:00Z", 60000);
  assert.equal(fast.too_fast, true);
  const stored = buildStoredProfile({
    candidateId: "00000000-0000-4000-8000-000000000000",
    scored: { ...scored, quality: { ...scored.quality, attention_check_failed: true } },
    screening,
    workSample: work,
    timing: fast,
    position: "Acquisitions",
    completedAt: fast.submitted_at,
  });
  assert.equal(stored.acquisitions_fit, 50);
  assert.equal(stored.flags.attention_check_failed, true);
  assert.equal(stored.flags.finished_too_fast, true);
  assert.ok(stored.interview_questions.length >= 1);
  assert.ok(stored.interview_questions.length <= 8);
  assert.equal(stored.profile_label, "The Connector");
  const body = JSON.stringify(clientCompleteBody());
  assert.equal(body.includes("Connector"), false);
  assert.equal(body.includes("Hunter"), false);
  assert.deepEqual(clientCompleteBody(), { ok: true, next: "complete" });
});

test("questionnaire completion waits for the assessment and does not revive Predictive Index", () => {
  assert.equal(stageAfterQuestionnaire("questionnaire_pending"), "assessment_pending");
  assert.equal(stageAfterQuestionnaire("pi_pending"), "assessment_pending");
  assert.equal(stageAfterQuestionnaire("ready_for_review"), "ready_for_review");
  assert.equal(stageAfterQuestionnaire("hired"), "hired");
  assert.notEqual(stageAfterQuestionnaire("questionnaire_pending"), "pi_pending");
  assert.notEqual(stageAfterQuestionnaire("questionnaire_pending"), "ready_for_review");
});

test("acquisitions applicant copy avoids banned role words", () => {
  for (const line of acquisitionsApplicantCopy()) assert.equal(BANNED.test(line), false, line);
});

test("career pages keep the assessment name and do not show internal labels", () => {
  const careers = readFileSync(new URL("../public/careers/index.html", import.meta.url), "utf8");
  const questionnaire = readFileSync(new URL("../public/careers/questionnaire/index.html", import.meta.url), "utf8");
  const assessment = readFileSync(new URL("../public/careers/team-assessment/index.html", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../public/hiring/index.html", import.meta.url), "utf8");
  const applicant = `${careers}\n${questionnaire}\n${assessment}`;
  assert.match(careers, /Team & Position Assessment/);
  assert.doesNotMatch(applicant, /behavioral assessment/i);
  assert.doesNotMatch(applicant, /personality test/i);
  assert.doesNotMatch(applicant, /The Hunter|The Connector|The Operator|The Closer|The Builder|Balanced Contributor/);
  assert.match(careers, /id="role-acquisitions-copy"/);
  const acq = careers.match(/id="role-acquisitions-copy"[^>]*>([^<]+)/)[1];
  assert.equal(BANNED.test(acq), false, acq);
  const questions = questionnaire.match(/'Acquisitions':\[([\s\S]*?)\n\]/)[1];
  assert.equal(BANNED.test(questions), false, questions);
  assert.match(assessment, /bank\.json/);
  assert.doesNotMatch(assessment, /initiative:\d|weights|self_direction/);
  assert.match(dashboard, /Hiring Dashboard/);
  assert.doesNotMatch(dashboard, /acquisitions_fit|interview_questions|screening/);
});
