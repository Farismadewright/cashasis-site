/**
 * Server-side hiring assessment bank and scoring.
 * Applicant pages must never receive dimension tags, weights, reverse keys,
 * or internal profile labels. The browser sends item ids and selected choices only.
 *
 * Dimension math matches the previous Team & Position Assessment (v2):
 * - Forced choice: MOST +2, LEAST -1, and every statement adds 2 to that dimension's possible.
 * - Scenarios: the chosen option's weights are added, and each weighted dimension adds 3 to possible.
 * - Consistency items: (scored - 3) is added, reverse items flipped, and possible increases by 2.
 * - Dimension score: clamp 0..100 of round(50 + points / max(8, possible) * 50).
 * Existing stored v1/v2 rows are not rewritten. New submissions use assessment_version 3
 * and v3 item keys so older response rows stay in place.
 */

export const ASSESSMENT_VERSION = 3;
export const DIMENSIONS = [
  "initiative",
  "persistence",
  "social",
  "assertiveness",
  "conscientiousness",
  "process",
  "self_direction",
  "adaptability",
  "composure",
];

export const WORK_SAMPLE_PROMPT =
  'A homeowner texts you: "That\'s way lower than I expected." Write what you\'d say back, or how you\'d handle this response. No real estate experience is needed.';
export const VOICE_PROMPT =
  "Optional: record up to 60 seconds introducing yourself to a homeowner who asked about selling. You can skip this. No real estate experience is needed.";

