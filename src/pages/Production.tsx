import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, TrendingUp, Calendar, RefreshCw, Users, UserCheck, CalendarDays } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductivityTab } from "@/components/production/ProductivityTab";

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

// Generate month options for the last 12 months
const getMonthOptions = () => {
  const options = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const date = subMonths(today, i);
    options.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return options;
};

export default function Production() {
  const { isAdmin } = useAuth();
  const [dateFilterType, setDateFilterType] = useState<string>("preset");
  const [dateRange, setDateRange] = useState<string>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all");

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Calculate date range based on filter type
  const getDateRange = () => {
    const today = new Date();
    
    if (dateFilterType === "month" && selectedMonth) {
      const [year, month] = selectedMonth.split("-").map(Number);
      const date = new Date(year, month - 1, 1);
      return { start: startOfMonth(date), end: endOfMonth(date) };
    }
    
    if (dateFilterType === "custom" && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    
    // Preset options
    switch (dateRange) {
      case "today":
        return { start: today, end: today };
      case "week":
        return { start: subDays(today, 7), end: today };
      case "month":
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case "last_month":
        const lastMonth = subMonths(today, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "quarter":
        return { start: subDays(today, 90), end: today };
      case "year":
        return { start: startOfYear(today), end: endOfYear(today) };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  };

  const { start, end } = getDateRange();

  // Fetch supervisor-team assignments with profiles
  const { data: supervisorTeams = [], isLoading: loadingSupervisors } = useQuery({
    queryKey: ["supervisor_teams_for_production"],
    queryFn: async () => {
      // First get supervisor_teams
      const { data: stData, error: stError } = await supabase
        .from("supervisor_teams")
        .select("supervisor_id, team_id");
      
      if (stError) throw stError;
      if (!stData || stData.length === 0) return [];

      // Get unique supervisor IDs
      const supervisorIds = [...new Set(stData.map(st => st.supervisor_id))];
      
      // Fetch profiles for these supervisors
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", supervisorIds);
      
      if (profilesError) throw profilesError;
      
      // Map profiles to supervisor_teams
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      return stData.map(st => ({
        supervisor_id: st.supervisor_id,
        team_id: st.team_id,
        profiles: profilesMap.get(st.supervisor_id) || null,
      })) as SupervisorTeam[];
    },
    enabled: isAdmin,
  });

  // Get unique supervisors for filter
  const supervisors = useMemo(() => {
    return Array.from(
      new Map(
        supervisorTeams.map((st) => [
          st.supervisor_id,
          { id: st.supervisor_id, name: st.profiles?.name || "Desconhecido" },
        ])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [supervisorTeams]);

  // Get team IDs for selected supervisor
  const supervisorTeamIds = useMemo(() => {
    return selectedSupervisor !== "all"
      ? supervisorTeams.filter((st) => st.supervisor_id === selectedSupervisor).map((st) => st.team_id)
      : [];
  }, [selectedSupervisor, supervisorTeams]);

  // Fetch production data
  const { data: productionData = [], isLoading, refetch } = useQuery({
    queryKey: ["production_data", dateFilterType, dateRange, selectedMonth, customStartDate?.toISOString(), customEndDate?.toISOString(), selectedTeam, selectedSupervisor, supervisorTeamIds],
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
    queryKey: ["teams_for_production", selectedSupervisor, supervisorTeamIds],
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

  // Format date range display
  const getDateRangeLabel = () => {
    if (dateFilterType === "month" && selectedMonth) {
      const [year, month] = selectedMonth.split("-").map(Number);
      return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: ptBR });
    }
    if (dateFilterType === "custom" && customStartDate && customEndDate) {
      return `${format(customStartDate, "dd/MM/yyyy")} - ${format(customEndDate, "dd/MM/yyyy")}`;
    }
    return format(start, "dd/MM/yyyy", { locale: ptBR }) + " - " + format(end, "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produção</h1>
            <p className="text-muted-foreground">
              Acompanhamento de produção das equipes
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="producao" className="w-full">
          <TabsList className="tabs-mobile">
            <TabsTrigger value="producao">Produção</TabsTrigger>
            <TabsTrigger value="produtividade">Produtividade</TabsTrigger>
          </TabsList>
          
          <TabsContent value="producao" className="space-y-6 mt-4">
            {/* Filters - Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2">
            {/* Date Filter Type */}
            <Select value={dateFilterType} onValueChange={(value) => {
              setDateFilterType(value);
              if (value === "preset") {
                setSelectedMonth("");
                setCustomStartDate(undefined);
                setCustomEndDate(undefined);
              }
            }}>
              <SelectTrigger className="w-full lg:w-[140px]">
                <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                <SelectValue placeholder="Tipo de data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">Período rápido</SelectItem>
                <SelectItem value="month">Mês específico</SelectItem>
                <SelectItem value="custom">Entre datas</SelectItem>
              </SelectContent>
            </Select>

            {/* Preset Date Range */}
            {dateFilterType === "preset" && (
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="last_month">Mês anterior</SelectItem>
                  <SelectItem value="quarter">Últimos 90 dias</SelectItem>
                  <SelectItem value="year">Este ano</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Month Selector */}
            {dateFilterType === "month" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Custom Date Range */}
            {dateFilterType === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full lg:w-[140px] justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "dd/MM/yyyy") : "Data início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full lg:w-[140px] justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "dd/MM/yyyy") : "Data fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => customStartDate ? date < customStartDate : false}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}

            {/* Supervisor Filter (Admin only) */}
            {isAdmin && (
              <Select 
                value={selectedSupervisor} 
                onValueChange={(value) => {
                  setSelectedSupervisor(value);
                  setSelectedTeam("all");
                }}
              >
                <SelectTrigger className="w-full lg:w-[180px]">
                  <UserCheck className="mr-2 h-4 w-4 shrink-0" />
                  <SelectValue placeholder="Supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos supervisores</SelectItem>
                  {loadingSupervisors ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : (
                    supervisors.map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Team Filter */}
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <Users className="mr-2 h-4 w-4 shrink-0" />
                <SelectValue placeholder="Equipe" />
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

            {/* Refresh Button */}
            <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

            {/* Date Range Display */}
            <div className="text-sm text-muted-foreground">
              Período: <span className="font-medium text-foreground">{getDateRangeLabel()}</span>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Produção Total
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {totalProduction.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Média por Registro
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {avgProduction.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Equipes com Dados
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-lg sm:text-2xl font-bold text-foreground">{uniqueTeams}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Último Dado
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-lg sm:text-2xl font-bold text-foreground">{lastUpdate}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts - Stack on mobile */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Line Chart - Production over time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Produção por Data</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Evolução da produção ao longo do período</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {isLoading ? (
                <Skeleton className="h-[200px] sm:h-[300px] w-full" />
              ) : chartDataByDate.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDataByDate} margin={{ left: -20, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                        tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()}
                        tickLine={false}
                        axisLine={false}
                        width={45}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="production"
                        name="Produção"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-1))', r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-[200px] sm:h-[300px] items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart - Production by team */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Produção por Equipe</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Total de produção acumulado por equipe</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {isLoading ? (
                <Skeleton className="h-[200px] sm:h-[300px] w-full" />
              ) : chartDataByTeam.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={chartDataByTeam.slice(0, 8)} 
                      layout="vertical" 
                      margin={{ left: 0, right: 10, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis 
                        type="number" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                        tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="team" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                        width={70}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="production" 
                        name="Produção" 
                        fill="hsl(var(--chart-1))" 
                        radius={[0, 4, 4, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-[200px] sm:h-[300px] items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Dados Detalhados</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
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
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Data</TableHead>
                      <TableHead className="text-xs sm:text-sm">Equipe</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Tipo</TableHead>
                      <TableHead className="text-xs sm:text-sm text-right">Produção</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs sm:text-sm">
                          {format(new Date(item.date), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm font-medium">
                          {item.teams?.name || "-"}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm capitalize hidden sm:table-cell">
                          {item.teams?.type?.replace(/_/g, " ") || "-"}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-right font-mono">
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
              <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                Nenhum dado de produção disponível para o período selecionado
              </div>
            )}
          </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="produtividade" className="mt-4">
            <ProductivityTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
