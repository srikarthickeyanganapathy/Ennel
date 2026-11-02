import { type JobRunSummary, type SystemHealth } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { OutageCard } from '@/features/attendance/components/OutageCard';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { ReasonDialog } from '@/shared/components/ReasonDialog';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { TABLE_CELL, TABLE_HEAD } from '@/shared/components/table-styles';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';
import { getSystemHealth, runJob } from '../api/system-api';

const REFRESH_MS = 30_000;
const RUN_STATUS: Record<JobRunSummary['status'], { label: string; tone: StatusTone }> = {
  RUNNING: { label: 'Running', tone: 'info' },
  SUCCEEDED: { label: 'Succeeded', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

type Job = SystemHealth['jobs'][number];

/** Admin §Q: background jobs, queue depth, attendance provider, outage mode and app summary. */
export function SystemHealthPage() {
  const can = usePermissions();
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: REFRESH_MS,
  });
  return (
    <div>
      <PageHeader
        title="System health"
        breadcrumbs={[{ label: 'System health' }]}
        description={health.data ? `Updated ${formatDateTime(health.data.generatedAt)}` : undefined}
      />
      <QueryBoundary
        isLoading={health.isLoading}
        error={health.error}
        onRetry={() => void health.refetch()}
      >
        {health.data ? (
          <div className="flex flex-col gap-6">
            <SummaryCards health={health.data} />
            <JobsTable
              jobs={health.data.jobs}
              queueUp={health.data.queue.isAvailable}
              generatedAt={health.data.generatedAt}
            />
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
              {can('attendance:read') ? (
                <OutageCard />
              ) : (
                <Card>
                  <h2 className="text-base font-semibold">Attendance outage</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Outage mode is {health.data.outage ? 'on' : 'off'}.
                  </p>
                </Card>
              )}
              <ConfigCard health={health.data} />
            </div>
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}

function Tile({
  label,
  status,
  tone,
  note,
}: {
  label: string;
  status: string;
  tone: StatusTone;
  note: string;
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <StatusBadge label={status} tone={tone} />
      </div>
      <p className="text-[13px]">{note}</p>
    </Card>
  );
}

function SummaryCards({ health }: { health: SystemHealth }) {
  const { queue, attendanceProvider } = health;
  const isDatabaseUp = health.database === 'up';
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Tile
        label="Database"
        status={isDatabaseUp ? 'Up' : 'Down'}
        tone={isDatabaseUp ? 'success' : 'danger'}
        note={isDatabaseUp ? 'Connected' : 'The API cannot reach the database'}
      />
      <Tile
        label="Job queue"
        status={queue.isAvailable ? 'Up' : 'Unavailable'}
        tone={queue.isAvailable ? 'success' : 'danger'}
        note={
          queue.isAvailable
            ? `${queue.waiting} waiting · ${queue.active} running · ${queue.delayed} scheduled · ${queue.failed} failed`
            : 'Redis cannot be reached, so background jobs are not running'
        }
      />
      <Tile
        label="Attendance provider"
        status={attendanceProvider.isConfigured ? 'Connected' : 'Not configured'}
        tone={attendanceProvider.isConfigured ? 'success' : 'warning'}
        note={attendanceProvider.name}
      />
    </div>
  );
}

function JobsTable({
  jobs,
  queueUp,
  generatedAt,
}: {
  jobs: Job[];
  queueUp: boolean;
  generatedAt: string;
}) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState<Job | null>(null);
  const run = useMutation({
    mutationFn: ({ job, reason }: { job: Job; reason: string }) => runJob(job.name, reason),
    onSuccess: () => {
      toast.success('Queued. It runs as soon as the worker picks it up.');
      setRunning(null);
      void queryClient.invalidateQueries({ queryKey: ['system-health'] });
    },
  });
  return (
    <Card className="p-0">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold">Background jobs</h2>
        <p className="text-xs text-muted-foreground">
          These run in the worker process. Running one again is safe: a finished date is not done
          twice.
        </p>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <caption className="sr-only">Background jobs</caption>
          <thead className="bg-neutral-surface">
            <tr>
              {['Job', 'Schedule', 'Last run', 'Next run', 'Failures, 7 days'].map((heading) => (
                <th key={heading} scope="col" className={TABLE_HEAD}>
                  {heading}
                </th>
              ))}
              <th scope="col" className={TABLE_HEAD}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.name} className="border-t border-border">
                <th scope="row" className={`${TABLE_CELL} text-left font-semibold`}>
                  {job.label}
                </th>
                <td className={TABLE_CELL}>{job.schedule}</td>
                <td className={TABLE_CELL}>
                  <LastRun run={job.lastRun} />
                </td>
                <td className={TABLE_CELL}>
                  <NextRun at={job.nextRunAt} now={generatedAt} />
                </td>
                <td className={TABLE_CELL}>{job.failuresLast7Days}</td>
                <td className={`${TABLE_CELL} text-right`}>
                  <PermissionGate permissions={['system:manage']}>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Run ${job.label} now`}
                      disabled={!queueUp}
                      onClick={() => (run.reset(), setRunning(job))}
                    >
                      {job.lastRun?.status === 'FAILED' ? 'Retry' : 'Run now'}
                    </Button>
                  </PermissionGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReasonDialog
        open={running !== null}
        onOpenChange={(open) => !open && setRunning(null)}
        title={`Run ${running?.label ?? ''} now?`}
        description="It joins the queue straight away. The reason is kept in the audit log."
        confirmLabel="Run now"
        isPending={run.isPending}
        error={run.error}
        onConfirm={(reason) => running && run.mutate({ job: running, reason })}
      />
    </Card>
  );
}

/** A next run in the past means nothing is picking jobs up: usually the worker is not running. */
function NextRun({ at, now }: { at: string | null; now: string }) {
  if (!at) return <span className="text-muted-foreground">Not scheduled</span>;
  if (at >= now) return <>{formatDateTime(at)}</>;
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge label="Overdue" tone="warning" />
      <span className="text-xs text-muted-foreground">
        Was due {formatDateTime(at)}. Check that the worker is running.
      </span>
    </span>
  );
}

function LastRun({ run }: { run: JobRunSummary | null }) {
  if (!run) return <span className="text-muted-foreground">No run recorded</span>;
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge {...RUN_STATUS[run.status]} />
      <span className="text-xs text-muted-foreground">
        {formatDateTime(run.finishedAt ?? run.startedAt)}
        {run.attempt > 1 ? ` · attempt ${run.attempt}` : ''}
      </span>
      {run.error ? <span className="text-xs break-words text-danger">{run.error}</span> : null}
    </span>
  );
}

function ConfigCard({ health }: { health: SystemHealth }) {
  const rows = [
    ['App version', health.version],
    ['Environment', health.environment],
    ['Time zone', health.timeZone],
    ['Push notifications', health.pushProvider],
  ];
  return (
    <Card>
      <h2 className="text-base font-semibold">App and config</h2>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