const HOURS = new Set(["under_10", "10_19", "20_29", "30_39", "40_plus"]);
const YES_NO = new Set(["yes", "no"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const TOO_FAST_SECONDS = 180;
const START_FLAG_DAYS = 14;

const forced = [
  ["v3f1", [
    ["a", "I naturally start conversations and build relationships.", "social"],
    ["b", "I keep pushing when progress is slower than expected.", "persistence"],
    ["c", "I make sure details and follow-ups do not get missed.", "process"],
    ["d", "I act on opportunities without needing much prompting.", "initiative"],
  ]],
  ["v3f2", [
    ["a", "I stay calm when conversations become difficult.", "composure"],
    ["b", "I am comfortable taking the lead in a discussion.", "assertiveness"],
    ["c", "I adjust quickly when circumstances change.", "adaptability"],
    ["d", "I stay productive without someone checking on me.", "self_direction"],
  ]],
  ["v3f3", [
    ["a", "I enjoy meeting and talking with new people.", "social"],
    ["b", "I reliably finish commitments I make.", "conscientiousness"],
    ["c", "I create momentum when there is no obvious next step.", "initiative"],
    ["d", "I can keep working a lead after several setbacks.", "persistence"],
  ]],
  ["v3f4", [
    ["a", "I like keeping records and next steps organized.", "process"],
    ["b", "I can ask directly for a decision when the time is right.", "assertiveness"],
    ["c", "I recover quickly from rejection.", "composure"],
    ["d", "I find another approach when the first one fails.", "adaptability"],
  ]],
  ["v3f5", [
    ["a", "I set my own priorities and get moving.", "self_direction"],
    ["b", "I build rapport quickly with different personalities.", "social"],
    ["c", "I notice unfinished responsibilities and close the loop.", "conscientiousness"],
    ["d", "I pursue worthwhile opportunities proactively.", "initiative"],
  ]],
  ["v3f6", [
    ["a", "I stay with important goals for a long time.", "persistence"],
    ["b", "I am comfortable respectfully challenging someone.", "assertiveness"],
    ["c", "I keep a clear system for people I need to follow up with.", "process"],
    ["d", "I remain level-headed under pressure.", "composure"],
  ]],
  ["v3f7", [
    ["a", "I adapt my communication to the person in front of me.", "adaptability"],
    ["b", "I can work independently for long stretches.", "self_direction"],
    ["c", "I enjoy frequent interaction throughout my day.", "social"],
    ["d", "I follow through even on tasks nobody is checking.", "conscientiousness"],
  ]],
  ["v3f8", [
    ["a", "I look for productive work instead of waiting for assignments.", "initiative"],
    ["b", "I keep trying after hearing no.", "persistence"],
    ["c", "I am comfortable guiding a conversation toward a decision.", "assertiveness"],
    ["d", "I keep information organized so others can rely on it.", "process"],
  ]],
];

const scenarios = [
  ["v3s1", "You finish your planned work earlier than expected. What are you most likely to do?", [
    ["a", "Review active opportunities and choose useful follow-up to advance.", { initiative: 3, self_direction: 2 }],
    ["b", "Clean up records and make sure every next step is documented.", { process: 3, conscientiousness: 2 }],
    ["c", "Reach out to people and create additional conversations.", { social: 2, initiative: 2 }],
    ["d", "Review recent results and adjust tomorrow's plan.", { adaptability: 2, self_direction: 2 }],
  ]],
  ["v3s2", "A prospect has been polite but noncommittal after several conversations. What feels most natural?", [
    ["a", "Ask a direct question to understand what is preventing a decision.", { assertiveness: 3, social: 1 }],
    ["b", "Keep a thoughtful follow-up cadence and stay patient.", { persistence: 3, process: 1 }],
    ["c", "Try a different communication angle based on what you have learned.", { adaptability: 3, social: 1 }],
    ["d", "Make sure the notes and next action are clear before moving on.", { process: 3, conscientiousness: 1 }],
  ]],
  ["v3s3", "You have a difficult conversation and the other person becomes irritated. What do you tend to do?", [
    ["a", "Stay calm and focus on understanding the concern.", { composure: 3, social: 1 }],
    ["b", "Address the issue directly while staying respectful.", { assertiveness: 3, composure: 1 }],
    ["c", "Change the approach and see whether another angle works better.", { adaptability: 3, composure: 1 }],
    ["d", "Give the situation some space and follow up at an appropriate time.", { persistence: 2, process: 2 }],
  ]],
  ["v3s4", "You have several follow-ups due and a new opportunity appears. What do you naturally prioritize?", [
    ["a", "Handle the time-sensitive new opportunity, then return to the list.", { adaptability: 2, initiative: 2 }],
    ["b", "Work the committed follow-ups first unless the new item is truly urgent.", { conscientiousness: 3, process: 2 }],
    ["c", "Quickly rank everything by potential impact and work from the top.", { self_direction: 3, initiative: 1 }],
    ["d", "Contact the people most likely to respond and build momentum.", { social: 2, assertiveness: 1 }],
  ]],
];

const roles = {
  "Field Agent": [
    ["v3rf1", "You knock on a door and the homeowner seems skeptical about why you are there. What feels most natural?", [
      ["a", "Introduce myself simply, acknowledge the interruption, and ask a low-pressure question.", { social: 3, composure: 1 }],
      ["b", "Be direct about why I am there and quickly determine whether there is interest.", { assertiveness: 3, initiative: 1 }],
      ["c", "Read their reaction and adjust my tone before asking anything further.", { adaptability: 3, social: 1 }],
      ["d", "Respect the hesitation, leave a clear way to reconnect, and document the follow-up.", { process: 2, persistence: 2 }],
    ]],
    ["v3rf2", "You have been knocking for an hour with very few conversations. What do you naturally do?", [
      ["a", "Keep going and focus on completing the activity I committed to.", { persistence: 3, conscientiousness: 1 }],
      ["b", "Change my opening or approach and test whether response improves.", { adaptability: 3, initiative: 1 }],
      ["c", "Review the route and move toward the highest-priority properties.", { self_direction: 3, process: 1 }],
      ["d", "Reset my energy and make the next interaction feel like the first one.", { composure: 3, social: 1 }],
    ]],
    ["v3rf3", "You meet a homeowner who is not ready to talk but may be interested later. What do you do?", [
      ["a", "Ask permission for a specific follow-up and record it immediately.", { process: 3, conscientiousness: 2 }],
      ["b", "Try to understand one useful detail before ending the conversation.", { social: 2, assertiveness: 2 }],
      ["c", "Leave the door open and make sure they feel comfortable reconnecting.", { social: 3, composure: 1 }],
      ["d", "Set a follow-up and continue working the rest of the area.", { persistence: 2, self_direction: 2 }],
    ]],
  ],
  Acquisitions: [
    ["v3ra1", "A homeowner is interested but says they need time to think. What feels most natural?", [
      ["a", "Ask what specifically they still need to think through.", { assertiveness: 3, social: 1 }],
      ["b", "Agree on a specific follow-up time and keep the relationship moving.", { process: 2, persistence: 2 }],
      ["c", "Revisit what they want and make sure the conversation still addresses it.", { social: 2, adaptability: 2 }],
      ["d", "Give them room while writing down what matters for the next conversation.", { composure: 2, conscientiousness: 2 }],
    ]],
    ["v3ra2", "Several homeowners are due for follow-up and a new person wants to talk. What do you do?", [
      ["a", "Quickly judge what is most urgent and reorder the day.", { self_direction: 3, adaptability: 1 }],
      ["b", "Respond to the new person quickly, then return to the follow-ups you already promised.", { initiative: 2, conscientiousness: 2 }],
      ["c", "Stick to the follow-up list unless the new person truly needs you right now.", { process: 3, conscientiousness: 1 }],
      ["d", "Make contact right away because a timely reply matters.", { initiative: 2, social: 2 }],
    ]],
    ["v3ra3", "A homeowner strongly disagrees with the number you shared. What is your first instinct?", [
      ["a", "Ask questions to understand what is driving the reaction.", { social: 2, composure: 2 }],
      ["b", "Go back to what they want and see whether another path still helps.", { adaptability: 3, social: 1 }],
      ["c", "Explain the reasoning clearly and ask what would help the conversation continue.", { assertiveness: 3, composure: 1 }],
      ["d", "Keep the relationship intact and set a thoughtful follow-up.", { persistence: 3, process: 1 }],
    ]],
  ],
  "Virtual Closer": [
    ["v3rv1", "An offer was sent two days ago and the seller has not responded. What feels most natural?", [
      ["a", "Call with a direct but low-pressure question about what is holding things up.", { assertiveness: 3, persistence: 1 }],
      ["b", "Use a planned call and text sequence and continue until there is clarity.", { process: 2, persistence: 3 }],
      ["c", "Change the message angle to make it easier for the seller to respond.", { adaptability: 3, social: 1 }],
      ["d", "Review the prior conversation first so the follow-up is highly relevant.", { conscientiousness: 2, social: 2 }],
    ]],
    ["v3rv2", "The seller wants a price above what you are allowed to offer. What do you do?", [
      ["a", "Explore the reasons behind the number and stay within the approved range.", { assertiveness: 3, composure: 1 }],
      ["b", "Look for concerns other than price that may open another path.", { adaptability: 3, social: 1 }],
      ["c", "Clearly explain the limit and escalate only when there is a justified reason.", { process: 2, conscientiousness: 2 }],
      ["d", "Keep the conversation moving without promising something you cannot authorize.", { composure: 2, persistence: 2 }],
    ]],
    ["v3rv3", "A seller seems close to signing but wants to see the property with someone first. What do you do?", [
      ["a", "Set a clear local appointment and define what happens immediately afterward.", { process: 2, initiative: 2 }],
      ["b", "Ask what they hope the visit will resolve so the appointment has a purpose.", { social: 2, assertiveness: 2 }],
      ["c", "Coordinate the appointment quickly and keep ownership of the follow-up.", { conscientiousness: 2, self_direction: 2 }],
      ["d", "Confirm the concern, schedule the visit, and keep momentum without pressure.", { composure: 2, persistence: 2 }],
    ]],
  ],
};

const checks = [
  ["v3k1", "I sometimes need a reminder for something I intended to finish.", "conscientiousness", true],
  ["v3k2", "I can stay productive when nobody is checking on me.", "self_direction", false],
  ["v3k3", "Rejection can occasionally affect my energy.", "composure", true],
  ["v3k4", "I enjoy initiating conversations with people I do not know.", "social", false],
  ["v3k5", "I usually remember every commitment without any system or reminder.", "conscientiousness", false],
  ["v3k6", "I occasionally work better when expectations are clearly reinforced.", "self_direction", true],
  ["v3k7", "A difficult interaction rarely affects me at all.", "composure", false],
  ["v3k8", "I sometimes prefer familiar people over starting conversations with strangers.", "social", true],
];

function mapForced(row) {
  return {
    key: row[0],
    type: "forced",
    options: row[1].map(([id, text, dimension]) => ({ id, text, dimension })),
  };
}
function mapScenario(row) {
  return {
    key: row[0],
    type: "scenario",
    prompt: row[1],
    options: row[2].map(([id, text, weights]) => ({ id, text, weights })),
  };
}

const forcedItems = forced.map(mapForced);
const scenarioItems = scenarios.map(mapScenario);
const roleItems = Object.fromEntries(Object.entries(roles).map(([role, rows]) => [role, rows.map(mapScenario)]));
const checkItems = checks.map(([key, text, dimension, reverse]) => ({ key, type: "check", text, dimension, reverse }));
const attentionItem = {
  key: "v3a1",
  type: "attention",
  text: "For this question, choose Disagree.",
  expected: 2,
};

const byKey = new Map();
for (const item of [...forcedItems, ...scenarioItems, ...Object.values(roleItems).flat(), ...checkItems, attentionItem]) {
  byKey.set(item.key, item);
}

export function roleForPosition(position) {
  if (roleItems[position]) return position;
  return "Acquisitions";
}

export function requiredItems(position) {
  const role = roleForPosition(position);
  return [...forcedItems, ...scenarioItems, ...roleItems[role], ...checkItems, attentionItem];
}

export function publicBank() {
  const stripScenario = (item) => ({
    key: item.key,
    prompt: item.prompt,
    options: item.options.map((opt) => ({ id: opt.id, text: opt.text })),
  });
  return {
    version: ASSESSMENT_VERSION,
    forced: forcedItems.map((item) => ({
      key: item.key,
      options: item.options.map((opt) => ({ id: opt.id, text: opt.text })),
    })),
    scenarios: scenarioItems.map(stripScenario),
    roles: Object.fromEntries(Object.entries(roleItems).map(([role, items]) => [role, items.map(stripScenario)])),
    checks: checkItems.map((item) => ({ key: item.key, text: item.text })),
    attention: {
      key: attentionItem.key,
      text: attentionItem.text,
      scale: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
    },
    work_sample_prompt: WORK_SAMPLE_PROMPT,
    voice_prompt: VOICE_PROMPT,
  };
}

export function acquisitionsApplicantCopy() {
  const bank = publicBank();
  const lines = [WORK_SAMPLE_PROMPT, VOICE_PROMPT];
  for (const item of bank.roles.Acquisitions) {
    lines.push(item.prompt);
    for (const opt of item.options) lines.push(opt.text);
  }
  return lines;
}

function blankPoints() {
  const pts = {};
  const possible = {};
  for (const d of DIMENSIONS) {
    pts[d] = 0;
    possible[d] = 0;
  }
  return { pts, possible };
}

function addWeights(target, possible, weights) {
  for (const [dimension, value] of Object.entries(weights || {})) {
    if (!DIMENSIONS.includes(dimension)) continue;
    possible[dimension] += 3;
    target[dimension] += Number(value);
  }
}

export function isLegacyWeightedPayload(body) {
  return Boolean(body && (Array.isArray(body.forced) || Array.isArray(body.situational) || Array.isArray(body.checks) || Array.isArray(body.role_situational)));
}

export function normalizeAnswers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => ({
    key: String(row?.key || ""),
    most: row?.most ? String(row.most) : "",
    least: row?.least ? String(row.least) : "",
    choice: row?.choice ? String(row.choice) : "",
    value: row?.value == null || row.value === "" ? null : Number(row.value),
  }));
}

