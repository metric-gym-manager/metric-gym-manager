// ============================================================
// REVENUE TYPES
// ============================================================

export interface MonthlyRevenue {
  year: number;
  month: number;
  monthLabel: string; // e.g., "Jan 2024"
  collectedRevenue: number;
  projectedRevenue: number;
}

export interface YearlyRevenue {
  year: number;
  collectedRevenue: number;
  projectedRevenue: number;
}

export interface RevenueMetrics {
  totalActiveMembers: number;
  totalRevenueSinceInception: number;
  averageRevenuePerMember: number;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface MonthlyRevenueResponse {
  currentMonth: {
    collectedRevenue: number;
    projectedRevenue: number;
  };
  historicalData: MonthlyRevenue[];
  metrics: RevenueMetrics;
}

export interface YearlyRevenueResponse {
  currentYear: {
    collectedRevenue: number;
    projectedRevenue: number;
  };
  historicalData: YearlyRevenue[];
  metrics: RevenueMetrics;
}
