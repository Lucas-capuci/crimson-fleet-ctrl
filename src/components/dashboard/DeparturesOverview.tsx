import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, TrendingUp, Users, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExportButton } from "@/components/ExportButton";
import { CsvColumn, formatBoolean } from "@/lib/exportCsv";

const teamTypeLabels: Record<string, string> = {
  linha_viva: "Linha Viva",
  linha_morta: "Linha Morta",
  poda: "Poda",
  linha_morta_obras: "LM Obras",
  linha_viva_obras: "LV Obras",
  recolha: "Recolha",
};

interface DepartureRecord {
  id: string;
  departed: boolean;
  departure_time: string | null;
  no_departure_reason: string | null;
  teams: { id: string; name: string; type: string } | null;
  supervisorName: string;
  date: string;
  scheduled_entry_time?: string;
}

interface DailyStats {
  date: string;
  dateFormatted: string;
  percentage: number;
  departed: number;
  total: number;
  avgDelayMinutes: number | null;
  departures: DepartureRecord[];
}

interface TeamTypeStats {
  type: string;
  label: string;
  departed: number;
  total: number;
  percentage: number;
  avgDelayMinutes: number | null;
}

export function DeparturesOverview() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDay, setSelectedDay] = useState<DailyStats | null>(null);

  // Weekly departures for analytics
  const { data: weeklyDepartures = [] } = useQuery({
    queryKey: ["dashboard_weekly_departures"],
    queryFn: async () => {
      const startDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("departures")
        .select(`*, teams!inner(id, name, type, scheduled_entry_time)`)
        .gte("date", startDate);
      if (error) throw error;
      
      // Fetch supervisor names
      const supervisorIds = [...new Set(data.map(d => d.supervisor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", supervisorIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      
      return data.map(d => ({
        id: d.id,
        departed: d.departed,
        departure_time: d.departure_time,
        no_departure_reason: d.no_departure_reason,
        teams: d.teams,
        date: d.date,
        supervisorName: profilesMap.get(d.supervisor_id) || "-",
        scheduled_entry_time: d.teams?.scheduled_entry_time || "07:00:00"
      })) as DepartureRecord[];
    },
  });

  // Today's departures list
  const { data: departures = [], isLoading } = useQuery({
    queryKey: ["dashboard_departures", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departures")
        .select("id, departed, departure_time, no_departure_reason, supervisor_id, date, team_id, teams(id, name, type, scheduled_entry_time)")
        .eq("date", today)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      
      const supervisorIds = [...new Set(data.map(d => d.supervisor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", supervisorIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      
      return data
        .filter(d => d.teams !== null)
        .map(d => ({
          id: d.id,
          departed: d.departed,
          departure_time: d.departure_time,
          no_departure_reason: d.no_departure_reason,
          teams: d.teams,
          date: d.date,
          supervisorName: profilesMap.get(d.supervisor_id) || "-",
          scheduled_entry_time: d.teams?.scheduled_entry_time || "07:00:00"
        })) as DepartureRecord[];
    },
  });

  // Helper function to calculate delay in minutes
  const calculateDelayMinutes = (departureTime: string, scheduledTime: string = "07:00:00"): number => {
    const [depHours, depMinutes] = departureTime.split(":").map(Number);
    const [schHours, schMinutes] = scheduledTime.split(":").map(Number);
    const depTotalMinutes = depHours * 60 + depMinutes;
    const schTotalMinutes = schHours * 60 + schMinutes;
    return depTotalMinutes - schTotalMinutes;
  };

  // Calculate average delay in minutes by team type
  const avgDelayByType = weeklyDepartures?.reduce((acc, dep) => {
    if (dep.departed && dep.departure_time && dep.teams) {
      const type = dep.teams.type;
      if (!acc[type]) acc[type] = { totalDelay: 0, count: 0 };
      const delay = calculateDelayMinutes(dep.departure_time, dep.scheduled_entry_time);
      acc[type].totalDelay += delay;
      acc[type].count += 1;
    }
    return acc;
  }, {} as Record<string, { totalDelay: number; count: number }>);

  const avgDelayFormatted = Object.entries(avgDelayByType || {}).map(([type, data]) => {
    const avgDelay = Math.round(data.totalDelay / data.count);
    return {
      type,
      label: teamTypeLabels[type] || type,
      avgDelayMinutes: avgDelay,
    };
  });

  // Calculate daily stats including average delay
  const dailyStats = weeklyDepartures?.reduce((acc, dep) => {
    const date = dep.date;
    if (!acc[date]) acc[date] = { total: 0, departed: 0, totalDelayMinutes: 0, departedWithTime: 0, departures: [] };
    acc[date].total += 1;
    acc[date].departures.push(dep);
    if (dep.departed) {
      acc[date].departed += 1;
      if (dep.departure_time) {
        const delay = calculateDelayMinutes(dep.departure_time, dep.scheduled_entry_time);
        acc[date].totalDelayMinutes += delay;
        acc[date].departedWithTime += 1;
      }
    }
    return acc;
  }, {} as Record<string, { total: number; departed: number; totalDelayMinutes: number; departedWithTime: number; departures: DepartureRecord[] }>);

  const dailyPercentages: DailyStats[] = Object.entries(dailyStats || {})
    .map(([date, data]) => {
      let avgDelayMinutes: number | null = null;
      if (data.departedWithTime > 0) {
        avgDelayMinutes = Math.round(data.totalDelayMinutes / data.departedWithTime);
      }
      return {
        date,
        dateFormatted: format(new Date(date + "T12:00:00"), "EEE dd/MM", { locale: ptBR }),
        percentage: data.total > 0 ? Math.round((data.departed / data.total) * 100) : 0,
        departed: data.departed,
        total: data.total,
        avgDelayMinutes,
        departures: data.departures,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  // Calculate team type stats for selected day
  const getTeamTypeStats = (departures: DepartureRecord[]): TeamTypeStats[] => {
    const typeStats: Record<string, { departed: number; total: number; totalDelayMinutes: number; departedWithTime: number }> = {};
    
    departures.forEach(dep => {
      const type = dep.teams?.type || "unknown";
      if (!typeStats[type]) {
        typeStats[type] = { departed: 0, total: 0, totalDelayMinutes: 0, departedWithTime: 0 };
      }
      typeStats[type].total += 1;
      if (dep.departed) {
        typeStats[type].departed += 1;
        if (dep.departure_time) {
          const delay = calculateDelayMinutes(dep.departure_time, dep.scheduled_entry_time);
          typeStats[type].totalDelayMinutes += delay;
          typeStats[type].departedWithTime += 1;
        }
      }
    });
    
    return Object.entries(typeStats).map(([type, data]) => {
      let avgDelayMinutes: number | null = null;
      if (data.departedWithTime > 0) {
        avgDelayMinutes = Math.round(data.totalDelayMinutes / data.departedWithTime);
      }
      return {
        type,
        label: teamTypeLabels[type] || type,
        departed: data.departed,
        total: data.total,
        percentage: data.total > 0 ? Math.round((data.departed / data.total) * 100) : 0,
        avgDelayMinutes,
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  };

  // Generate formatted report for clipboard
  const generateReport = (day: DailyStats): string => {
    const dateFormatted = format(new Date(day.date + "T12:00:00"), "dd/MM/yyyy").toUpperCase();
    const teamTypeStats = getTeamTypeStats(day.departures);
    
    // Group by category (OBRAS = linha_morta_obras + linha_viva_obras, MANUTENÇÃO = linha_morta + linha_viva, PODA, RECOLHA)
    const obrasLinhaMorta = teamTypeStats.find(s => s.type === "linha_morta_obras");
    const obrasLinhaViva = teamTypeStats.find(s => s.type === "linha_viva_obras");
    
    const manutLinhaMorta = teamTypeStats.find(s => s.type === "linha_morta");
    const manutLinhaViva = teamTypeStats.find(s => s.type === "linha_viva");
    const poda = teamTypeStats.find(s => s.type === "poda");
    const recolha = teamTypeStats.find(s => s.type === "recolha");
    
    const getEmoji = (percentage: number) => percentage === 100 ? "🟢" : "🔴";
    
    const getTeamDetails = (departures: DepartureRecord[], filterType: string) => {
      return departures
        .filter(d => d.teams?.type === filterType && !d.departed)
        .map(d => `${d.teams?.name} - ${d.no_departure_reason || "SEM MOTIVO"}`)
        .join("\n");
    };
    
    let report = `*ABERTURA DE TURNOS ${dateFormatted}*\n\n`;
    
    // OBRAS section (linha_morta_obras + linha_viva_obras)
    const hasObras = (obrasLinhaMorta && obrasLinhaMorta.total > 0) || (obrasLinhaViva && obrasLinhaViva.total > 0);
    if (hasObras) {
      report += `OBRAS\n\n`;
      
      if (obrasLinhaMorta && obrasLinhaMorta.total > 0) {
        report += `${getEmoji(obrasLinhaMorta.percentage)}LINHA MORTA - ${obrasLinhaMorta.departed.toString().padStart(2, "0")}/${obrasLinhaMorta.total.toString().padStart(2, "0")} - ${obrasLinhaMorta.percentage}%\n`;
        const lmObrasDetails = getTeamDetails(day.departures, "linha_morta_obras");
        if (lmObrasDetails) report += `${lmObrasDetails}\n`;
      }
      
      if (obrasLinhaViva && obrasLinhaViva.total > 0) {
        report += `${getEmoji(obrasLinhaViva.percentage)}LINHA VIVA - ${obrasLinhaViva.departed.toString().padStart(2, "0")}/${obrasLinhaViva.total.toString().padStart(2, "0")} - ${obrasLinhaViva.percentage}%\n`;
        const lvObrasDetails = getTeamDetails(day.departures, "linha_viva_obras");
        if (lvObrasDetails) report += `${lvObrasDetails}\n`;
      }
      
      report += `\n---\n\n`;
    }
    
    // MANUTENÇÃO section (linha_morta + linha_viva regular)
    if ((manutLinhaMorta && manutLinhaMorta.total > 0) || (manutLinhaViva && manutLinhaViva.total > 0)) {
      report += `MANUTENÇÃO\n\n`;
      
      if (manutLinhaMorta && manutLinhaMorta.total > 0) {
        report += `${getEmoji(manutLinhaMorta.percentage)}LINHA MORTA - ${manutLinhaMorta.departed.toString().padStart(2, "0")}/${manutLinhaMorta.total.toString().padStart(2, "0")} - ${manutLinhaMorta.percentage}%\n`;
        const lmDetails = getTeamDetails(day.departures, "linha_morta");
        if (lmDetails) report += `${lmDetails}\n`;
      }
      
      if (manutLinhaViva && manutLinhaViva.total > 0) {
        report += `${getEmoji(manutLinhaViva.percentage)}LINHA VIVA - ${manutLinhaViva.departed.toString().padStart(2, "0")}/${manutLinhaViva.total.toString().padStart(2, "0")} - ${manutLinhaViva.percentage}%\n`;
        const lvDetails = getTeamDetails(day.departures, "linha_viva");
        if (lvDetails) report += `${lvDetails}\n`;
      }
      
      report += `\n---\n\n`;
    }
    
    // PODA section
    if (poda && poda.total > 0) {
      report += `PODA\n\n`;
      report += `${getEmoji(poda.percentage)}LINHA VIVA - ${poda.departed.toString().padStart(2, "0")}/${poda.total.toString().padStart(2, "0")} - ${poda.percentage}%\n`;
      const podaDetails = getTeamDetails(day.departures, "poda");
      if (podaDetails) report += `${podaDetails}\n`;
      report += `\n---\n\n`;
    }
    
    // RECOLHA section
    if (recolha && recolha.total > 0) {
      report += `RECOLHA\n\n`;
      report += `${getEmoji(recolha.percentage)}${recolha.departed.toString().padStart(2, "0")}/${recolha.total.toString().padStart(2, "0")} - ${recolha.percentage}%\n`;
      const recolhaDetails = getTeamDetails(day.departures, "recolha");
      if (recolhaDetails) report += `${recolhaDetails}\n`;
    }
    
    return report.trim();
  };

  const copyReportToClipboard = async () => {
    if (!selectedDay) return;
    
    const report = generateReport(selectedDay);
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Relatório copiado para a área de transferência!");
    } catch (error) {
      toast.error("Erro ao copiar relatório");
    }
  };

  // Generate detailed report grouped by supervisor with team names and times
  const generateDetailedReport = (day: DailyStats): string => {
    const dateFormatted = format(new Date(day.date + "T12:00:00"), "dd/MM/yyyy");
    
    // Group departures by team type first, then by supervisor
    const typeOrder = ["linha_morta", "linha_viva", "linha_morta_obras", "linha_viva_obras", "poda", "recolha"];
    const typeLabelsForReport: Record<string, string> = {
      linha_morta: "Linha Morta",
      linha_viva: "Linha Viva",
      linha_morta_obras: "Linha Morta Obras",
      linha_viva_obras: "Linha Viva Obras",
      poda: "Poda",
      recolha: "Recolha",
    };
    
    let report = `INFORME DE ABERTURA DE TURNO - ${dateFormatted}\n\n`;
    
    // Group by type
    const departuresByType: Record<string, DepartureRecord[]> = {};
    day.departures.forEach(dep => {
      const type = dep.teams?.type || "unknown";
      if (!departuresByType[type]) departuresByType[type] = [];
      departuresByType[type].push(dep);
    });
    
    // Process each type in order
    typeOrder.forEach(type => {
      const typeDepartures = departuresByType[type];
      if (!typeDepartures || typeDepartures.length === 0) return;
      
      report += `${typeLabelsForReport[type] || type}\n\n`;
      
      // Group by supervisor within this type
      const bySupervisor: Record<string, DepartureRecord[]> = {};
      typeDepartures.forEach(dep => {
        const supervisor = dep.supervisorName || "Sem Supervisor";
        if (!bySupervisor[supervisor]) bySupervisor[supervisor] = [];
        bySupervisor[supervisor].push(dep);
      });
      
      // Output each supervisor's teams
      Object.entries(bySupervisor)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([supervisor, deps]) => {
          report += `SUPERVISOR - ${supervisor}\n\n`;
          
          deps
            .sort((a, b) => (a.teams?.name || "").localeCompare(b.teams?.name || ""))
            .forEach(dep => {
              const emoji = dep.departed ? "🟢" : "🔴";
              const timeOrReason = dep.departed 
                ? dep.departure_time || "--:--"
                : dep.no_departure_reason || "SEM MOTIVO";
              report += `${emoji}${dep.teams?.name || "?"} - ${timeOrReason}\n`;
            });
          
          report += "\n";
        });
    });
    
    return report.trim();
  };

  const copyDetailedReportToClipboard = async () => {
    if (!selectedDay) return;
    
    const report = generateDetailedReport(selectedDay);
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Relatório detalhado copiado para a área de transferência!");
    } catch (error) {
      toast.error("Erro ao copiar relatório");
    }
  };

  // Overall stats
  const totalDepartures = weeklyDepartures?.length || 0;
  const totalDeparted = weeklyDepartures?.filter((d) => d.departed).length || 0;
  const overallPercentage = totalDepartures > 0 ? Math.round((totalDeparted / totalDepartures) * 100) : 0;
  const todayStats = dailyPercentages.find(d => d.date === today);

  // CSV columns for departures
  const departuresCsvColumns: CsvColumn[] = [
    { key: "date", header: "Data", format: (v) => format(new Date(v + "T12:00:00"), "dd/MM/yyyy") },
    { key: "teams", header: "Equipe", format: (v) => v?.name || "-" },
    { key: "teams", header: "Tipo", format: (v) => teamTypeLabels[v?.type] || v?.type || "-" },
    { key: "supervisorName", header: "Supervisor" },
    { key: "departed", header: "Status", format: (v) => formatBoolean(v, "Saiu", "Não Saiu") },
    { key: "departure_time", header: "Horário", format: (v) => v || "-" },
    { key: "no_departure_reason", header: "Motivo", format: (v) => v || "-" },
  ];

  const dailyCsvColumns: CsvColumn[] = [
    { key: "date", header: "Data", format: (v) => format(new Date(v + "T12:00:00"), "dd/MM/yyyy") },
    { key: "departed", header: "Saíram" },
    { key: "total", header: "Total" },
    { key: "percentage", header: "Porcentagem", format: (v) => `${v}%` },
    { key: "avgDelayMinutes", header: "Atraso Médio (min)", format: (v) => v !== null ? `${v}` : "-" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Saída (7 dias)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overallPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              {totalDeparted} de {totalDepartures} registros
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saídas Hoje
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {todayStats?.departed || 0}/{todayStats?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayStats?.percentage || 0}% das equipes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tipos de Equipe Ativos
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{avgDelayFormatted.length}</div>
            <p className="text-xs text-muted-foreground">com registros esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Average Delay by Team Type */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Tempo Médio de Atraso por Tipo (minutos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {avgDelayFormatted.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {avgDelayFormatted.map((item) => (
                <div key={item.type} className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-bold text-foreground">{item.avgDelayMinutes} min</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum dado de saída registrado</p>
          )}
        </CardContent>
      </Card>

      {/* Daily Percentage with Average Time */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Porcentagem de Saída por Dia
          </CardTitle>
          <ExportButton
            data={dailyPercentages}
            filename={`saidas-diarias-${format(new Date(), "yyyy-MM-dd")}`}
            columns={dailyCsvColumns}
          />
        </CardHeader>
        <CardContent>
          {dailyPercentages.length > 0 ? (
            <div className="space-y-3">
              {dailyPercentages.map((day) => (
                <div 
                  key={day.date} 
                  className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedDay(day)}
                >
                  <span className="text-sm text-muted-foreground w-20 capitalize">{day.dateFormatted}</span>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${day.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">{day.percentage}%</span>
                  <span className="text-sm font-medium text-primary w-16 text-center">
                    {day.avgDelayMinutes !== null ? `${day.avgDelayMinutes} min` : "--"}
                  </span>
                  <span className="text-xs text-muted-foreground w-14">({day.departed}/{day.total})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum dado de saída registrado</p>
          )}
        </CardContent>
      </Card>

      {/* Today's Departures List */}
      <Card className="animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">
            Saídas de Hoje - {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
          </CardTitle>
          <div className="flex items-center gap-3">
            {todayStats && todayStats.total > 0 && (
              <div className="flex gap-3 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {todayStats.departed}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  {todayStats.total - todayStats.departed}
                </span>
              </div>
            )}
            <ExportButton
              data={departures}
              filename={`saidas-hoje-${format(new Date(), "yyyy-MM-dd")}`}
              columns={departuresCsvColumns}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : departures.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum lançamento registrado hoje.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Horário/Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departures.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell className="font-medium">{dep.teams?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{dep.supervisorName}</TableCell>
                    <TableCell>
                      {dep.departed ? (
                        <Badge variant="default" className="bg-green-600 text-xs">Saiu</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Não Saiu</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dep.departed ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dep.departure_time}
                        </span>
                      ) : (
                        <span className="truncate max-w-32">{dep.no_departure_reason || "-"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Day Details Modal */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              📅 Saídas - {selectedDay && format(new Date(selectedDay.date + "T12:00:00"), "EEEE dd/MM/yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDay && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-foreground">{selectedDay.percentage}%</span>
                    <span className="text-muted-foreground ml-2">({selectedDay.departed}/{selectedDay.total})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {selectedDay.avgDelayMinutes !== null && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-lg font-semibold text-primary">{selectedDay.avgDelayMinutes} min</span>
                        <span className="text-sm text-muted-foreground">atraso médio</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyDetailedReportToClipboard}
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Relatório Detalhado
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyReportToClipboard}
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copiar Relatório
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats by Team Type */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Por Tipo de Equipe
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Saíram</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead className="text-center">Atraso Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTeamTypeStats(selectedDay.departures).map((stat) => (
                      <TableRow key={stat.type}>
                        <TableCell className="font-medium">{stat.label}</TableCell>
                        <TableCell className="text-center">{stat.departed}/{stat.total}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={stat.percentage >= 80 ? "default" : stat.percentage >= 50 ? "secondary" : "destructive"}>
                            {stat.percentage}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-primary font-medium">
                          {stat.avgDelayMinutes !== null ? `${stat.avgDelayMinutes} min` : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Team List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    Detalhes das Equipes
                  </h3>
                  <ExportButton
                    data={selectedDay.departures}
                    filename={`saidas-${selectedDay.date}`}
                    columns={departuresCsvColumns}
                    size="sm"
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Horário/Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDay.departures
                      .sort((a, b) => (a.teams?.name || "").localeCompare(b.teams?.name || ""))
                      .map((dep) => (
                        <TableRow key={dep.id}>
                          <TableCell className="font-medium">{dep.teams?.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {teamTypeLabels[dep.teams?.type || ""] || dep.teams?.type}
                          </TableCell>
                          <TableCell>
                            {dep.departed ? (
                              <Badge variant="default" className="bg-green-600 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Saiu
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <XCircle className="h-3 w-3 mr-1" />
                                Não
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {dep.departed ? dep.departure_time : (dep.no_departure_reason || "-")}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