export function scoreAssessment(position, rawAnswers) {
  const answers = normalizeAnswers(rawAnswers);
  const answerMap = new Map();
  for (const answer of answers) {
    if (!answer.key || answerMap.has(answer.key)) {
      return { ok: false, error: "Invalid answer list" };
    }
    answerMap.set(answer.key, answer);
  }
  const items = requiredItems(position);
  const requiredKeys = new Set(items.map((item) => item.key));
  for (const item of items) {
    if (!answerMap.has(item.key)) return { ok: false, error: "Incomplete assessment" };
  }
  for (const key of answerMap.keys()) {
    if (!requiredKeys.has(key)) return { ok: false, error: "Unknown item" };
  }

  const { pts, possible } = blankPoints();
  const rows = [];
  let perfect = 0;
  const checkMap = {};

  for (const item of items) {
    const answer = answerMap.get(item.key);
    if (item.type === "forced") {
      const ids = new Set(item.options.map((opt) => opt.id));
      if (!ids.has(answer.most) || !ids.has(answer.least) || answer.most === answer.least) {
        return { ok: false, error: "Invalid comparison" };
      }
      for (const opt of item.options) {
        possible[opt.dimension] += 2;
        if (opt.id === answer.most) pts[opt.dimension] += 2;
        if (opt.id === answer.least) pts[opt.dimension] -= 1;
      }
      rows.push({
        item_key: item.key,
        item_text: "Which statement is most like you, and which is least like you?",
        dimension: "forced_choice",
        response: 3,
        reverse_keyed: false,
        item_type: "forced_choice",
        response_data: {
          most: answer.most,
          least: answer.least,
          options: item.options.map((opt) => ({ id: opt.id, text: opt.text })),
        },
      });
    } else if (item.type === "scenario") {
      const chosen = item.options.find((opt) => opt.id === answer.choice);
      if (!chosen) return { ok: false, error: "Invalid scenario choice" };
      addWeights(pts, possible, chosen.weights);
      rows.push({
        item_key: item.key,
        item_text: item.prompt,
        dimension: item.key.startsWith("v3r") ? "role_situational" : "situational",
        response: 3,
        reverse_keyed: false,
        item_type: item.key.startsWith("v3r") ? "role_situational" : "situational",
        response_data: {
          choice: answer.choice,
          choice_text: chosen.text,
          role: item.key.startsWith("v3r") ? roleForPosition(position) : null,
        },
      });
    } else if (item.type === "check") {
      const value = answer.value;
      if (!Number.isInteger(value) || value < 1 || value > 5) return { ok: false, error: "Invalid check" };
      const scored = item.reverse ? 6 - value : value;
      pts[item.dimension] += scored - 3;
      possible[item.dimension] += 2;
      if ((value === 5 && !item.reverse) || (value === 1 && item.reverse)) perfect += 1;
      checkMap[item.key] = value;
      rows.push({
        item_key: item.key,
        item_text: item.text,
        dimension: item.dimension,
        response: value,
        reverse_keyed: item.reverse,
        item_type: "consistency",
        response_data: { value },
      });
    } else if (item.type === "attention") {
      const value = answer.value;
      if (!Number.isInteger(value) || value < 1 || value > 5) return { ok: false, error: "Invalid attention check" };
      rows.push({
        item_key: item.key,
        item_text: item.text,
        dimension: "attention",
        response: value,
        reverse_keyed: false,
        item_type: "attention",
        response_data: { value, expected: item.expected, passed: value === item.expected },
      });
    }
  }

  const pairs = [
    ["v3k1", "v3k5"],
    ["v3k2", "v3k6"],
    ["v3k3", "v3k7"],
    ["v3k4", "v3k8"],
  ];
  let contradictions = 0;
  for (const [left, right] of pairs) {
    if (checkMap[left] && checkMap[right]) {
      const diff = Math.abs(checkMap[left] + checkMap[right] - 6);
      if (diff >= 3) contradictions += 1;
    }
  }

  const scores = {};
  for (const dimension of DIMENSIONS) {
    scores[dimension] = Math.max(0, Math.min(100, Math.round(50 + (pts[dimension] / Math.max(8, possible[dimension])) * 50)));
  }
  const attention = rows.find((row) => row.item_type === "attention");
  const quality = {
    uniformly_favorable: perfect >= 6,
    perfect_claims: perfect,
    consistency_flags: contradictions,
    attention_check_failed: attention ? !attention.response_data.passed : true,
    interpretation: perfect >= 6
      ? "Very favorable self-presentation; verify with examples in interview"
      : contradictions >= 2
        ? "Some inconsistent responses; explore in interview"
        : "No major response-style flag",
  };
  return {
    ok: true,
    scores,
    rows,
    quality,
    profile_label: profileLabel(scores),
    role_scenario_set: roleForPosition(position),
  };
}

