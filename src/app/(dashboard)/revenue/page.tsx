'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import MetricCard from '@/components/revenue/MetricCard';
import RevenueChart from '@/components/revenue/RevenueChart';
import type { MonthlyRevenueResponse, YearlyRevenueResponse } from '@/features/revenue/types';

export default function RevenuePage() {
  const [viewType, setViewType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Generate year options (current year and 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Generate month options
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  // Fetch monthly revenue data
  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery<MonthlyRevenueResponse>({
    queryKey: ['revenue', 'monthly', selectedYear, selectedMonth],
    queryFn: async () => {
      const response = await fetch(
        `/api/revenue/monthly?year=${selectedYear}&month=${selectedMonth}`
      );
      if (!response.ok) throw new Error('Failed to fetch monthly revenue');
      const result = await response.json();
      return result.data;
    },
    enabled: viewType === 'monthly',
  });

  // Fetch yearly revenue data
  const { data: yearlyData, isLoading: isLoadingYearly } = useQuery<YearlyRevenueResponse>({
    queryKey: ['revenue', 'yearly', selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/revenue/yearly?year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch yearly revenue');
      const result = await response.json();
      return result.data;
    },
    enabled: viewType === 'yearly',
  });

  const isLoading = viewType === 'monthly' ? isLoadingMonthly : isLoadingYearly;
  const currentData = viewType === 'monthly' ? monthlyData : yearlyData;

  // Format currency
  const formatCurrency = (value: number) => {
    return `LKR ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revenue</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track your gym's financial performance
          </p>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">View Type</label>
          <Select
            value={viewType}
            onValueChange={(value: 'monthly' | 'yearly') => setViewType(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly View</SelectItem>
              <SelectItem value="yearly">Yearly View</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Year</label>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {viewType === 'monthly' && (
          <div>
            <label className="text-sm font-medium mb-2 block">Month</label>
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-gray-500">Loading revenue data...</p>
        </div>
      ) : (
        <>
          {/* Current Period Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            <MetricCard
              title={
                viewType === 'monthly'
                  ? 'Fees Collected in the Current Month'
                  : 'Fees Collected in the Current Year'
              }
              value={formatCurrency(
                viewType === 'monthly'
                  ? monthlyData?.currentMonth.collectedRevenue || 0
                  : yearlyData?.currentYear.collectedRevenue || 0
              )}
              subtitle="Actual payments received"
              icon={<span className="text-2xl">💰</span>}
            />
            <MetricCard
              title={
                viewType === 'monthly'
                  ? 'Outstanding Fees for the Current Month'
                  : 'Outstanding Fees for the Current Year'
              }
              value={(() => {
                const outstanding = viewType === 'monthly'
                  ? (monthlyData?.currentMonth.projectedRevenue || 0) - (monthlyData?.currentMonth.collectedRevenue || 0)
                  : (yearlyData?.currentYear.projectedRevenue || 0) - (yearlyData?.currentYear.collectedRevenue || 0);

                if (outstanding <= 0) {
                  return viewType === 'monthly'
                    ? '✓ All fees collected for this month'
                    : '✓ All fees collected for this year';
                }
                return formatCurrency(outstanding);
              })()}
              valueClassName={(() => {
                const outstanding = viewType === 'monthly'
                  ? (monthlyData?.currentMonth.projectedRevenue || 0) - (monthlyData?.currentMonth.collectedRevenue || 0)
                  : (yearlyData?.currentYear.projectedRevenue || 0) - (yearlyData?.currentYear.collectedRevenue || 0);
                return outstanding <= 0 ? 'text-green-600' : '';
              })()}
              subtitle={(() => {
                const outstanding = viewType === 'monthly'
                  ? (monthlyData?.currentMonth.projectedRevenue || 0) - (monthlyData?.currentMonth.collectedRevenue || 0)
                  : (yearlyData?.currentYear.projectedRevenue || 0) - (yearlyData?.currentYear.collectedRevenue || 0);
                return outstanding <= 0
                  ? 'No outstanding payments'
                  : 'Outstanding amount from active members';
              })()}
              icon={<span className="text-2xl">📊</span>}
            />
          </div>

          {/* Additional Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Total Active Members"
              value={currentData?.metrics.totalActiveMembers || 0}
              subtitle="Currently active subscriptions"
              icon={<span className="text-2xl">👥</span>}
            />
            <MetricCard
              title="Total Revenue Since Inception"
              value={formatCurrency(currentData?.metrics.totalRevenueSinceInception || 0)}
              subtitle="All-time collected revenue"
              icon={<span className="text-2xl">💵</span>}
            />
            <MetricCard
              title="Average Revenue Per Member"
              value={formatCurrency(currentData?.metrics.averageRevenuePerMember || 0)}
              subtitle="Lifetime value per member"
              icon={<span className="text-2xl">📈</span>}
            />
          </div>

          {/* Historical Chart */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              {viewType === 'monthly' ? 'Monthly Revenue History' : 'Yearly Revenue History'}
            </h2>
            <RevenueChart
              data={
                viewType === 'monthly'
                  ? monthlyData?.historicalData || []
                  : yearlyData?.historicalData || []
              }
              viewType={viewType}
            />
          </div>
        </>
      )}
    </div>
  );
}
