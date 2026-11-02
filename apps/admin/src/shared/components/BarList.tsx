/** The Figma horizontal bars ("Complaints by category", "Food waste estimate"). */
export function BarList({
  rows,
  unit = '',
  labelWidth = 'w-28',
}: {
  rows: { key: string; label: string; value: number }[];
  unit?: string;
  labelWidth?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2 text-[13px]">
          <span className={`${labelWidth} shrink-0 truncate`}>{row.label}</span>
          <span
            aria-hidden
            className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface"
          >
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.round((row.value / max) * 100)}%` }}
            />
          </span>
          <span className="shrink-0 text-right font-semibold whitespace-nowrap tabular-nums">
            {row.value.toLocaleString('en-IN')}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
