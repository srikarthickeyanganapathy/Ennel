import { type AdminHostel } from '@ennel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/features/auth/auth-context';
import { errorMessage } from '@/shared/api-client/api-error';
import { EmptyState, QueryBoundary } from '@/shared/components/QueryStates';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/form-controls';
import { Switch } from '@/shared/components/ui/switch';
import { PageHeader } from '@/shared/layout/PageHeader';
import {
  createBlock,
  createHostel,
  listHostels,
  updateBlock,
  updateHostel,
} from '../api/mess-config-api';

const activeBadge = (isActive: boolean) => (
  <StatusBadge label={isActive ? 'Active' : 'Inactive'} tone={isActive ? 'success' : 'neutral'} />
);

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
    <div>
      <PageHeader
        title="Hostels"
        breadcrumbs={[{ label: 'Hostels' }]}
        description="Roster files must name a hostel and block listed here."
        actions={
          canEdit ? (
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
                className="h-12 w-56"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" className="h-12 font-semibold" disabled={addHostel.isPending}>
                Add hostel
              </Button>
            </form>
          ) : null
        }
      />
      {addHostel.error ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {errorMessage(addHostel.error)}
        </p>
      ) : null}
      <QueryBoundary
        isLoading={hostels.isLoading}
        error={hostels.error}
        onRetry={() => void hostels.refetch()}
      >
        {hostels.data?.length === 0 ? <EmptyState title="No hostels yet" /> : null}
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
          {(hostels.data ?? []).map((hostel) => (
            <HostelCard key={hostel.id} hostel={hostel} canEdit={canEdit} onSaved={onSaved} />
          ))}
        </div>
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
  const students = hostel.blocks.reduce((total, block) => total + block.studentCount, 0);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{hostel.name}</h2>
          <p className="text-xs text-muted-foreground">
            {hostel.blocks.length} {hostel.blocks.length === 1 ? 'block' : 'blocks'} · {students}{' '}
            {students === 1 ? 'student' : 'students'}
          </p>
        </div>
        {activeBadge(hostel.isActive)}
        {canEdit ? (
          <Switch
            label={`${hostel.name} is active`}
            isOn={hostel.isActive}
            disabled={toggleHostel.isPending}
            onToggle={() => toggleHostel.mutate()}
          />
        ) : null}
      </div>
      {hostel.blocks.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {hostel.blocks.map((block) => (
            <li key={block.id} className="flex items-center gap-2.5 py-2.5">
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-semibold">{block.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {block.studentCount} {block.studentCount === 1 ? 'student' : 'students'}
                </span>
              </span>
              {activeBadge(block.isActive)}
              {canEdit ? (
                <Switch
                  label={`${block.name} is active`}
                  isOn={block.isActive}
                  disabled={toggleBlock.isPending}
                  onToggle={() => toggleBlock.mutate({ id: block.id, isActive: !block.isActive })}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => (event.preventDefault(), blockName.trim() && addBlock.mutate())}
        >
          <Input
            aria-label={`New block in ${hostel.name}`}
            placeholder="New block name"
            className="min-w-0 flex-1"
            value={blockName}
            onChange={(event) => setBlockName(event.target.value)}
          />
          <Button variant="outline" type="submit" disabled={addBlock.isPending}>
            Add block
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(error)}
        </p>
      ) : null}
    </Card>
  );
}
