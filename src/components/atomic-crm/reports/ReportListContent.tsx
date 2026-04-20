import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import { useDataProvider, useListContext, type DataProvider } from "ra-core";
import { useEffect, useState } from "react";

import type { Report } from "./report";
import {
  REPORT_STATUSES,
  type ReportsByStatus,
  getReportsByStatus,
} from "./report";
import { ReportColumn } from "./ReportColumn";

export const ReportListContent = ({
  onReportClick,
}: {
  onReportClick: (report: Report) => void;
}) => {
  const {
    data: unorderedReports,
    isPending,
    refetch,
  } = useListContext<Report>();
  const dataProvider = useDataProvider();

  const [reportsByStatus, setReportsByStatus] = useState<ReportsByStatus>(
    getReportsByStatus([], REPORT_STATUSES),
  );

  useEffect(() => {
    if (unorderedReports) {
      const newReportsByStatus = getReportsByStatus(
        unorderedReports,
        REPORT_STATUSES,
      );
      if (!isEqual(newReportsByStatus, reportsByStatus)) {
        setReportsByStatus(newReportsByStatus);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedReports]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStatus = source.droppableId;
    const destinationStatus = destination.droppableId;
    const sourceReport = reportsByStatus[sourceStatus][source.index]!;

    // Compute local state change synchronously
    setReportsByStatus(
      updateReportStatusLocal(
        sourceReport,
        { status: sourceStatus, index: source.index },
        { status: destinationStatus, index: destination.index },
        reportsByStatus,
      ),
    );

    // Persist the change — write to the `reports` table via admin_status
    updateReportStatus(
      sourceReport,
      destinationStatus,
      dataProvider,
    ).then(() => {
      refetch();
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory sm:snap-none pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {REPORT_STATUSES.map((status) => (
          <ReportColumn
            status={status.value}
            reports={reportsByStatus[status.value] || []}
            key={status.value}
            onReportClick={onReportClick}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

const updateReportStatusLocal = (
  sourceReport: Report,
  source: { status: string; index: number },
  destination: { status: string; index: number },
  reportsByStatus: ReportsByStatus,
): ReportsByStatus => {
  if (source.status === destination.status) {
    // Moving report inside the same column
    const column = [...reportsByStatus[source.status]];
    column.splice(source.index, 1);
    column.splice(destination.index, 0, sourceReport);
    return {
      ...reportsByStatus,
      [destination.status]: column,
    };
  } else {
    // Moving report across columns
    const sourceColumn = [...reportsByStatus[source.status]];
    const destinationColumn = [...reportsByStatus[destination.status]];
    sourceColumn.splice(source.index, 1);
    destinationColumn.splice(destination.index, 0, {
      ...sourceReport,
      workflow_status: destination.status,
    });
    return {
      ...reportsByStatus,
      [source.status]: sourceColumn,
      [destination.status]: destinationColumn,
    };
  }
};

/**
 * Persist the status change to the database.
 * The CRM writes `admin_status` to the `reports` table.
 * The database trigger `sync_admin_status_trigger` will automatically
 * update the user-facing `status` column, and `admin_status_change_notification`
 * will notify the reporter.
 */
const updateReportStatus = async (
  source: Report,
  newStatus: string,
  dataProvider: DataProvider,
) => {
  await dataProvider.update("reports", {
    id: source.id,
    data: {
      admin_status: newStatus,
      updated_at: new Date().toISOString(),
    },
    previousData: source,
  });
};
