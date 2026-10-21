import {
  type RosterImportRow,
  type RosterImportSummary,
  type RosterRowOutcome,
  ROSTER_ROW_OUTCOMES,
} from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { DataTable } from '@/shared/components/DataTable';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Field, Input } from '@/shared/components/ui/form-controls';
import { useTableState } from '@/shared/hooks/use-table-state';
import { PageHeader } from '@/shared/layout/PageHeader';
import { formatDateTime } from '@/shared/lib/format';
import {
  confirmRosterImport,
  downloadRosterTemplate,
  listRosterImportRows,
  listRosterImports,
  uploadRoster,
} from '../api/students-api';

const OUTCOMES: Record<RosterRowOutcome, { label: string; tone: StatusTone }> = {
  VALID: { label: 'New', tone: 'success' },
  EXISTING_UPDATE: { label: 'Update', tone: 'info' },
  EXISTING_UNCHANGED: { label: 'No change', tone: 'neutral' },
  INVALID: { label: 'Error', tone: 'danger' },
  DUPLICATE_IN_FILE: { label: 'Duplicate', tone: 'danger' },
};

const ROW_COLUMNS: ColumnDef<RosterImportRow, unknown>[] = [
  { id: 'rowNumber', header: 'Row', accessorKey: 'rowNumber' },
  {
    id: 'outcome',
    header: 'Result',
    cell: ({ row }) => <StatusBadge {...OUTCOMES[row.original.outcome]} />,
  },
  {
    id: 'referenceNumber',
    header: 'Reference number',
    cell: ({ row }) => row.original.raw.referenceNumber ?? '',
  },
  { id: 'fullName', header: 'Name', cell: ({ row }) => row.original.raw.fullName ?? '' },
  {
    id: 'hostel',
    header: 'Hostel',
    cell: ({ row }) =>
      [row.original.raw.hostel, row.original.raw.block].filter(Boolean).join(' • '),
  },
  {
    id: 'details',
    header: 'Details',
    cell: ({ row }) =>
      row.original.errors.length > 0 ? (
        <ul className="text-danger">
          {row.original.errors.map((error) => (
            <li key={`${error.field}-${error.message}`}>
              {error.field}: {error.message}
            </li>
          ))}
        </ul>
      ) : row.original.changes.length > 0 ? (
        `Changes: ${row.original.changes.join(', ')}`
      ) : (
        ''
      ),
  },
];

