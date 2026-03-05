import { ListBase, Title, useListContext } from "ra-core";
import { useState } from "react";
import { matchPath, useLocation } from "react-router";

import type { Report } from "./report";
import { ReportListContent } from "./ReportListContent";
import { ReportShow } from "./ReportShow";

const ReportList = () => {
  const location = useLocation();
  const matchShow = matchPath("/reports/:id/show", location.pathname);
  const matchEdit = matchPath("/reports/:id", location.pathname);

  return (
    <ListBase
      perPage={200}
      sort={{ field: "index", order: "ASC" }}
      filter={{ archived_at: null }}
    >
      <ReportListLayout>
        <ReportShow
          open={!!matchShow}
          report={null}
          onClose={() => {}}
        />
      </ReportListLayout>
    </ListBase>
  );
};

const ReportListLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: reports } = useListContext<Report>();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const handleReportClick = (report: Report) => {
    setSelectedReport(report);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSelectedReport(null);
  };

  return (
    <div>
      <Title title="Tickets" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tickets</h2>
          <p className="text-muted-foreground">
            Indoor and outdoor reports from Civisto
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
      />
      {children}
    </div>
  );
};

export default ReportList;
