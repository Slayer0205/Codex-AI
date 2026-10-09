import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { money } from "../lib";
export function SalesChart({
  data,
  comparison = false,
}: {
  data: { date: string; revenue: number; expenses: number; profit: number }[];
  comparison?: boolean;
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Sana bo‘yicha savdo va xarajat grafigi"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16b890" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#16b890" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 6"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            minTickGap={28}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={(v) =>
              v >= 1e6
                ? `${v / 1e6}m`
                : v >= 1000
                  ? `${Math.round(v / 1000)}k`
                  : v
            }
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "var(--text)",
            }}
            formatter={(value: any, name: any) => [
              `${money(Number(value) * 100)} so‘m`,
              name === "revenue"
                ? "Savdo"
                : name === "profit"
                  ? "Foyda"
                  : "Xarajat",
            ]}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="revenue"
            stroke="#16b890"
            strokeWidth={3}
            fill="url(#revenueFill)"
            activeDot={{ r: 5, strokeWidth: 4, stroke: "var(--surface)" }}
          />
          {comparison && (
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="expenses"
              stroke="#9b82e0"
              strokeWidth={2}
              fill="transparent"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ProfitChart({
  data,
}: {
  data: { date: string; profit: number; revenue: number; expenses: number }[];
}) {
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="4 6"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
            formatter={(v: any) => `${money(Number(v) * 100)} so‘m`}
          />
          <Legend />
          <Bar
            isAnimationActive={false}
            dataKey="profit"
            name="Sof foyda"
            fill="#8c78d6"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
