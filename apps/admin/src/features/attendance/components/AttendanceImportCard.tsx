import {
  ATTENDANCE_IMPORT_COLUMN,
  type AttendanceImport,
  type AttendanceWindowQuery,
} from '@ennel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { StatusBadge, type StatusTone } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Input, Label } from '@/shared/components/ui/form-controls';
import { confirmAttendanceImport, uploadAttendance } from '../api/attendance-api';

const OUTCOME: Record<
  AttendanceImport['rows'][number]['outcome'],
  { label: string; tone: StatusTone }
> = {
  VALID: { label: 'Will be recorded', tone: 'success' },
  INVALID: { label: 'Skipped', tone: 'danger' },
  DUPLICATE_IN_FILE: { label: 'Duplicate', tone: 'warning' },
  EXISTING_UNCHANGED: { label: 'Already present', tone: 'neutral' },
};

/** Admin §I attendance import for the selected window: preview first, then confirm. */
export function AttendanceImportCard({ target }: { target: AttendanceWindowQuery }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AttendanceImport | null>(null);
  const upload = useMutation({
    mutationFn: (selected: File) => uploadAttendance(target, selected),
    onSuccess: setPreview,
  });
  const confirm = useMutation({
    mutationFn: (importId: string) => confirmAttendanceImport(importId),
    onSuccess: (result) => {
      setPreview(result);
      toast.success(`${result.appliedRows} attendance records imported.`);
      void queryClient.invalidateQueries({ queryKey: ['attendance-counter'] });
    },
  });

  return (
    <Card>
      <CardHeader
        title="Import attendance"
        description={`A CSV or XLSX file with a "${ATTENDANCE_IMPORT_COLUMN}" column, for the meal shown above. Nothing is recorded until you confirm.`}
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={id}>File</Label>
          <Input
            id={id}
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => (setFile(event.target.files?.[0] ?? null), setPreview(null))}
          />
        </div>
        <Button
          variant="outline"
          disabled={!file || upload.isPending}
          onClick={() => file && (confirm.reset(), upload.mutate(file))}
        >
          {upload.isPending ? 'Checking…' : 'Check file'}
        </Button>
      </div>
      {upload.error ? (
        <p className="mt-3 text-sm text-danger">{errorMessage(upload.error)}</p>
      ) : null}
      {preview ? (
        <div className="mt-4">
          <p className="text-sm">
            {preview.totalRows} rows: <strong>{preview.validRows} will be recorded</strong>,{' '}
            {preview.invalidRows} skipped.
            {preview.status === 'COMPLETED' ? ` Imported ${preview.appliedRows}.` : ''}
          </p>
          <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Import preview</caption>
              <thead className="bg-surface text-left">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Row
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Reference number
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-border">
                    <td className="px-3 py-1.5">{row.rowNumber}</td>
                    <td className="px-3 py-1.5">{row.referenceNumber || '—'}</td>
                    <td className="px-3 py-1.5">
                      <StatusBadge {...OUTCOME[row.outcome]} />
                      {row.message ? (
                        <span className="ml-2 text-xs text-muted-foreground">{row.message}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {confirm.error ? (
            <p className="mt-2 text-sm text-danger">{errorMessage(confirm.error)}</p>
          ) : null}
          {preview.status === 'VALIDATED' ? (
            <Button
              className="mt-3"
              disabled={preview.validRows === 0 || confirm.isPending}
              onClick={() => confirm.mutate(preview.id)}
            >
              {confirm.isPending ? 'Importing…' : `Record ${preview.validRows} attendance`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
