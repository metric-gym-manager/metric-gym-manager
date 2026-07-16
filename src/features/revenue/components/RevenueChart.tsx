'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyRevenue, YearlyRevenue } from '@/features/revenue/types';

interface RevenueChartProps {
  data: MonthlyRevenue[] | YearlyRevenue[];
  viewType: 'monthly' | 'yearly';
}

// Format currency for tooltip
const formatCurrency = (value: number) => {
  return `LKR ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface RevenueTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

// Module-scope component: creating it inside RevenueChart's render would
// remount it (and lose its DOM) on every parent render
function CustomTooltip({ active, payload, label }: RevenueTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-white p-4 shadow-lg">
        <p className="font-semibold mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-sm text-green-600">
            Collected: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-sm text-blue-600">
            Projected: {formatCurrency(payload[1].value)}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

export default function RevenueChart({ data, viewType }: RevenueChartProps) {
  // Prepare chart data
  const chartData = data.map((item) => ({
    label: viewType === 'monthly' ? (item as MonthlyRevenue).monthLabel : `${(item as YearlyRevenue).year}`,
    Collected: item.collectedRevenue,
    Projected: item.projectedRevenue,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border bg-gray-50">
        <p className="text-sm text-gray-500">No revenue data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            angle={viewType === 'monthly' ? -45 : 0}
            textAnchor={viewType === 'monthly' ? 'end' : 'middle'}
            height={viewType === 'monthly' ? 80 : 50}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="Collected" fill="#10b981" name="Collected Revenue" />
          <Bar dataKey="Projected" fill="#3b82f6" name="Projected Revenue" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