export function profileLabel(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);
  const top = sorted.slice(0, 4);
  const has = (a, b) => top.includes(a) && top.includes(b);
  if (has("initiative", "persistence")) return "The Hunter";
  if (has("social", "assertiveness")) return "The Connector";
  if (has("conscientiousness", "process")) return "The Operator";
  if (has("persistence", "composure")) return "The Closer";
  if (has("initiative", "self_direction")) return "The Builder";
  return "Balanced Contributor";
}

export function parseStartDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function buildScreening(input, now = new Date()) {
  const source = input && typeof input === "object" ? input : {};
  const commission = String(source.commission_1099 || "");
  const calling = String(source.calling_4h || "");
  const hours = String(source.hours_per_week || "");
  const houston = String(source.houston_area || "");
  const earliest = String(source.earliest_start || "");
  if (!YES_NO.has(commission) || !YES_NO.has(calling) || !YES_NO.has(houston) || !HOURS.has(hours)) {
    return { ok: false, error: "Please answer each practical question" };
  }
  const start = parseStartDate(earliest);
  if (!start) return { ok: false, error: "Please enter a valid earliest start date" };
  const todayStamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const today = parseStartDate(todayStamp).getTime();
  if (start.getTime() < today - 366 * DAY_MS || start.getTime() > today + 366 * 2 * DAY_MS) {
    return { ok: false, error: "Please enter a start date within the next two years" };
  }
  const flags = [];
  if (commission !== "yes") {
    flags.push({ code: "commission_1099_not_ok", label: "Not comfortable with 100% commission as a 1099 independent contractor" });
  }
  if (calling !== "yes") {
    flags.push({ code: "calling_under_4h", label: "Cannot spend 4 or more hours a day calling and texting" });
  }
  if (hours === "under_10" || hours === "10_19") {
    flags.push({ code: "limited_weekly_hours", label: "Fewer than 20 hours a week available" });
  }
  if (houston !== "yes") {
    flags.push({ code: "not_houston_area", label: "Does not live in the Houston area" });
  }
  if (start.getTime() > today + START_FLAG_DAYS * DAY_MS) {
    flags.push({ code: "start_more_than_14_days", label: "Earliest start is more than 14 days out", detail: earliest });
  }
  return {
    ok: true,
    value: {
      commission_1099: commission,
      calling_4h: calling,
      hours_per_week: hours,
      earliest_start: earliest,
      houston_area: houston,
      flags,
    },
  };
}