/** Admin §G roster import: upload, check every row, then confirm. */
export function RosterImportPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [current, setCurrent] = useState<RosterImportSummary | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const history = useQuery({ queryKey: ['roster-imports'], queryFn: () => listRosterImports(1) });

  const upload = useMutation({
    mutationFn: uploadRoster,
    onSuccess: (summary) => {
      setCurrent(summary);
      void queryClient.invalidateQueries({ queryKey: ['roster-imports'] });
    },
  });
  const confirm = useMutation({
    mutationFn: confirmRosterImport,
    onSuccess: (summary) => {
      setCurrent(summary);
      setIsConfirming(false);
      toast.success('Roster imported.');
      void queryClient.invalidateQueries({ queryKey: ['roster-imports'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import roster"
        description="Upload a CSV or XLSX file. Nothing changes until you confirm the preview."
        breadcrumbs={[{ label: 'Students', to: '/students' }, { label: 'Import roster' }]}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              void downloadRosterTemplate().catch((error: unknown) =>
                toast.error(errorMessage(error)),
              )
            }
          >
            Download template
          </Button>
        }
      />
      <Card>
        <CardHeader
          title="1. Upload"
          description="Columns: reference number, full name, department, academic year, hostel, block, room number, email."
        />
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (file) upload.mutate(file);
          }}
        >
          <Field label="Roster file" htmlFor="roster-file">
            <Input
              id="roster-file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <Button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? 'Checking…' : 'Check file'}
          </Button>
        </form>
        {upload.error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {errorMessage(upload.error)}
          </p>
        ) : null}
      </Card>
      {current ? (
        // Keyed by import so the result filter and page start fresh for each import.
        <ImportPreview
          key={current.id}
          summary={current}
          onConfirm={() => (confirm.reset(), setIsConfirming(true))}
        />
      ) : null}
      <Card>
        <CardHeader title="Recent imports" />
        <ul className="divide-y divide-border text-sm">
          {(history.data?.items ?? []).map((job) => (
            <li key={job.id} className="flex flex-wrap justify-between gap-2 py-2">
              <button
                type="button"
                className="text-left text-primary hover:underline"
                onClick={() => setCurrent(job)}
              >
                {job.fileName}
              </button>
              <span className="text-muted-foreground">
                {job.status} · {job.totalRows} rows · {formatDateTime(job.createdAt)} ·{' '}
                {job.createdByName}
              </span>
            </li>
          ))}
          {history.data?.items.length === 0 ? (
            <li className="py-2 text-muted-foreground">No imports yet.</li>
          ) : null}
        </ul>
      </Card>
      <Dialog open={isConfirming} onOpenChange={setIsConfirming}>
        <DialogContent
          title="Confirm roster import?"
          description={
            current
              ? `${current.counts.VALID} new and ${current.counts.EXISTING_UPDATE} updated entries will be saved. Students not in the file are left unchanged.`
              : undefined
          }
        >
          {confirm.error ? (
            <p className="text-sm text-danger">{errorMessage(confirm.error)}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirming(false)}>
              Cancel
            </Button>
            <Button
              disabled={confirm.isPending}
              onClick={() => current && confirm.mutate(current.id)}
            >
              {confirm.isPending ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportPreview({
  summary,
  onConfirm,
}: {
  summary: RosterImportSummary;
  onConfirm: () => void;
}) {
  const [outcome, setOutcome] = useState<RosterRowOutcome | undefined>(undefined);
  const table = useTableState(50);
  const rows = useQuery({
    queryKey: ['roster-import-rows', summary.id, outcome, table.state],
    queryFn: () =>
      listRosterImportRows(summary.id, {
        outcome,
        page: table.state.page,
        pageSize: table.state.pageSize,
      }),
  });
  const blocking = summary.counts.INVALID + summary.counts.DUPLICATE_IN_FILE;

  return (
    <Card>
      <CardHeader
        title={`2. Review ${summary.fileName}`}
        description={
          summary.status === 'COMPLETED'
            ? `Imported ${formatDateTime(summary.completedAt)}`
            : `${summary.totalRows} rows checked`
        }
        actions={
          summary.status === 'COMPLETED' ? (
            <StatusBadge label="Imported" tone="success" />
          ) : (
            <Button disabled={!summary.canConfirm} onClick={onConfirm}>
              Confirm import
            </Button>
          )
        }
      />
      {blocking > 0 && summary.status !== 'COMPLETED' ? (
        <p
          role="alert"
          className="mb-3 rounded-md border border-danger/30 bg-danger-surface p-3 text-sm text-danger"
        >
          {blocking === 1 ? '1 row has' : `${blocking} rows have`} errors or duplicates. Fix them in
          the file and upload it again.
        </p>
      ) : null}
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter rows by result">
        <Button
          size="sm"
          variant={outcome === undefined ? 'default' : 'outline'}
          onClick={() => (setOutcome(undefined), table.resetPage())}
        >
          All ({summary.totalRows})
        </Button>
        {ROSTER_ROW_OUTCOMES.map((key) => (
          <Button
            key={key}
            size="sm"
            variant={outcome === key ? 'default' : 'outline'}
            onClick={() => (setOutcome(key), table.resetPage())}
          >
            {OUTCOMES[key].label} ({summary.counts[key]})
          </Button>
        ))}
      </div>
      <DataTable
        caption="Import preview rows"
        columns={ROW_COLUMNS}
        rows={rows.data?.items ?? []}
        total={rows.data?.total ?? 0}
        state={table.state}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        getRowId={(row) => String(row.rowNumber)}
        isLoading={rows.isLoading}
        error={rows.error}
        emptyTitle="No rows with this result"
      />
    </Card>
  );
}
