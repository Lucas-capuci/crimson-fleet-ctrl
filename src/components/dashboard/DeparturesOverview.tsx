import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, TrendingUp, Users } from "lucide-react";

const teamTypeLabels: Record<string, string> = {
  linha_viva: "Linha Viva",
  linha_morta: "Linha Morta",
  poda: "Poda",
  linha_morta_obras: "LM Obras",
};

interface DepartureRecord {
  id: string;
  departed: boolean;
  departure_time: string | null;
  no_departure_reason: string | null;
  teams: { name: string } | null;
  supervisorName: string;
}

export function DeparturesOverview() {
  const today = format(new Date(), "yyyy-MM-dd");

  // Weekly departures for analytics
  const { data: weeklyDepartures } = useQuery({
    queryKey: ["dashboard_weekly_departures"],
    queryFn: async () => {
      const startDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("departures")
        .select(`*, teams!inner(name, type)`)
        .gte("date", startDate);
      if (error) throw error;
      return data;
    },
  });

  // Today's departures list
  const { data: departures = [], isLoading } = useQuery({
    queryKey: ["dashboard_departures", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departures")
        .select("id, departed, departure_time, no_departure_reason, supervisor_id, teams(name)")
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
      
      return data.map(d => ({
        id: d.id,
        departed: d.departed,
        departure_time: d.departure_time,
        no_departure_reason: d.no_departure_reason,
        teams: d.teams,
        supervisorName: profilesMap.get(d.supervisor_id) || "-"
      })) as DepartureRecord[];
    },
  });

  // Calculate average departure time by team type
  const avgTimeByType = weeklyDepartures?.reduce((acc, dep) => {
    if (dep.departed && dep.departure_time && dep.teams) {
      const type = dep.teams.type;
      if (!acc[type]) acc[type] = { total: 0, count: 0 };
      const [hours, minutes] = dep.departure_time.split(":").map(Number);
      acc[type].total += hours * 60 + minutes;
      acc[type].count += 1;
    }
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const avgTimeFormatted = Object.entries(avgTimeByType || {}).map(([type, data]) => {
    const avgMinutes = Math.round(data.total / data.count);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    return {
      type,
      label: teamTypeLabels[type] || type,
      avgTime: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
    };
  });

  // Calculate daily departure percentage
  const dailyStats = weeklyDepartures?.reduce((acc, dep) => {
    const date = dep.date;
    if (!acc[date]) acc[date] = { total: 0, departed: 0 };
    acc[date].total += 1;
    if (dep.departed) acc[date].departed += 1;
    return acc;
  }, {} as Record<string, { total: number; departed: number }>);

  const dailyPercentages = Object.entries(dailyStats || {})
    .map(([date, data]) => ({
      date,
      dateFormatted: format(new Date(date + "T12:00:00"), "EEE dd/MM", { locale: ptBR }),
      percentage: data.total > 0 ? Math.round((data.departed / data.total) * 100) : 0,
      departed: data.departed,
      total: data.total,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  // Overall stats
  const totalDepartures = weeklyDepartures?.length || 0;
  const totalDeparted = weeklyDepartures?.filter((d) => d.departed).length || 0;
  const overallPercentage = totalDepartures > 0 ? Math.round((totalDeparted / totalDepartures) * 100) : 0;
  const todayStats = dailyPercentages.find(d => d.date === today);

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
            <div className="text-2xl font-bold text-foreground">{avgTimeFormatted.length}</div>
            <p className="text-xs text-muted-foreground">com registros esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Average Time by Team Type */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Média de Horário de Saída por Tipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {avgTimeFormatted.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {avgTimeFormatted.map((item) => (
                <div key={item.type} className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-bold text-foreground">{item.avgTime}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum dado de saída registrado</p>
          )}
        </CardContent>
      </Card>

      {/* Daily Percentage */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Porcentagem de Saída por Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyPercentages.length > 0 ? (
            <div className="space-y-3">
              {dailyPercentages.map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20 capitalize">{day.dateFormatted}</span>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${day.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">{day.percentage}%</span>
                  <span className="text-xs text-muted-foreground w-10">({day.departed}/{day.total})</span>
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
    </div>
  );
}