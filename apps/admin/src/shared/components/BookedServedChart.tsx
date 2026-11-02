import { THEME_COLORS } from '@ennel/shared';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BookedServedPoint {
  label: string;
  booked: number;
  served: number;
}

/** Figma "Booked vs served": booked dashed, served solid, with the numbers read out for screen readers. */
export function BookedServedChart({ data }: { data: BookedServedPoint[] }) {
  return (
    <>
      <div
        className="h-44"
        role="img"
        aria-label={`Booked and served: ${data.map((point) => `${point.label} ${point.booked} booked, ${point.served} served`).join('; ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={THEME_COLORS.border} vertical={false} />
            <XAxis
              dataKey="label"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              stroke={THEME_COLORS.textMuted}
            />
            <YAxis
              allowDecimals={false}
              fontSize={11}
              width={36}
              tickLine={false}
              axisLine={false}
              stroke={THEME_COLORS.textMuted}
            />
            <Tooltip />
            <Line
              type="linear"
              dataKey="booked"
              name="Booked"
              stroke={THEME_COLORS.textMuted}
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="served"
              name="Served"
              stroke={THEME_COLORS.primary}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t-2 border-dashed border-muted-foreground" />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t-2 border-primary" />
          Served
        </span>
      </p>
    </>
  );
}
