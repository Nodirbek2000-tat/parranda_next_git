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
