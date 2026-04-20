import { Draggable } from "@hello-pangea/dnd";
import { formatDistance } from "date-fns";
import {
  AlertTriangle,
  MapPin,
  Droplets,
  Lightbulb,
  Trash2,
  Car,
  Volume2,
  Hammer,
  ShieldAlert,
  CircleDot,
  HelpCircle,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { Report } from "./report";
import { findPriorityColor, findCategoryLabel } from "./report";

const categoryIcons: Record<string, React.ElementType> = {
  pothole: CircleDot,
  graffiti: Hammer,
  broken_light: Lightbulb,
  trash: Trash2,
  vandalism: Hammer,
  safety_hazard: ShieldAlert,
  water_leak: Droplets,
  noise_pollution: Volume2,
  parking_violation: Car,
  other: HelpCircle,
};

export const ReportCard = ({
  report,
  index,
  onClick,
}: {
  report: Report;
  index: number;
  onClick: (report: Report) => void;
}) => {
  if (!report) return null;

  return (
    <Draggable draggableId={String(report.id)} index={index}>
      {(provided, snapshot) => (
        <ReportCardContent
          provided={provided}
          snapshot={snapshot}
          report={report}
          onClick={onClick}
        />
      )}
    </Draggable>
  );
};

export const ReportCardContent = ({
  provided,
  snapshot,
  report,
  onClick,
}: {
  provided?: any;
  snapshot?: any;
  report: Report;
  onClick: (report: Report) => void;
}) => {
  const CategoryIcon = categoryIcons[report.category] || AlertTriangle;
  const priorityColor = findPriorityColor(report.priority || "medium");

  const handleClick = () => {
    onClick(report);
  };

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <Card
        className={`py-3 transition-all duration-200 touch-manipulation ${
          snapshot?.isDragging
            ? "opacity-90 transform rotate-1 shadow-lg"
            : "shadow-sm hover:shadow-md active:shadow-md active:scale-[0.98]"
        }`}
      >
        <CardContent className="px-3 sm:px-3">
          <div className="flex items-start gap-2">
            <div
              className="mt-0.5 p-1 rounded"
              style={{ backgroundColor: `${priorityColor}15` }}
            >
              <CategoryIcon
                className="w-4 h-4"
                style={{ color: priorityColor }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{report.title}</p>
              {report.reporter_name && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground truncate">
                    Reported by {report.reporter_name}
                  </span>
                </div>
              )}
              {report.location_description && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">
                    {report.location_description}
                  </span>
                </div>
              )}
              {report.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {report.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {findCategoryLabel(report.category)}
                  </Badge>
                  {report.report_type === "indoor" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      <Building2 className="w-3 h-3 mr-0.5" />
                      Indoor
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {report.created_at
                    ? formatDistance(new Date(report.created_at), new Date(), {
                        addSuffix: true,
                      })
                    : ""}
                </span>
              </div>
              {report.ai_suggested_category &&
                report.ai_category_confidence != null && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-blue-500">
                      AI: {findCategoryLabel(report.ai_suggested_category)} (
                      {Math.round(report.ai_category_confidence * 100)}%)
                    </span>
                  </div>
                )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
