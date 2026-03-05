import type { Identifier, RaRecord } from "ra-core";

export type Report = {
  title: string;
  description: string;
  workflow_status: string;
  category: string;
  report_type: "outdoor" | "indoor";
  entity_name: string | null;
  customer_name: string | null;
  customer_id: Identifier | null;
  priority: "low" | "medium" | "high" | "critical";
  reporter_name: string | null;
  location_description: string | null;
  images: string[];
  ai_suggested_category: string | null;
  ai_category_confidence: number | null;
  created_at: string;
  updated_at: string;
  index: number;
} & Pick<RaRecord, "id">;

export interface ReportStatus {
  value: string;
  label: string;
  color: string;
}

export const REPORT_STATUSES: ReportStatus[] = [
  { value: "new", label: "New", color: "#3b82f6" },
  { value: "acknowledged", label: "Acknowledged", color: "#8b5cf6" },
  { value: "in_progress", label: "In Progress", color: "#f59e0b" },
  { value: "resolved", label: "Resolved", color: "#10b981" },
  { value: "closed", label: "Closed", color: "#6b7280" },
];

export const REPORT_CATEGORIES = [
  "HVAC",
  "Electrical",
  "Plumbing",
  "IT / Network",
  "Mechanical",
  "Cleaning",
  "Safety",
  "Structural",
  "Elevator",
  "Parking",
  "Outdoor",
  "Other",
];

export const REPORT_PRIORITIES = [
  { value: "low", label: "Low", color: "#6b7280" },
  { value: "medium", label: "Medium", color: "#f59e0b" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "critical", label: "Critical", color: "#ef4444" },
];

export type ReportsByStatus = Record<string, Report[]>;

export const getReportsByStatus = (
  reports: Report[],
  statuses: ReportStatus[],
): ReportsByStatus => {
  if (!statuses || statuses.length === 0) return {};
  const reportsByStatus: ReportsByStatus = reports.reduce(
    (acc, report) => {
      if (acc[report.workflow_status]) {
        acc[report.workflow_status].push(report);
      }
      return acc;
    },
    statuses.reduce(
      (obj, status) => ({ ...obj, [status.value]: [] }),
      {} as ReportsByStatus,
    ),
  );
  // Order each column by index
  statuses.forEach((status) => {
    reportsByStatus[status.value] = reportsByStatus[status.value].sort(
      (a: Report, b: Report) => (a.index ?? 0) - (b.index ?? 0),
    );
  });
  return reportsByStatus;
};

export const findStatusLabel = (status: string): string => {
  const found = REPORT_STATUSES.find((s) => s.value === status);
  return found ? found.label : status;
};

export const findStatusColor = (status: string): string => {
  const found = REPORT_STATUSES.find((s) => s.value === status);
  return found ? found.color : "#6b7280";
};

export const findPriorityColor = (priority: string): string => {
  const found = REPORT_PRIORITIES.find((p) => p.value === priority);
  return found ? found.color : "#6b7280";
};
