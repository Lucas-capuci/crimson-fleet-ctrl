/**
 * Normalized Weighted Average Scoring System
 * 
 * This module implements a fair scoring system that normalizes daily scores
 * to a range of -20 to +20, regardless of the number of reports a person is responsible for.
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
  sumObtained: number;
  sumMax: number;
  sumMin: number;
  performanceIndex: number;
  normalizedScore: number;
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
 * Calculate normalized daily score for a person on a specific day
 */
export function calculateDailyNormalizedScore(
  entries: ReportEntry[],
  configs: ReportConfig[]
): DailyScore | null {
  if (entries.length === 0) return null;

  const responsavel = entries[0].responsavel;
  const data = entries[0].data;

  let sumObtained = 0;
  let sumMax = 0;
  let sumMin = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let errorCount = 0;

  entries.forEach((entry) => {
    const config = configs.find((c) => c.tipo_relatorio === entry.tipo_relatorio);
    if (!config) return;

    // Maximum points (all on time)
    sumMax += config.pontos_no_horario;
    // Minimum points (all errors)
    sumMin += config.pontos_esqueceu_ou_erro;

    // Actual points based on status
    switch (entry.status) {
      case "NO_HORARIO":
        sumObtained += config.pontos_no_horario;
        onTimeCount++;
        break;
      case "FORA_DO_HORARIO":
        sumObtained += config.pontos_fora_do_horario;
        lateCount++;
        break;
      case "ESQUECEU_ERRO":
        sumObtained += config.pontos_esqueceu_ou_erro;
        errorCount++;
        break;
    }
  });

  // Calculate performance index (0 to 1)
  const range = sumMax - sumMin;
  const performanceIndex = range !== 0 ? (sumObtained - sumMin) / range : 0.5;

  // Convert to daily score (-20 to +20)
  const normalizedScore = Math.round((performanceIndex * 40 - 20) * 100) / 100;

  return {
    responsavel,
    data,
    sumObtained,
    sumMax,
    sumMin,
    performanceIndex,
    normalizedScore,
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
    agg.totalNormalizedScore += daily.normalizedScore;
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
