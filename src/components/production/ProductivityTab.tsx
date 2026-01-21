import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, getDaysInMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, BarChart3, Table as TableIcon, Users, UserCheck, Filter, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid, Cell, LabelList, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ProductivityEntry {
  id: string;
  team_id: string;
  date: string;
  entry_type: string;
  value: number;
  created_by: string;
  teams: {
    name: string;
    type: string;
  };
}

interface Team {
  id: string;
  name: string;
  type: string;
}

const TEAM_TYPE_LABELS: Record<string, string> = {
  linha_viva: "Linha Viva",
  linha_morta: "Linha Morta",
  poda: "Poda",
  linha_morta_obras: "Linha Morta Obras",
  recolha: "Recolha",
  linha_viva_obras: "Linha Viva Obras",
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  programado: "Programado",
  executado: "Executado",
  validado_eqtl: "Validado EQTL",
};

// Custom colors for productivity chart
const PRODUCTIVITY_COLORS = {
  programado: "#1e3a5f",    // Dark blue
  executado: "#4ade80",     // Light green
  validado_eqtl: "#c55a11", // Dark orange
};

const chartConfig = {
  programado: {
    label: "Programado",
    color: PRODUCTIVITY_COLORS.programado,
  },
  executado: {
    label: "Executado",
    color: PRODUCTIVITY_COLORS.executado,
  },
  validado_eqtl: {
    label: "Validado EQTL",
    color: PRODUCTIVITY_COLORS.validado_eqtl,
  },
};

