import { Droppable } from "@hello-pangea/dnd";

import type { Report } from "./report";
import { findStatusColor, findStatusLabel } from "./report";
import { ReportCard } from "./ReportCard";

export const ReportColumn = ({
  status,
  reports,
  onReportClick,
}: {
  status: string;
  reports: Report[];
  onReportClick: (report: Report) => void;
}) => {
  const statusColor = findStatusColor(status);

  return (
    <div className="flex-1 min-w-[280px] pb-8">
      <div className="flex flex-col items-center mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <h3 className="text-base font-medium">{findStatusLabel(status)}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {reports.length} {reports.length === 1 ? "ticket" : "tickets"}
        </p>
      </div>
      <Droppable droppableId={status}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col rounded-2xl mt-2 gap-2 min-h-[200px] p-1 ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            {reports.map((report, index) => (
              <ReportCard
                key={report.id}
                report={report}
                index={index}
                onClick={onReportClick}
              />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
