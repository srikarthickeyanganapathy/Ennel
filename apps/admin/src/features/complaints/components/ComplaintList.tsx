import { type AdminComplaint } from '@ennel/shared';
import { Image } from 'lucide-react';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/ui/button';
import { formatBusinessDate, formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { CATEGORY_NAMES, MEAL_NAMES, STATUS, TYPE_NAMES } from './complaint-labels';

interface ComplaintListProps {
  items: AdminComplaint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

const context = (item: AdminComplaint) =>
  item.mealType && item.mealDate
    ? `${MEAL_NAMES[item.mealType]} · ${formatBusinessDate(item.mealDate, 'EEE d MMM')}`
    : `${TYPE_NAMES[item.type]} · ${formatDateTime(item.createdAt)}`;

/** Figma "Admin — Complaints" report list: category, status, reference, meal and a one-line excerpt. */
export function ComplaintList(props: ComplaintListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <ul aria-label="Complaints">
        {props.items.map((item) => {
          const isSelected = item.id === props.selectedId;
          return (
            <li key={item.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`${item.referenceCode}: ${CATEGORY_NAMES[item.category]}, ${STATUS[item.status].label}`}
                onClick={() => props.onSelect(item.id)}
                className={cn(
                  'flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-mint/50',
                  isSelected && 'bg-mint',
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="text-sm font-semibold">{CATEGORY_NAMES[item.category]}</span>
                  {item.photoCount > 0 ? (
                    <Image
                      aria-label={`${item.photoCount} photo(s)`}
                      className="size-3.5 text-muted-foreground"
                    />
                  ) : null}
                  <span className="ml-auto">
                    <StatusBadge {...STATUS[item.status]} />
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.referenceCode} · {context(item)}
                </span>
                <span className="line-clamp-1 text-[13px]">{item.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {props.pageCount > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="ghost"
            disabled={props.page <= 1}
            onClick={() => props.onPageChange(props.page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {props.page} of {props.pageCount}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={props.page >= props.pageCount}
            onClick={() => props.onPageChange(props.page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
