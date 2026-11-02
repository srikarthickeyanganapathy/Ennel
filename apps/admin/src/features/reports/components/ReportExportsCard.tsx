import { type ReportExportJob } from '@ennel/shared';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { formatDateTime } from '@/shared/lib/format';
import { downloadReportExport, listReportExports } from '../api/reports-api';

const STATUS: Record<ReportExportJob['status'], { label: string; tone: StatusTone }> = {
  QUEUED: { label: 'Waiting', tone: 'info' },
  RUNNING: { label: 'Building', tone: 'info' },
  READY: { label: 'Ready', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
};
const POLL_MS = 5_000;
const isBusy = (job: ReportExportJob) => job.status === 'QUEUED' || job.status === 'RUNNING';

/** Admin §O: long exports run in the background; this is where they arrive. Your own only. */
export function ReportExportsCard() {
  const exports = useQuery({
    queryKey: ['report-exports'],
    queryFn: listReportExports,
    refetchInterval: (query) => (query.state.data?.some(isBusy) ? POLL_MS : false),
  });
  const items = exports.data ?? [];
  if (items.length === 0) return null;
  return (
    <Card>
      <h2 className="text-base font-semibold">Your exports</h2>
      <p className="text-xs text-muted-foreground">Long ranges are built in the background.</p>
      <ul className="mt-2 divide-y divide-border">
        {items.map((job) => (
          <li key={job.id} className="flex flex-wrap items-center gap-2.5 py-2.5">
            <span className="min-w-0 flex-1 basis-48 leading-tight">
              <span className="block truncate text-[13px] font-semibold">{job.fileName}</span>
              <span className="block text-xs text-muted-foreground">
                {job.error ?? `Requested ${formatDateTime(job.createdAt)}`}
              </span>
            </span>
            <StatusBadge {...STATUS[job.status]} />
            {job.status === 'READY' ? (
              <Button
                variant="outline"
                size="sm"
                aria-label={`Download ${job.fileName}`}
                onClick={() =>
                  void downloadReportExport(job).catch((error: unknown) =>
                    toast.error(errorMessage(error)),
                  )
                }
              >
                Download
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
