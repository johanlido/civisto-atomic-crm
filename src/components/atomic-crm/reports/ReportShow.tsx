import { format } from "date-fns";
import {
  AlertTriangle,
  Building2,
  Calendar,
  MapPin,
  Tag,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import type { Report } from "./report";
import {
  findPriorityColor,
  findStatusColor,
  findStatusLabel,
  REPORT_STATUSES,
} from "./report";

export const ReportShow = ({
  report,
  open,
  onClose,
}: {
  report: Report | null;
  open: boolean;
  onClose: () => void;
}) => {
  if (!report) return null;

  const statusColor = findStatusColor(report.workflow_status);
  const priorityColor = findPriorityColor(report.priority || "medium");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="lg:max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">{report.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Priority badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              style={{
                backgroundColor: `${statusColor}20`,
                color: statusColor,
                borderColor: statusColor,
              }}
              variant="outline"
            >
              {findStatusLabel(report.workflow_status)}
            </Badge>
            {report.priority && (
              <Badge
                style={{
                  backgroundColor: `${priorityColor}20`,
                  color: priorityColor,
                  borderColor: priorityColor,
                }}
                variant="outline"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {report.priority.charAt(0).toUpperCase() +
                  report.priority.slice(1)}
              </Badge>
            )}
            {report.report_type && (
              <Badge variant="secondary">
                {report.report_type === "indoor" ? (
                  <Building2 className="w-3 h-3 mr-1" />
                ) : (
                  <MapPin className="w-3 h-3 mr-1" />
                )}
                {report.report_type.charAt(0).toUpperCase() +
                  report.report_type.slice(1)}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {report.category && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Category
                </span>
                <span className="text-sm font-medium">{report.category}</span>
              </div>
            )}

            {report.entity_name && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Location / Entity
                </span>
                <span className="text-sm font-medium">
                  {report.entity_name}
                </span>
              </div>
            )}

            {report.customer_name && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Customer
                </span>
                <span className="text-sm font-medium">
                  {report.customer_name}
                </span>
              </div>
            )}

            {report.reporter_name && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3" /> Reporter
                </span>
                <span className="text-sm font-medium">
                  {report.reporter_name}
                </span>
              </div>
            )}

            {report.created_at && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Reported
                </span>
                <span className="text-sm">
                  {format(new Date(report.created_at), "PPp")}
                </span>
              </div>
            )}

            {report.location_description && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address
                </span>
                <span className="text-sm">
                  {report.location_description}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {report.description && (
            <>
              <Separator />
              <div>
                <span className="text-xs text-muted-foreground tracking-wide">
                  Description
                </span>
                <p className="text-sm leading-6 mt-1 whitespace-pre-line">
                  {report.description}
                </p>
              </div>
            </>
          )}

          {/* AI Classification */}
          {report.ai_suggested_category && (
            <>
              <Separator />
              <div>
                <span className="text-xs text-muted-foreground tracking-wide">
                  AI Classification
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-blue-600">
                    {report.ai_suggested_category}
                  </Badge>
                  {report.ai_category_confidence != null && (
                    <span className="text-xs text-muted-foreground">
                      Confidence:{" "}
                      {Math.round(report.ai_category_confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Images */}
          {report.images && report.images.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="text-xs text-muted-foreground tracking-wide">
                  Attachments
                </span>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {report.images.map((img, idx) => (
                    <a
                      key={idx}
                      href={img}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={img}
                        alt={`Attachment ${idx + 1}`}
                        className="w-24 h-24 object-cover rounded border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Workflow Status Selector */}
          <Separator />
          <div>
            <span className="text-xs text-muted-foreground tracking-wide">
              Change Status
            </span>
            <div className="flex gap-2 mt-2 flex-wrap">
              {REPORT_STATUSES.map((status) => (
                <Badge
                  key={status.value}
                  variant={
                    report.workflow_status === status.value
                      ? "default"
                      : "outline"
                  }
                  className={`cursor-pointer transition-all ${
                    report.workflow_status === status.value
                      ? ""
                      : "hover:bg-muted"
                  }`}
                  style={
                    report.workflow_status === status.value
                      ? { backgroundColor: status.color, color: "white" }
                      : {}
                  }
                >
                  {status.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
