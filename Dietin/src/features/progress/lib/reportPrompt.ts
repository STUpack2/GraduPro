// Builds the Gemini prompt for the Weekly AI Report. Keeps prompt text in one
// place so we can iterate without grepping through the section component.

import type { WeeklyReport } from "../types";

export interface ReportInputs {
  weekStart: string;
  weekEnd: string;
  weightStartKg?: number;
  weightEndKg?: number;
  workoutsCompleted: number;
  workoutsTarget: number;
  proteinHitDays: number;
  calorieHitDays: number;
  hydrationHitDays: number;
  consistencyScoreDelta: number;
  prCount: number;
  lang: string; // "en", "ar", ...
  userName?: string;
}

export function buildWeeklyReportPrompt(input: ReportInputs): string {
  const isArabic = input.lang?.startsWith("ar");
  const langInstruction = isArabic
    ? "IMPORTANT: The app language is Arabic. Reply ONLY in Arabic (Egyptian dialect where natural).\n"
    : "Reply in clear, concise English.\n";

  return `${langInstruction}You are a supportive, evidence-based fitness coach writing a 1-paragraph weekly recap for the user.

Stick to the numbers below — do not invent metrics. If a value is missing, omit it gracefully. Tone: warm, specific, motivating, ~70-110 words. End with one concrete action for next week.

Then output 4 short bullet highlights for a shareable card (max 9 words each).

Output JSON ONLY in this exact shape:
{
  "summary": "...",
  "highlights": ["...", "...", "...", "..."]
}

User: ${input.userName ?? "athlete"}
Week: ${input.weekStart} → ${input.weekEnd}
Weight start: ${input.weightStartKg ?? "n/a"} kg
Weight end: ${input.weightEndKg ?? "n/a"} kg
Workouts completed: ${input.workoutsCompleted} / ${input.workoutsTarget}
Protein-goal days: ${input.proteinHitDays} / 7
Calorie-goal days: ${input.calorieHitDays} / 7
Hydration-goal days: ${input.hydrationHitDays} / 7
Consistency score delta: ${input.consistencyScoreDelta >= 0 ? "+" : ""}${input.consistencyScoreDelta}
PRs broken this week: ${input.prCount}
`;
}

export function parseReportResponse(raw: string): { summary: string; highlights: string[] } {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((h: unknown): h is string => typeof h === "string").slice(0, 6)
        : [],
    };
  } catch {
    return { summary: cleaned.slice(0, 500), highlights: [] };
  }
}

export function reportFromFallback(input: ReportInputs): Pick<WeeklyReport, "summaryText" | "summaryHighlights"> {
  const delta = (input.weightEndKg ?? 0) - (input.weightStartKg ?? 0);
  const deltaStr = isFinite(delta) && input.weightStartKg !== undefined
    ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg`
    : "";
  const summary = [
    deltaStr ? `Weight change this week: ${deltaStr}.` : "",
    `Workouts: ${input.workoutsCompleted}/${input.workoutsTarget}.`,
    `Protein hit ${input.proteinHitDays}/7 days, hydration ${input.hydrationHitDays}/7.`,
    input.prCount ? `${input.prCount} new PR${input.prCount === 1 ? "" : "s"}.` : "",
  ].filter(Boolean).join(" ");
  return {
    summaryText: summary,
    summaryHighlights: [
      deltaStr ? `Weight: ${deltaStr}` : "",
      `Workouts ${input.workoutsCompleted}/${input.workoutsTarget}`,
      `Protein ${input.proteinHitDays}/7`,
      `Hydration ${input.hydrationHitDays}/7`,
    ].filter(Boolean),
  };
}
