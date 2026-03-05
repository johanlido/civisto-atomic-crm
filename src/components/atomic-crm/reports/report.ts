import type { Identifier, RaRecord } from "ra-core";

/**
 * Report type matching the Civisto `crm_tickets` view.
 * The CRM reads from `crm_tickets` (a view over `public.reports`)
 * and writes back to `public.reports` via the data provider mapping.
 */
export type Report = {
  title: string;
  description: string | null;
  workflow_status: string; // admin_status from reports table
  category: string;
  report_type: "outdoor" | "indoor";
  priority: "low" | "medium" | "high" | "critical";
  reporter_name: string | null;
  reporter_status: string | null; // user-facing status
  location_description: string | null;
  assigned_to: string | null;
  admin_notes: string | null;
  images: string[];
  ai_suggested_category: string | null;
  ai_category_confidence: number | null;
  created_at: string;
  updated_at: string;
  index: number; // kanban_index
  user_id: string | null;
} & Pick<RaRecord, "id">;

/**
 * Comment type matching the Civisto `comments` table.
 */
export type ReportComment = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  report_id: string;
  content: string;
  is_system: boolean;
  is_admin: boolean;
  author_role: "reporter" | "admin" | "system";
  user?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
};

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

/**
 * Civisto report categories (from the report_category enum).
 * These are the actual categories stored in the database.
 */
export const REPORT_CATEGORIES: Record<string, string> = {
  pothole: "Pothole",
  graffiti: "Graffiti",
  broken_light: "Broken Light",
  trash: "Trash / Litter",
  vandalism: "Vandalism",
  safety_hazard: "Safety Hazard",
  water_leak: "Water Leak",
  noise_pollution: "Noise Pollution",
  parking_violation: "Parking Violation",
  other: "Other",
};

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

export const findCategoryLabel = (category: string): string => {
  return REPORT_CATEGORIES[category] || category;
};