const PUSHY = /\b(act now|right now|today only|last chance|take it or leave it|final offer|you(?:'ll| will) regret|must decide|have to decide|limited time|sign now|sign today|or else|stupid|idiot)\b/i;
const EMPATHY = /\b(understand|heard you|i hear|sorry|makes sense|appreciate|thanks|thank you|thank|i get it|sounds like|frustrating|disappointing|disappointed|tough|that is hard|that's hard|i can see|acknowledge|acknowledged|acknowledging|acknowledgment|acknowledgement|validate|validated|validating|empathize|empathise|empathy|empathetic|listen|listened|listening|feelings|how they feel|how they're feeling|how they are feeling)\b/i;
const CURIOUS = /\?|\b(what|why|how|which|when|tell me|help me understand|curious|ask|asks|asked|asking|question|questions|find out|wondering|learn more|wanted to know)\b/i;

export function scoreWorkSample(text, pasted = false) {
  const raw = String(text || "").trim();
  if (raw.length < 20 || raw.length > 2000) {
    return { ok: false, error: "Please write at least a sentence: what you'd say back, or how you'd handle this response." };
  }
  const letters = raw.replace(/[^A-Za-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "").length;
  const shouting = letters.length > 12 && upper > letters.length * 0.6;
  const pushy = PUSHY.test(raw);
  const points = {
    calm: !pushy && !shouting && !/!{2,}/.test(raw) ? 1 : 0,
    curious: CURIOUS.test(raw) ? 1 : 0,
    empathetic: EMPATHY.test(raw) ? 1 : 0,
    not_pushy: pushy ? 0 : 1,
  };
  const flags = [];
  if (raw.length < 40) flags.push("very_short");
  if (pasted) flags.push("likely_pasted");
  if (/\b(negotiate|negotiating|agent|represent|representing)\b/i.test(raw)) flags.push("used_role_jargon");
  return {
    ok: true,
    value: {
      prompt: WORK_SAMPLE_PROMPT,
      text: raw,
      pasted: Boolean(pasted),
      score: points.calm + points.curious + points.empathetic + points.not_pushy,
      max: 4,
      points,
      flags,
      rubric: "Simple text check for a calm tone, curiosity, and empathy, with no pressure. A direct reply or a description of how they would handle it can both earn the points. It never accepts or rejects an applicant by itself.",
    },
  };
}

export function rolePattern(scores, role = "Acquisitions") {
  const s = (key) => Number(scores?.[key] || 0);
  const weights = {
    "Field Agent": [["initiative", .24], ["social", .22], ["persistence", .18], ["self_direction", .14], ["composure", .12], ["conscientiousness", .10]],
    Acquisitions: [["initiative", .18], ["social", .17], ["assertiveness", .17], ["persistence", .16], ["adaptability", .12], ["conscientiousness", .10], ["composure", .10]],
    "Virtual Closer": [["persistence", .20], ["assertiveness", .18], ["social", .17], ["composure", .15], ["conscientiousness", .12], ["process", .10], ["adaptability", .08]],
    "Lead Manager": [["conscientiousness", .22], ["process", .22], ["persistence", .16], ["social", .14], ["self_direction", .14], ["composure", .12]],
    Dispositions: [["social", .22], ["assertiveness", .20], ["initiative", .16], ["persistence", .14], ["adaptability", .12], ["process", .08], ["composure", .08]],
    Marketing: [["initiative", .20], ["adaptability", .18], ["self_direction", .16], ["conscientiousness", .16], ["social", .12], ["process", .10], ["persistence", .08]],
  };
  const spec = weights[role] || weights.Acquisitions;
  return Math.round(spec.reduce((sum, [key, weight]) => sum + weight * s(key), 0));
}

export function acquisitionsFit({ scores, screening, workSample, quality, tooFast }) {
  const pattern = rolePattern(scores, "Acquisitions");
  const knownScreening = screening && Array.isArray(screening.flags);
  const screenPct = knownScreening ? Math.round((Math.max(0, 5 - screening.flags.length) / 5) * 100) : null;
  const workPct = workSample ? Math.round((Number(workSample.score) / 4) * 100) : null;
  let score;
  if (workSample && screenPct != null) score = Math.round(0.7 * pattern + 0.2 * workPct + 0.1 * screenPct);
  else if (workSample) score = Math.round(0.8 * pattern + 0.2 * workPct);
  else if (screenPct != null) score = Math.round(0.85 * pattern + 0.15 * screenPct);
  else score = pattern;
  const penalties = [];
  if (quality?.attention_check_failed) {
    score -= 15;
    penalties.push({ code: "attention_check_failed", points: 15 });
  }
  if (tooFast) {
    score -= 10;
    penalties.push({ code: "finished_too_fast", points: 10 });
  }
  if (quality?.uniformly_favorable) {
    score -= 5;
    penalties.push({ code: "uniformly_favorable", points: 5 });
  }
  const consistency = Math.min(2, Number(quality?.consistency_flags || 0));
  if (consistency) {
    score -= consistency * 5;
    penalties.push({ code: "consistency_flags", points: consistency * 5 });
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    components: {
      acquisitions_pattern: pattern,
      work_sample_pct: workPct,
      screening_pct: screenPct,
      penalties,
    },
  };
}

export function timingFrom(startedAt, submittedAt, clientElapsedMs) {
  const submitted = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
  let duration = null;
  let source = "missing_start";
  if (startedAt) {
    const started = startedAt instanceof Date ? startedAt : new Date(startedAt);
    if (!Number.isNaN(started.getTime())) {
      duration = Math.max(0, Math.round((submitted.getTime() - started.getTime()) / 1000));
      source = "server";
    }
  }
  const clientSeconds = Number.isFinite(Number(clientElapsedMs)) ? Math.max(0, Math.round(Number(clientElapsedMs) / 1000)) : null;
  if (duration == null && clientSeconds != null) {
    duration = clientSeconds;
    source = "client_unverified";
  }
  return {
    started_at: startedAt ? new Date(startedAt).toISOString() : null,
    submitted_at: submitted.toISOString(),
    duration_seconds: duration,
    client_elapsed_seconds: clientSeconds,
    too_fast: duration != null && duration < TOO_FAST_SECONDS,
    timing_source: source,
    threshold_seconds: TOO_FAST_SECONDS,
  };
}

const DIMENSION_NAMES = {
  initiative: "initiative and self-starting",
  persistence: "persistence",
  social: "social confidence",
  assertiveness: "assertiveness",
  conscientiousness: "follow-through",
  process: "keeping follow-ups organized",
  self_direction: "independent work",
  adaptability: "adaptability",
  composure: "composure under pressure",
};

export function interviewQuestions({ scores, position, quality, screening, workSample, tooFast }) {
  const questions = [];
  const ranked = Object.entries(scores || {}).sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);
  const high = ranked.slice(0, 2);
  const low = [...ranked].reverse().slice(0, 2);
  for (const dimension of high) {
    const name = DIMENSION_NAMES[dimension] || dimension;
    questions.push({
      area: name,
      reason: "Verify a strongly reported tendency with a concrete example.",
      question: `Tell me about a specific time your ${name} materially affected a result. What did you personally do, and what happened?`,
    });
  }
  for (const dimension of low) {
    const name = DIMENSION_NAMES[dimension] || dimension;
    questions.push({
      area: name,
      reason: "Explore a comparatively lower preference and how the candidate manages it.",
      question: `Tell me about a situation where ${name} was especially important. What was difficult about it, and how did you handle it?`,
    });
  }
  if (position === "Virtual Closer") {
    questions.push({
      area: "closing evidence",
      reason: "This role requires prior closing experience.",
      question: "Walk me through a difficult deal you personally closed: where it came from, the objections, the follow-up timeline, and what you did that changed the outcome.",
    });
  } else if (position === "Field Agent") {
    questions.push({
      area: "field initiative",
      reason: "Field work requires self-directed prospecting and rejection resilience.",
      question: "Imagine you have been in the field for two hours with almost no conversations. What would you actually do for the next two hours?",
    });
  } else {
    questions.push({
      area: "pipeline ownership",
      reason: "Acquisitions requires consistent homeowner follow-up.",
      question: "Tell me about a pipeline or book of business you personally built, or how you would build one from scratch. What would a normal day of calls, texts, and follow-up look like?",
    });
  }
  if (quality?.uniformly_favorable || Number(quality?.consistency_flags) > 0 || quality?.attention_check_failed || tooFast) {
    const reasons = [];
    if (quality?.uniformly_favorable) reasons.push("very favorable self-presentation");
    if (Number(quality?.consistency_flags) > 0) reasons.push(`${quality.consistency_flags} inconsistent answer pair${quality.consistency_flags === 1 ? "" : "s"}`);
    if (quality?.attention_check_failed) reasons.push("missed the attention check");
    if (tooFast) reasons.push("finished the assessment very quickly");
    questions.push({
      area: "response verification",
      reason: reasons.join("; ") || quality?.interpretation || "Response pattern should be verified.",
      question: "Give me an example of a work habit you have had to improve. What was happening, and what did you change?",
    });
  }
  for (const flag of screening?.flags || []) {
    questions.push({
      area: flag.code,
      reason: flag.label,
      question: `You noted: ${flag.label}. What would need to be true for this work to be realistic for you right now?`,
    });
  }
  if (workSample) {
    const excerpt = String(workSample.text || "").slice(0, 240);
    questions.push({
      area: "homeowner text",
      reason: `Work-sample rubric ${workSample.score}/4. Internal only; not an automatic decision.`,
      question: `Walk through the text you wrote to the homeowner who said the number was lower than they expected. What were you trying to do? Their text: "${excerpt}"`,
    });
  }
  return questions.slice(0, 8);
}

export function stageAfterQuestionnaire(currentStage) {
  const early = new Set([
    "application_submitted",
    "questionnaire_pending",
    "questionnaire_completed",
    "pi_pending",
    "pi_completed",
    "assessment_pending",
  ]);
  if (early.has(currentStage)) return "assessment_pending";
  return currentStage;
}

export function clientCompleteBody() {
  return { ok: true, next: "complete" };
}

export function buildStoredProfile({ candidateId, scored, screening, workSample, timing, position, completedAt }) {
  const fit = acquisitionsFit({
    scores: scored.scores,
    screening,
    workSample,
    quality: scored.quality,
    tooFast: timing.too_fast,
  });
  const questions = interviewQuestions({
    scores: scored.scores,
    position,
    quality: scored.quality,
    screening,
    workSample,
    tooFast: timing.too_fast,
  });
  const items = [];
  if (scored.quality.attention_check_failed) items.push({ code: "attention_check_failed", label: "Missed the attention check" });
  if (timing.too_fast) items.push({ code: "finished_too_fast", label: "Finished the assessment in under 3 minutes" });
  if (scored.quality.uniformly_favorable) items.push({ code: "uniformly_favorable", label: scored.quality.interpretation });
  if (scored.quality.consistency_flags > 0) {
    items.push({
      code: "consistency_flags",
      label: `${scored.quality.consistency_flags} inconsistent answer pair${scored.quality.consistency_flags === 1 ? "" : "s"}`,
    });
  }
  for (const code of workSample?.flags || []) items.push({ code, label: code });
  for (const flag of screening?.flags || []) items.push(flag);
  const flags = {
    attention_check_failed: scored.quality.attention_check_failed,
    finished_too_fast: Boolean(timing.too_fast),
    uniformly_favorable: scored.quality.uniformly_favorable,
    consistency_flags: scored.quality.consistency_flags,
    interpretation: scored.quality.interpretation,
    work_sample_pasted: Boolean(workSample?.pasted),
    work_sample_flags: workSample?.flags || [],
    screening_flag_codes: (screening?.flags || []).map((flag) => flag.code),
    items,
  };
  return {
    candidate_id: candidateId,
    scores: scored.scores,
    profile_label: scored.profile_label,
    assessment_version: ASSESSMENT_VERSION,
    response_quality: { ...scored.quality, finished_too_fast: Boolean(timing.too_fast) },
    evidence_summary: {
      method: "server-side item bank v3",
      version: ASSESSMENT_VERSION,
      role_scenario_set: scored.role_scenario_set,
      fit: fit.components,
    },
    consistency: { ...scored.quality, pair_rule: "abs(forward + reverse - 6) >= 3" },
    flags,
    acquisitions_fit: fit.score,
    interview_questions: questions,
    work_sample: workSample || null,
    timing,
    completed_at: completedAt,
  };
}
