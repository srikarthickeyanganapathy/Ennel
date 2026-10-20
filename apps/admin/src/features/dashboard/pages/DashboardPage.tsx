import { Link } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/layout/PageHeader';

/** Placeholder until the live dashboard (Admin §C) arrives with bookings in Phase 4. */
export function DashboardPage() {
  const { me } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Signed in as ${me?.fullName ?? ''}`} />
      <Card>
        <CardHeader
          title="Meal counts"
          description="Booked, expected and attended counts appear here once bookings start (Phase 4)."
        />
      </Card>
      <Card>
        <CardHeader title="Quick actions" />
        <div className="flex flex-wrap gap-2">
          <PermissionGate permissions={['menus:read']}>
            <Button variant="outline" asChild>
              <Link to="/menus">Edit or publish menus</Link>
            </Button>
          </PermissionGate>
          <PermissionGate permissions={['roster:import']}>
            <Button variant="outline" asChild>
              <Link to="/students/import">Import roster</Link>
            </Button>
          </PermissionGate>
          <PermissionGate permissions={['mess-config:read']}>
            <Button variant="outline" asChild>
              <Link to="/mess-config">Slots and capacities</Link>
            </Button>
          </PermissionGate>
        </div>
      </Card>
    </div>
  );
}