export function ProductivityTab() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedDayFilter, setSelectedDayFilter] = useState("all");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState("all");
  const [selectedTeamTypeFilter, setSelectedTeamTypeFilter] = useState("all");
  const [selectedSupervisorFilter, setSelectedSupervisorFilter] = useState("all");
  
  // Entry form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formTeamId, setFormTeamId] = useState("");
  const [formDate, setFormDate] = useState<Date | undefined>(new Date());
  const [formEntryTypes, setFormEntryTypes] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({
    programado: "",
    executado: "",
    validado_eqtl: "",
  });

  // Parse selected month
  const [year, month] = selectedMonth.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = getDaysInMonth(monthStart);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return options;
  }, []);

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ["teams_for_productivity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, type")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch supervisor-team assignments (admin only)
  const { data: supervisorTeams = [] } = useQuery({
    queryKey: ["supervisor_teams_productivity"],
    queryFn: async () => {
      const { data: stData, error: stError } = await supabase
        .from("supervisor_teams")
        .select("supervisor_id, team_id");
      if (stError) throw stError;
      if (!stData || stData.length === 0) return [];

      const supervisorIds = [...new Set(stData.map(st => st.supervisor_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", supervisorIds);
      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      return stData.map(st => ({
        supervisor_id: st.supervisor_id,
        team_id: st.team_id,
        profile: profilesMap.get(st.supervisor_id),
      }));
    },
    enabled: isAdmin,
  });

  // Get unique supervisors
  const supervisors = useMemo(() => {
    return Array.from(
      new Map(
        supervisorTeams.map((st) => [
          st.supervisor_id,
          { id: st.supervisor_id, name: st.profile?.name || "Desconhecido" },
        ])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [supervisorTeams]);

  // Filter team IDs based on supervisor
  const supervisorTeamIds = useMemo(() => {
    if (selectedSupervisorFilter === "all") return [];
    return supervisorTeams
      .filter(st => st.supervisor_id === selectedSupervisorFilter)
      .map(st => st.team_id);
  }, [selectedSupervisorFilter, supervisorTeams]);

  // Fetch productivity entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["productivity_entries", selectedMonth, selectedTeamFilter, selectedTeamTypeFilter, selectedSupervisorFilter, selectedDayFilter],
    queryFn: async () => {
      let query = supabase
        .from("productivity_entries")
        .select(`
          id,
          team_id,
          date,
          entry_type,
          value,
          created_by,
          teams (name, type)
        `)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));

      if (selectedTeamFilter !== "all") {
        query = query.eq("team_id", selectedTeamFilter);
      } else if (selectedSupervisorFilter !== "all" && supervisorTeamIds.length > 0) {
        query = query.in("team_id", supervisorTeamIds);
      }

      if (selectedDayFilter !== "all") {
        query = query.eq("date", selectedDayFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ProductivityEntry[];
    },
  });

  // Filter entries by team type
  const filteredEntries = useMemo(() => {
    if (selectedTeamTypeFilter === "all") return entries;
    return entries.filter(e => e.teams?.type === selectedTeamTypeFilter);
  }, [entries, selectedTeamTypeFilter]);

  // Filter teams for display (also filtered by type and supervisor)
  const filteredTeams = useMemo(() => {
    let result = teams;
    if (selectedTeamTypeFilter !== "all") {
      result = result.filter(t => t.type === selectedTeamTypeFilter);
    }
    if (selectedSupervisorFilter !== "all" && supervisorTeamIds.length > 0) {
      result = result.filter(t => supervisorTeamIds.includes(t.id));
    }
    if (selectedTeamFilter !== "all") {
      result = result.filter(t => t.id === selectedTeamFilter);
    }
    return result;
  }, [teams, selectedTeamTypeFilter, selectedSupervisorFilter, supervisorTeamIds, selectedTeamFilter]);

  // Group entries by team for table display
  const entriesByTeam = useMemo(() => {
    const map = new Map<string, Map<string, Record<string, number>>>();
    
    filteredEntries.forEach(entry => {
      if (!map.has(entry.team_id)) {
        map.set(entry.team_id, new Map());
      }
      const teamMap = map.get(entry.team_id)!;
      const dateKey = entry.date;
      if (!teamMap.has(dateKey)) {
        teamMap.set(dateKey, { programado: 0, executado: 0, validado_eqtl: 0 });
      }
      teamMap.get(dateKey)![entry.entry_type] = entry.value;
    });
    
    return map;
  }, [filteredEntries]);

  // Prepare chart data - totals by team
  const chartData = useMemo(() => {
    const teamTotals = new Map<string, { programado: number; executado: number; validado_eqtl: number; name: string }>();
    
    filteredTeams.forEach(team => {
      teamTotals.set(team.id, { programado: 0, executado: 0, validado_eqtl: 0, name: team.name });
    });

    filteredEntries.forEach(entry => {
      const teamData = teamTotals.get(entry.team_id);
      if (teamData && (entry.entry_type === 'programado' || entry.entry_type === 'executado' || entry.entry_type === 'validado_eqtl')) {
        (teamData as Record<string, number | string>)[entry.entry_type] = 
          ((teamData as Record<string, number | string>)[entry.entry_type] as number || 0) + entry.value;
      }
    });

    return Array.from(teamTotals.values())
      .filter(t => t.programado > 0 || t.executado > 0 || t.validado_eqtl > 0)
      .sort((a, b) => b.executado - a.executado);
  }, [filteredTeams, filteredEntries]);

  // Create/Update mutation
  const createMutation = useMutation({
    mutationFn: async (entries: { team_id: string; date: string; entry_type: string; value: number }[]) => {
      for (const entry of entries) {
        const { error } = await supabase
          .from("productivity_entries")
          .upsert(
            {
              team_id: entry.team_id,
              date: entry.date,
              entry_type: entry.entry_type,
              value: entry.value,
              created_by: user?.id || "",
            },
            { onConflict: "team_id,date,entry_type" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productivity_entries"] });
      toast.success("Produtividade lançada com sucesso!");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao lançar produtividade: " + error.message);
    },
  });

  const resetForm = () => {
    setFormTeamId("");
    setFormDate(new Date());
    setFormEntryTypes([]);
    setFormValues({ programado: "", executado: "", validado_eqtl: "" });
  };

  const handleSubmit = () => {
    if (!formTeamId || !formDate || formEntryTypes.length === 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const entriesToCreate = formEntryTypes
      .filter(type => formValues[type] && parseFloat(formValues[type]) > 0)
      .map(type => ({
        team_id: formTeamId,
        date: format(formDate, "yyyy-MM-dd"),
        entry_type: type,
        value: parseFloat(formValues[type]),
      }));

    if (entriesToCreate.length === 0) {
      toast.error("Informe pelo menos um valor");
      return;
    }

    createMutation.mutate(entriesToCreate);
  };

  const toggleEntryType = (type: string) => {
    setFormEntryTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // State for view mode
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [chartType, setChartType] = useState<"bars" | "lines">("bars");

  // Prepare line chart data - daily totals across all teams
  const lineChartData = useMemo(() => {
    const dailyTotals = new Map<string, { date: string; programado: number; executado: number; validado_eqtl: number }>();
    
    // Initialize all days
    allDays.forEach(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      dailyTotals.set(dateKey, {
        date: format(day, "dd/MM"),
        programado: 0,
        executado: 0,
        validado_eqtl: 0,
      });
    });

    // Sum values for each day
    filteredEntries.forEach(entry => {
      const dayData = dailyTotals.get(entry.date);
      if (dayData && (entry.entry_type === 'programado' || entry.entry_type === 'executado' || entry.entry_type === 'validado_eqtl')) {
        (dayData as Record<string, number | string>)[entry.entry_type] = 
          ((dayData as Record<string, number | string>)[entry.entry_type] as number || 0) + entry.value;
      }
    });

    return Array.from(dailyTotals.values());
  }, [allDays, filteredEntries]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select value={selectedSupervisorFilter} onValueChange={setSelectedSupervisorFilter}>
            <SelectTrigger className="w-[160px]">
              <UserCheck className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Supervisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Supervisores</SelectItem>
              {supervisors.map(sup => (
                <SelectItem key={sup.id} value={sup.id}>
                  {sup.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedTeamTypeFilter} onValueChange={setSelectedTeamTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tipos</SelectItem>
            {Object.entries(TEAM_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
          <SelectTrigger className="w-[160px]">
            <Users className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Equipes</SelectItem>
            {teams.map(team => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedDayFilter} onValueChange={setSelectedDayFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Dias</SelectItem>
            {allDays.map(day => (
              <SelectItem key={day.toISOString()} value={format(day, "yyyy-MM-dd")}>
                {format(day, "dd/MM")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "chart")} className="hidden sm:block">
          <TabsList className="h-9">
            <TabsTrigger value="table" className="px-3">
              <TableIcon className="h-4 w-4 mr-1" />
              Tabela
            </TabsTrigger>
            <TabsTrigger value="chart" className="px-3">
              <BarChart3 className="h-4 w-4 mr-1" />
              Gráfico
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Chart Type Toggle - Only visible when chart view is active */}
        {viewMode === "chart" && (
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as "bars" | "lines")} className="hidden sm:block">
            <TabsList className="h-9">
              <TabsTrigger value="bars" className="px-3">
                <BarChart3 className="h-4 w-4 mr-1" />
                Barras
              </TabsTrigger>
              <TabsTrigger value="lines" className="px-3">
                <TrendingUp className="h-4 w-4 mr-1" />
                Linhas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Add Entry Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Lançar Produtividade
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Lançar Produtividade</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Equipe *</Label>
                <Select value={formTeamId} onValueChange={setFormTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !formDate && "text-muted-foreground")}
                    >
                      {formDate ? format(formDate, "dd/MM/yyyy") : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formDate}
                      onSelect={setFormDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Lançamento *</Label>
                <div className="space-y-2">
                  {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                    <div key={value} className="flex items-center space-x-2">
                      <Checkbox
                        id={value}
                        checked={formEntryTypes.includes(value)}
                        onCheckedChange={() => toggleEntryType(value)}
                      />
                      <label htmlFor={value} className="text-sm font-medium cursor-pointer">
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {formEntryTypes.map(type => (
                <div key={type} className="space-y-2">
                  <Label>{ENTRY_TYPE_LABELS[type]} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formValues[type]}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [type]: e.target.value }))}
                  />
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile view toggle */}
      <div className="flex sm:hidden gap-2 mb-4 flex-wrap">
        <Button
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setViewMode("table")}
        >
          <TableIcon className="h-4 w-4 mr-1" />
          Tabela
        </Button>
        <Button
          variant={viewMode === "chart" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setViewMode("chart")}
        >
          <BarChart3 className="h-4 w-4 mr-1" />
          Gráfico
        </Button>
        {viewMode === "chart" && (
          <>
            <Button
              variant={chartType === "bars" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setChartType("bars")}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Barras
            </Button>
            <Button
              variant={chartType === "lines" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setChartType("lines")}
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Linhas
            </Button>
          </>
        )}
      </div>

      {/* Chart View */}
      {viewMode === "chart" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              {chartType === "bars" ? <BarChart3 className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
              {chartType === "bars" 
                ? `Comparativo de Produtividade - ${format(monthStart, "MMMM yyyy", { locale: ptBR })}`
                : `Evolução Diária de Produtividade - ${format(monthStart, "MMMM yyyy", { locale: ptBR })}`
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartType === "bars" ? (
              // Bar Chart - By Team
              chartData.length > 0 ? (
                <div style={{ height: Math.max(300, chartData.length * 80) }}>
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={chartData} 
                        layout="vertical" 
                        margin={{ left: 0, right: 20, top: 20, bottom: 20 }}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                        <XAxis 
                          type="number" 
                          hide={true}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={100}
                          tick={{ fontSize: 11, fontWeight: 500 }}
                          tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 10)}...` : value}
                        />
                        <ChartTooltip 
                          content={<ChartTooltipContent />} 
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: 20 }}
                          iconType="square"
                          iconSize={12}
                        />
                        <Bar 
                          dataKey="programado" 
                          name="Programado" 
                          fill={PRODUCTIVITY_COLORS.programado}
                          radius={[0, 4, 4, 0]} 
                          barSize={18}
                        >
                          <LabelList 
                            dataKey="programado" 
                            position="right" 
                            formatter={(value: number) => value > 0 ? value.toLocaleString("pt-BR") : ""}
                            style={{ fontSize: 10, fontWeight: 500, fill: PRODUCTIVITY_COLORS.programado }}
                          />
                        </Bar>
                        <Bar 
                          dataKey="executado" 
                          name="Executado" 
                          fill={PRODUCTIVITY_COLORS.executado}
                          radius={[0, 4, 4, 0]} 
                          barSize={18}
                        >
                          <LabelList 
                            dataKey="executado" 
                            position="right" 
                            formatter={(value: number) => value > 0 ? value.toLocaleString("pt-BR") : ""}
                            style={{ fontSize: 10, fontWeight: 500, fill: PRODUCTIVITY_COLORS.executado }}
                          />
                        </Bar>
                        <Bar 
                          dataKey="validado_eqtl" 
                          name="Validado EQTL" 
                          fill={PRODUCTIVITY_COLORS.validado_eqtl}
                          radius={[0, 4, 4, 0]} 
                          barSize={18}
                        >
                          <LabelList 
                            dataKey="validado_eqtl" 
                            position="right" 
                            formatter={(value: number) => value > 0 ? value.toLocaleString("pt-BR") : ""}
                            style={{ fontSize: 10, fontWeight: 500, fill: PRODUCTIVITY_COLORS.validado_eqtl }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              )
            ) : (
              // Line Chart - Daily Evolution
              lineChartData.some(d => d.programado > 0 || d.executado > 0 || d.validado_eqtl > 0) ? (
                <div style={{ height: 400 }}>
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={lineChartData} 
                        margin={{ left: 10, right: 30, top: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          tickMargin={8}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value) => value.toLocaleString("pt-BR")}
                        />
                        <ChartTooltip 
                          content={<ChartTooltipContent />} 
                          cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: 20 }}
                          iconType="line"
                          iconSize={16}
                        />
                        <Line 
                          type="monotone"
                          dataKey="programado" 
                          name="Programado" 
                          stroke={PRODUCTIVITY_COLORS.programado}
                          strokeWidth={2}
                          dot={{ r: 3, fill: PRODUCTIVITY_COLORS.programado }}
                          activeDot={{ r: 5 }}
                        >
                          <LabelList 
                            dataKey="programado" 
                            position="top"
                            offset={8}
                            formatter={(value: number) => value > 0 ? value.toLocaleString("pt-BR") : ""}
                            style={{ fontSize: 9, fontWeight: 500, fill: PRODUCTIVITY_COLORS.programado }}
                          />
                        </Line>
                        <Line 
                          type="monotone"
                          dataKey="executado" 
                          name="Executado" 
                          stroke={PRODUCTIVITY_COLORS.executado}
                          strokeWidth={2}
                          dot={{ r: 3, fill: PRODUCTIVITY_COLORS.executado }}
                          activeDot={{ r: 5 }}
                        >
                          <LabelList 
                            dataKey="executado" 
                            position="top"
                            offset={8}
                            formatter={(value: number) => value > 0 ? value.toLocaleString("pt-BR") : ""}
                            style={{ fontSize: 9, fontWeight: 500, fill: PRODUCTIVITY_COLORS.executado }}
                          />
                        </Line>
                        <Line 
                          type="monotone"
                          dataKey="validado_eqtl" 
                          name="Validado EQTL" 
                          stroke={PRODUCTIVITY_COLORS.validado_eqtl}
                          strokeWidth={2}
                          dot={{ r: 3, fill: PRODUCTIVITY_COLORS.validado_eqtl }}
                          activeDot={{ r: 5 }}
                        >
                          <LabelList 
                            dataKey="validado_eqtl" 
                            position="top"
                            offset={8}
                            formatter={(value: number) => value > 0 ? value.toLocaleString("pt-BR") : ""}
                            style={{ fontSize: 9, fontWeight: 500, fill: PRODUCTIVITY_COLORS.validado_eqtl }}
                          />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly Table View */}
      {viewMode === "table" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TableIcon className="h-5 w-5" />
              Acompanhamento Mensal - {format(monthStart, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredTeams.length > 0 ? (
              <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">Equipe</TableHead>
                        <TableHead className="sticky left-[120px] bg-background z-10 min-w-[100px]">Tipo</TableHead>
                        {allDays.map(day => (
                          <TableHead key={day.toISOString()} className="text-center min-w-[60px] text-xs">
                            {format(day, "dd/MM")}
                          </TableHead>
                        ))}
                        <TableHead className="text-center min-w-[80px] bg-muted font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeams.map(team => {
                        const teamData = entriesByTeam.get(team.id) || new Map();
                        
                        return (
                          <>
                            {/* Programado row */}
                            <TableRow key={`${team.id}-programado`}>
                              <TableCell rowSpan={3} className="sticky left-0 bg-background z-10 font-medium border-b">
                                {team.name}
                              </TableCell>
                              <TableCell className="sticky left-[120px] bg-background z-10 text-xs font-medium" style={{ color: PRODUCTIVITY_COLORS.programado }}>
                                Programado
                              </TableCell>
                              {allDays.map(day => {
                                const dateKey = format(day, "yyyy-MM-dd");
                                const value = teamData.get(dateKey)?.programado || 0;
                                return (
                                  <TableCell key={day.toISOString()} className="text-center text-xs">
                                    {value > 0 ? value.toLocaleString("pt-BR") : "-"}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold bg-muted text-xs">
                                {Array.from(teamData.values()).reduce((sum, d) => sum + (d.programado || 0), 0).toLocaleString("pt-BR")}
                              </TableCell>
                            </TableRow>
                            {/* Executado row */}
                            <TableRow key={`${team.id}-executado`}>
                              <TableCell className="sticky left-[120px] bg-background z-10 text-xs font-medium" style={{ color: PRODUCTIVITY_COLORS.executado }}>
                                Executado
                              </TableCell>
                              {allDays.map(day => {
                                const dateKey = format(day, "yyyy-MM-dd");
                                const value = teamData.get(dateKey)?.executado || 0;
                                return (
                                  <TableCell key={day.toISOString()} className="text-center text-xs">
                                    {value > 0 ? value.toLocaleString("pt-BR") : "-"}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold bg-muted text-xs">
                                {Array.from(teamData.values()).reduce((sum, d) => sum + (d.executado || 0), 0).toLocaleString("pt-BR")}
                              </TableCell>
                            </TableRow>
                            {/* Validado EQTL row */}
                            <TableRow key={`${team.id}-validado`} className="border-b-2">
                              <TableCell className="sticky left-[120px] bg-background z-10 text-xs font-medium" style={{ color: PRODUCTIVITY_COLORS.validado_eqtl }}>
                                Validado EQTL
                              </TableCell>
                              {allDays.map(day => {
                                const dateKey = format(day, "yyyy-MM-dd");
                                const value = teamData.get(dateKey)?.validado_eqtl || 0;
                                return (
                                  <TableCell key={day.toISOString()} className="text-center text-xs">
                                    {value > 0 ? value.toLocaleString("pt-BR") : "-"}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold bg-muted text-xs">
                                {Array.from(teamData.values()).reduce((sum, d) => sum + (d.validado_eqtl || 0), 0).toLocaleString("pt-BR")}
                              </TableCell>
                            </TableRow>
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                Nenhuma equipe encontrada com os filtros selecionados
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
