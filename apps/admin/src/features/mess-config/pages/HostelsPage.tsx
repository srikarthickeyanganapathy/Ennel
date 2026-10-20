import { type AdminHostel } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { errorMessage } from '@/shared/api-client/api-error';
import { EmptyState, QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/form-controls';
import { PageHeader } from '@/shared/layout/PageHeader';
import {
  createBlock,
  createHostel,
  listHostels,
  updateBlock,
  updateHostel,
} from '../api/mess-config-api';

/** Hostels and blocks used by roster import and student profiles; deactivated, never deleted. */
export function HostelsPage() {
  const queryClient = useQueryClient();
  const canEdit = usePermissions()('mess-config:update');
  const hostels = useQuery({ queryKey: ['hostels'], queryFn: listHostels });
  const [name, setName] = useState('');
  const onSaved = (items: AdminHostel[]) => {
    queryClient.setQueryData(['hostels'], items);
    toast.success('Saved.');
  };
  const addHostel = useMutation({
    mutationFn: createHostel,
    onSuccess: (items) => (setName(''), onSaved(items)),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Hostels"
        breadcrumbs={[{ label: 'Hostels' }]}
        description="Roster files must name a hostel and block listed here."
      />
      {canEdit ? (
        <Card>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => (
              event.preventDefault(),
              name.trim() && addHostel.mutate(name.trim())
            )}
          >
            <Input
              aria-label="New hostel name"
              placeholder="New hostel name"
              className="max-w-xs"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" disabled={addHostel.isPending}>
              Add hostel
            </Button>
          </form>
          {addHostel.error ? (
            <p className="mt-2 text-sm text-danger">{errorMessage(addHostel.error)}</p>
          ) : null}
        </Card>
      ) : null}
      <QueryBoundary
        isLoading={hostels.isLoading}
        error={hostels.error}
        onRetry={() => void hostels.refetch()}
      >
        {hostels.data?.length === 0 ? <EmptyState title="No hostels yet" /> : null}
        {(hostels.data ?? []).map((hostel) => (
          <HostelCard key={hostel.id} hostel={hostel} canEdit={canEdit} onSaved={onSaved} />
        ))}
      </QueryBoundary>
    </div>
  );
}

function HostelCard({
  hostel,
  canEdit,
  onSaved,
}: {
  hostel: AdminHostel;
  canEdit: boolean;
  onSaved: (items: AdminHostel[]) => void;
}) {
  const [blockName, setBlockName] = useState('');
  const toggleHostel = useMutation({
    mutationFn: () => updateHostel(hostel.id, { isActive: !hostel.isActive }),
    onSuccess: onSaved,
  });
  const addBlock = useMutation({
    mutationFn: () => createBlock(hostel.id, blockName.trim()),
    onSuccess: (items) => (setBlockName(''), onSaved(items)),
  });
  const toggleBlock = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateBlock(id, { isActive }),
    onSuccess: onSaved,
  });
  const error = toggleHostel.error ?? addBlock.error ?? toggleBlock.error;

  return (
    <Card>
      <CardHeader
        title={hostel.name}
        actions={
          <>
            <StatusBadge
              label={hostel.isActive ? 'Active' : 'Inactive'}
              tone={hostel.isActive ? 'success' : 'neutral'}
            />
            {canEdit ? (
              <Button size="sm" variant="outline" onClick={() => toggleHostel.mutate()}>
                {hostel.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            ) : null}
          </>
        }
      />
      <ul className="divide-y divide-border text-sm">
        {hostel.blocks.map((block) => (
          <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              {block.name}{' '}
              <span className="text-muted-foreground">· {block.studentCount} students</span>
            </span>
            <span className="flex items-center gap-2">
              <StatusBadge
                label={block.isActive ? 'Active' : 'Inactive'}
                tone={block.isActive ? 'success' : 'neutral'}
              />
              {canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleBlock.mutate({ id: block.id, isActive: !block.isActive })}
                >
                  {block.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => (event.preventDefault(), blockName.trim() && addBlock.mutate())}
        >
          <Input
            aria-label={`New block in ${hostel.name}`}
            placeholder="New block name"
            className="max-w-xs"
            value={blockName}
            onChange={(event) => setBlockName(event.target.value)}
          />
          <Button size="sm" type="submit" disabled={addBlock.isPending}>
            Add block
          </Button>
        </form>
      ) : null}
      {error ? <p className="mt-2 text-sm text-danger">{errorMessage(error)}</p> : null}
    </Card>
  );
}
