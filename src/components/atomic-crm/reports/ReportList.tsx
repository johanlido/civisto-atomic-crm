import { ListBase, useListContext } from "ra-core";
import { useEffect, useState } from "react";

import type { Report } from "./report";
import { ReportListContent } from "./ReportListContent";
import { ReportShow } from "./ReportShow";

/**
 * ReportList — the main Tickets page.
 *
 * Uses `crm_tickets` view for reading (mapped in the data provider)
 * and writes back to the `reports` table for updates.
 */
const ReportList = () => {
  return (
    <ListBase
      perPage={500}
      sort={{ field: "created_at", order: "DESC" }}
    >
      <ReportListLayout />
    </ListBase>
  );
};

const ReportListLayout = () => {
  const { data: reports, refetch } = useListContext<Report>();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const handleReportClick = (report: Report) => {
    setSelectedReport(report);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSelectedReport(null);
    // Refetch to pick up any changes made in the dialog
    refetch();
  };

  const handleStatusChange = () => {
    // Refetch the list after a status change in the dialog
    refetch();
  };

  useEffect(() => {
    document.title = "Tickets";
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Tickets</h2>
          <p className="text-sm text-muted-foreground hidden sm:block">
            All reports from Civisto — manage, respond, and track progress
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          {reports && (
            <span>
              {reports.length} {reports.length === 1 ? "ticket" : "tickets"}
            </span>
          )}
        </div>
      </div>
      <ReportListContent onReportClick={handleReportClick} />
      <ReportShow
        report={selectedReport}
        open={showDialog}
        onClose={handleCloseDialog}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default ReportList;
