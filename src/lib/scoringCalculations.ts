/**
 * Simplified Fair Scoring System
 * 
 * New Model:
 * - Base points per report = 20 / total_reports_for_person
 * - On time (NO_HORARIO): +base_points
 * - Late (FORA_DO_HORARIO): -base_points/2 (loses half)
 * - Error/forgot (ESQUECEU_ERRO): -base_points (loses full)
 * 
 * This ensures everyone's daily score naturally ranges from -20 to +20
 * regardless of how many reports they're responsible for.
 */

export interface ReportEntry {
  responsavel: string;
  data: string;
  tipo_relatorio: string;
  status: "NO_HORARIO" | "FORA_DO_HORARIO" | "ESQUECEU_ERRO";
  pontos_calculados: number;
}

export interface ReportConfig {
  tipo_relatorio: string;
  pontos_no_horario: number;
  pontos_fora_do_horario: number;
  pontos_esqueceu_ou_erro: number;
  responsaveis: string[];
}

export interface DailyScore {
  responsavel: string;
  data: string;
  basePointsPerReport: number;
  totalReportsExpected: number;
  dailyScore: number;
  reportsCount: number;
  onTimeCount: number;
  lateCount: number;
  errorCount: number;
}

export interface AggregatedScore {
  responsavel: string;
  totalNormalizedScore: number;
  totalDays: number;
  averageDailyScore: number;
  totalOnTime: number;
  totalLate: number;
  totalErrors: number;
  totalReports: number;
}

/**
 * Get the total number of reports a person is responsible for
 */
export function getPersonTotalReports(
  responsavel: string,
  configs: ReportConfig[]
): number {
  return configs.filter(config => 
    config.responsaveis?.includes(responsavel)
  ).length;
}

/**
 * Calculate base points per report for a person
 * Base = 20 / total_reports
 */
export function calculateBasePoints(totalReports: number): number {
  if (totalReports <= 0) return 0;
  return 20 / totalReports;
}

/**
 * Calculate points for a single report entry based on new model
 * - On time: +base
 * - Late: -base/2
 * - Error: -base
 */
export function calculateEntryPoints(
  status: "NO_HORARIO" | "FORA_DO_HORARIO" | "ESQUECEU_ERRO",
  basePoints: number
): number {
  switch (status) {
    case "NO_HORARIO":
      return basePoints;
    case "FORA_DO_HORARIO":
      return -(basePoints / 2);
    case "ESQUECEU_ERRO":
      return -basePoints;
    default:
      return 0;
  }
}

/**
 * Calculate daily score for a person on a specific day
 */
export function calculateDailyNormalizedScore(
  entries: ReportEntry[],
  configs: ReportConfig[]
): DailyScore | null {
  if (entries.length === 0) return null;

  const responsavel = entries[0].responsavel;
  const data = entries[0].data;

  // Get total reports this person is responsible for
  const totalReportsExpected = getPersonTotalReports(responsavel, configs);
  if (totalReportsExpected === 0) return null;

  // Calculate base points per report
  const basePointsPerReport = calculateBasePoints(totalReportsExpected);

  let dailyScore = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let errorCount = 0;

  entries.forEach((entry) => {
    const points = calculateEntryPoints(entry.status, basePointsPerReport);
    dailyScore += points;

    switch (entry.status) {
      case "NO_HORARIO":
        onTimeCount++;
        break;
      case "FORA_DO_HORARIO":
        lateCount++;
        break;
      case "ESQUECEU_ERRO":
        errorCount++;
        break;
    }
  });

  // Round to 2 decimal places
  dailyScore = Math.round(dailyScore * 100) / 100;

  return {
    responsavel,
    data,
    basePointsPerReport: Math.round(basePointsPerReport * 100) / 100,
    totalReportsExpected,
    dailyScore,
    reportsCount: entries.length,
    onTimeCount,
    lateCount,
    errorCount,
  };
}

/**
 * Group entries by person and date, then calculate daily scores
 */
export function calculateAllDailyScores(
  allEntries: ReportEntry[],
  configs: ReportConfig[]
): DailyScore[] {
  // Group by responsavel and date
  const grouped = new Map<string, ReportEntry[]>();

  allEntries.forEach((entry) => {
    const key = `${entry.responsavel}|${entry.data}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  });

  // Calculate daily scores for each group
  const dailyScores: DailyScore[] = [];

  grouped.forEach((entries) => {
    const score = calculateDailyNormalizedScore(entries, configs);
    if (score) {
      dailyScores.push(score);
    }
  });

  return dailyScores;
}

/**
 * Aggregate daily scores into overall ranking
 */
export function calculateAggregatedScores(
  dailyScores: DailyScore[]
): AggregatedScore[] {
  const aggregated = new Map<string, AggregatedScore>();

  dailyScores.forEach((daily) => {
    if (!aggregated.has(daily.responsavel)) {
      aggregated.set(daily.responsavel, {
        responsavel: daily.responsavel,
        totalNormalizedScore: 0,
        totalDays: 0,
        averageDailyScore: 0,
        totalOnTime: 0,
        totalLate: 0,
        totalErrors: 0,
        totalReports: 0,
      });
    }

    const agg = aggregated.get(daily.responsavel)!;
    agg.totalNormalizedScore += daily.dailyScore;
    agg.totalDays += 1;
    agg.totalOnTime += daily.onTimeCount;
    agg.totalLate += daily.lateCount;
    agg.totalErrors += daily.errorCount;
    agg.totalReports += daily.reportsCount;
  });

  // Calculate averages
  aggregated.forEach((agg) => {
    agg.averageDailyScore =
      agg.totalDays > 0
        ? Math.round((agg.totalNormalizedScore / agg.totalDays) * 100) / 100
        : 0;
    agg.totalNormalizedScore = Math.round(agg.totalNormalizedScore * 100) / 100;
  });

  // Sort by total normalized score descending
  return Array.from(aggregated.values()).sort(
    (a, b) => b.totalNormalizedScore - a.totalNormalizedScore
  );
}

/**
 * Calculate ranking for a specific date range
 */
export function calculateRankingForPeriod(
  allEntries: ReportEntry[],
  configs: ReportConfig[],
  startDate?: string,
  endDate?: string
): AggregatedScore[] {
  let filteredEntries = allEntries;

  if (startDate) {
    filteredEntries = filteredEntries.filter((e) => e.data >= startDate);
  }
  if (endDate) {
    filteredEntries = filteredEntries.filter((e) => e.data <= endDate);
  }

  const dailyScores = calculateAllDailyScores(filteredEntries, configs);
  return calculateAggregatedScores(dailyScores);
}
