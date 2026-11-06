/** Marker colours by household state (no Leaflet import: safe for server-rendered modules). */
export type PointTone = "growing" | "progress" | "done" | "rejected" | "overdue";

export const TONE_COLORS: Record<PointTone, string> = {
  growing: "#2F8F4E",
  progress: "#2563EB",
  done: "#6B7C72",
  rejected: "#B42318",
  overdue: "#D97706",
};

export const TONE_LEGEND: { tone: PointTone; label: string }[] = [
  { tone: "growing", label: "Parvarishda" },
  { tone: "progress", label: "Jarayonda" },
  { tone: "overdue", label: "Muddati o‘tgan" },
  { tone: "done", label: "Yakunlangan" },
  { tone: "rejected", label: "Rad etilgan" },
];

export function toneOf(status: string | undefined, currentStage: number | undefined, overdue: boolean | undefined): PointTone {
  if (status === "DONE") return "done";
  if (status === "REJECTED") return "rejected";
  if (overdue) return "overdue";
  return currentStage === 10 ? "growing" : "progress";
}

/** Sequential blue ramp (light -> dark = few -> many) for the district bubbles and the share table dots. */
const DISTRICT_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"] as const;

export function districtColor(total: number, max: number): { fill: string; ink: string } {
  if (total <= 0 || max <= 0) return { fill: "#D5DCE5", ink: "#15202D" };
  const step = Math.min(DISTRICT_RAMP.length - 1, Math.floor((total / max) * (DISTRICT_RAMP.length - 0.001)));
  return { fill: DISTRICT_RAMP[step], ink: step === 0 ? "#0b0b0b" : "#ffffff" };
}
