import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, TrendingUp, Calendar, RefreshCw, Users, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

interface ProductionData {
  id: string;
  team_id: string;
  date: string;
  production_value: number;
  teams: {
    name: string;
    type: string;
  };
}

interface SupervisorTeam {
  supervisor_id: string;
  team_id: string;
  profiles: {
    name: string;
  } | null;
}

const chartConfig = {
  production: {
    label: "Produção",
    color: "hsl(var(--chart-1))",
  },
};

export default function Production() {
  const { isAdmin } = useAuth();
  const [dateRange, setDateRange] = useState<string>("month");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all");

  // Calculate date range
  const getDateRange = () => {
    const today = new Date();
    switch (dateRange) {
      case "week":
        return { start: subDays(today, 7), end: today };
      case "month":
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case "quarter":
        return { start: subDays(today, 90), end: today };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  };

  const { start, end } = getDateRange();

  // Fetch supervisor-team assignments
  const { data: supervisorTeams = [] } = useQuery({
    queryKey: ["supervisor_teams_for_production"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisor_teams")
        .select(`
          supervisor_id,
          team_id,
          profiles:supervisor_id (name)
        `);
      if (error) throw error;
      return data as unknown as SupervisorTeam[];
    },
    enabled: isAdmin,
  });

  // Get unique supervisors for filter
  const supervisors = Array.from(
    new Map(
      supervisorTeams.map((st) => [
        st.supervisor_id,
        { id: st.supervisor_id, name: st.profiles?.name || "Desconhecido" },
      ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Get team IDs for selected supervisor
  const supervisorTeamIds = selectedSupervisor !== "all"
    ? supervisorTeams.filter((st) => st.supervisor_id === selectedSupervisor).map((st) => st.team_id)
    : [];

  // Fetch production data
  const { data: productionData = [], isLoading, refetch } = useQuery({
    queryKey: ["production_data", dateRange, selectedTeam, selectedSupervisor],
    queryFn: async () => {
      let query = supabase
        .from("production_data")
        .select(`
          id,
          team_id,
          date,
          production_value,
          teams (name, type)
        `)
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"))
        .order("date", { ascending: true });

      if (selectedTeam !== "all") {
        query = query.eq("team_id", selectedTeam);
      } else if (selectedSupervisor !== "all" && supervisorTeamIds.length > 0) {
        query = query.in("team_id", supervisorTeamIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ProductionData[];
    },
  });

  // Fetch teams for filter
  const { data: teams = [] } = useQuery({
    queryKey: ["teams_for_production", selectedSupervisor],
    queryFn: async () => {
      let query = supabase.from("teams").select("id, name, type").order("name");

      // If supervisor is selected, only show their teams
      if (selectedSupervisor !== "all" && supervisorTeamIds.length > 0) {
        query = query.in("id", supervisorTeamIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate summary stats
  const totalProduction = productionData.reduce((sum, item) => sum + item.production_value, 0);
  const avgProduction = productionData.length > 0 ? totalProduction / productionData.length : 0;
  const uniqueTeams = new Set(productionData.map((item) => item.team_id)).size;
  const lastUpdate = productionData.length > 0 
    ? format(new Date(Math.max(...productionData.map((d) => new Date(d.date).getTime()))), "dd/MM/yyyy", { locale: ptBR })
    : "-";

  // Prepare chart data - group by date
  const chartDataByDate = productionData.reduce((acc, item) => {
    const dateKey = format(new Date(item.date), "dd/MM", { locale: ptBR });
    const existing = acc.find((d) => d.date === dateKey);
    if (existing) {
      existing.production += item.production_value;
    } else {
      acc.push({ date: dateKey, production: item.production_value });
    }
    return acc;
  }, [] as Array<{ date: string; production: number }>);

  // Prepare chart data - group by team
  const chartDataByTeam = productionData.reduce((acc, item) => {
    const teamName = item.teams?.name || "Desconhecido";
    const existing = acc.find((d) => d.team === teamName);
    if (existing) {
      existing.production += item.production_value;
    } else {
      acc.push({ team: teamName, production: item.production_value });
    }
    return acc;
  }, [] as Array<{ team: string; production: number }>).sort((a, b) => b.production - a.production);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produção</h1>
            <p className="text-muted-foreground">
              Acompanhamento de produção das equipes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="quarter">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select 
                value={selectedSupervisor} 
                onValueChange={(value) => {
                  setSelectedSupervisor(value);
                  setSelectedTeam("all"); // Reset team when supervisor changes
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <UserCheck className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Todos supervisores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos supervisores</SelectItem>
                  {supervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas as equipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as equipes</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Produção Total
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {totalProduction.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Média por Registro
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {avgProduction.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Equipes com Dados
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{uniqueTeams}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Último Dado
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{lastUpdate}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Line Chart - Production over time */}
          <Card>
            <CardHeader>
              <CardTitle>Produção por Data</CardTitle>
              <CardDescription>Evolução da produção ao longo do período</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartDataByDate.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDataByDate}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => value.toLocaleString('pt-BR')} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="production"
                        name="Produção"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-1))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart - Production by team */}
          <Card>
            <CardHeader>
              <CardTitle>Produção por Equipe</CardTitle>
              <CardDescription>Total de produção acumulado por equipe</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartDataByTeam.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataByTeam.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => value.toLocaleString('pt-BR')} />
                      <YAxis type="category" dataKey="team" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={80} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="production" name="Produção" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Detalhados</CardTitle>
            <CardDescription>
              Lista completa dos registros de produção
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : productionData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Produção</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {format(new Date(item.date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.teams?.name || "-"}
                        </TableCell>
                        <TableCell className="capitalize">
                          {item.teams?.type?.replace(/_/g, " ") || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.production_value.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                Nenhum dado de produção disponível para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
