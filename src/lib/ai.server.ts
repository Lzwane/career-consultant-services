import type { AiAnalysis } from "./ai.functions";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "recommendations", "advice"],
  properties: {
    summary: { type: "string" },
    advice: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "institution", "programme", "qualification_type", "requirements",
          "meets_requirements", "suitability", "reason", "closing_date",
        ],
        properties: {
          institution: { type: "string" },
          programme: { type: "string" },
          qualification_type: { type: "string" },
          requirements: { type: "string" },
          meets_requirements: { type: "boolean" },
          suitability: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string" },
          closing_date: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `You are an expert South African tertiary admissions consultant assisting the staff of Career Consultation Services.
You know the published prospectuses and admission requirements of all 26 South African public universities (traditional, comprehensive and universities of technology), the 50 public TVET colleges, and public nursing/agricultural colleges.
Given a learner's profile, subjects and marks, calculate their APS the way each institution does (note institutions that use their own scoring, e.g. Wits, UCT, Stellenbosch) and recommend 8-12 specific programmes they qualify for or nearly qualify for, spread across realistic institutions (prioritise the learner's province and stated interests, then include safer options such as universities of technology and TVET colleges).
For each: state the exact minimum requirements from the most recent prospectus you know (APS and subject levels), whether the learner meets them, suitability based on interests and marks, a short reason, and the usual application closing date.
Be honest when a learner does not meet requirements. Remind staff to confirm against the current year's official prospectus. Write in plain English.`;

export async function runQualificationAnalysis(
  app: any,
): Promise<{ ok: true; analysis: AiAnalysis } | { ok: false; error: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "The assistant is not configured." };

  const profile = {
    name: app.full_name,
    grade_status: app.grade_status,
    matric_year: app.matric_year,
    exam_body: app.exam_body,
    school: app.school,
    province: app.province,
    subjects_and_marks: app.subjects,
    calculated_aps: app.aps,
    field_of_interest: app.field_of_interest,
    first_choice: app.first_choice,
    second_choice: app.second_choice,
    third_choice: app.third_choice,
    preferred_institutions: app.preferred_institutions,
    funding: app.funding,
    notes: app.notes,
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      instructions: SYSTEM,
      input: `Learner profile (JSON):\n${JSON.stringify(profile, null, 2)}`,
      text: { format: { type: "json_schema", name: "qualification_analysis", strict: true, schema: SCHEMA } },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error("AI gateway error", res.status, body);
    if (res.status === 402) return { ok: false, error: "AI credits have run out. Please top up the workspace to keep using the assistant." };
    if (res.status === 429) return { ok: false, error: "The assistant is busy right now. Please try again in a minute." };
    return { ok: false, error: "The assistant could not complete the analysis." };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let failure: string | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta") text += evt.delta ?? "";
          if (evt.type === "response.refusal.delta") failure = "The assistant declined this request.";
          if (evt.type === "response.failed" || evt.type === "error") failure = "The assistant could not complete the analysis.";
        } catch {
          /* ignore partial frame */
        }
      }
    }
  }

  if (failure) return { ok: false, error: failure };
  try {
    return { ok: true, analysis: JSON.parse(text) as AiAnalysis };
  } catch {
    return { ok: false, error: "The assistant returned an unreadable answer. Please try again." };
  }
}
