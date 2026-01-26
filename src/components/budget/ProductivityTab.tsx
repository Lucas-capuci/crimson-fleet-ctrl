import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, TrendingUp, Target, CheckCircle2, ListChecks, Download, Plus, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  ResponsiveContainer, Legend, Tooltip as ChartTooltip,
  LineChart, Line, ReferenceLine
} from "recharts";
import { ExportButton } from "@/components/ExportButton";

// Colors for the chart
const COLORS = {
  programado: "#1e3a5f",
  executado: "#4ade80",
  validado: "#c55a11"
};

// Goal: 15 anomalies per pruning team
const GOAL_PER_TEAM = 15;

interface Team {
  id: string;
  name: string;
  type: string;
}

interface ProductivityEntry {
  id: string;
  team_id: string;
  date: string;
  entry_type: string;
  value: number;
  created_by: string;
  team?: Team;
}

export function ProductivityTab() {
  const { user, isAdmin, userRole } = useAuth();
  const queryClient = useQueryClient();
  
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(() => endOfMonth(new Date()));
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  
  // For adding new entries
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [entryType, setEntryType] = useState<string>("programado");
  const [entryValue, setEntryValue] = useState<string>("");
  const [addDateOpen, setAddDateOpen] = useState(false);

  const canManage = userRole === "admin" || userRole === "gestor";

  // Fetch poda teams
  const { data: podaTeams = [] } = useQuery({
    queryKey: ["poda-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, type")
        .eq("type", "poda")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch productivity entries
  const { data: entries = [] } = useQuery({
    queryKey: ["productivity-entries", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productivity_entries")
        .select("*, teams:team_id(id, name, type)")
        .gte("date", format(dateFrom, "yyyy-MM-dd"))
        .lte("date", format(dateTo, "yyyy-MM-dd"))
        .order("date");
      if (error) throw error;
      return (data || []).map((e: any) => ({
        ...e,
        team: e.teams,
      })) as ProductivityEntry[];
    },
    enabled: isValid(dateFrom) && isValid(dateTo),
  });

  // Filter only poda teams entries
  const podaEntries = useMemo(() => {
    const podaTeamIds = podaTeams.map(t => t.id);
    return entries.filter(e => podaTeamIds.includes(e.team_id));
  }, [entries, podaTeams]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const programadoTotal = podaEntries
      .filter(e => e.entry_type === "programado")
      .reduce((sum, e) => sum + e.value, 0);
    
    const executadoTotal = podaEntries
      .filter(e => e.entry_type === "executado")
      .reduce((sum, e) => sum + e.value, 0);
    
    const validadoTotal = podaEntries
      .filter(e => e.entry_type === "validado_eqtl")
      .reduce((sum, e) => sum + e.value, 0);

    // Calculate average per day
    // Count distinct dates with "executado" entries
    const datesWithExecutado = new Set(
      podaEntries.filter(e => e.entry_type === "executado").map(e => e.date)
    );
    const daysWithData = datesWithExecutado.size || 1;

    // Count teams with any executado entry
    const teamsWithExecutado = new Set(
      podaEntries.filter(e => e.entry_type === "executado").map(e => e.team_id)
    );
    const numTeamsWithData = teamsWithExecutado.size || 1;

    // Média = (total executado / nº equipes) / dias lançados
    const avgPerDay = (executadoTotal / numTeamsWithData) / daysWithData;

    // Percentual Prog/Exec
    const percentual = programadoTotal > 0 ? (executadoTotal / programadoTotal) * 100 : 0;

    return {
      programadoTotal,
      executadoTotal,
      validadoTotal,
      avgPerDay,
      percentual,
      daysWithData,
      numTeamsWithData,
    };
  }, [podaEntries]);

  // Prepare monthly table data
  const tableData = useMemo(() => {
    const daysInRange = eachDayOfInterval({ start: dateFrom, end: dateTo });
    
    return podaTeams.map(team => {
      const teamEntries = podaEntries.filter(e => e.team_id === team.id);
      const dailyData: Record<string, { programado: number; executado: number; validado: number }> = {};
      
      daysInRange.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        dailyData[dateStr] = { programado: 0, executado: 0, validado: 0 };
      });
      
      teamEntries.forEach(entry => {
        if (dailyData[entry.date]) {
          if (entry.entry_type === "programado") dailyData[entry.date].programado = entry.value;
          if (entry.entry_type === "executado") dailyData[entry.date].executado = entry.value;
          if (entry.entry_type === "validado_eqtl") dailyData[entry.date].validado = entry.value;
        }
      });

      const totalProgramado = Object.values(dailyData).reduce((s, d) => s + d.programado, 0);
      const totalExecutado = Object.values(dailyData).reduce((s, d) => s + d.executado, 0);
      const totalValidado = Object.values(dailyData).reduce((s, d) => s + d.validado, 0);

      return {
        team,
        dailyData,
        totalProgramado,
        totalExecutado,
        totalValidado,
      };
    });
  }, [podaTeams, podaEntries, dateFrom, dateTo]);

  // Chart data - daily evolution
  const chartData = useMemo(() => {
    const daysInRange = eachDayOfInterval({ start: dateFrom, end: dateTo });
    
    return daysInRange.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayEntries = podaEntries.filter(e => e.date === dateStr);
      
      return {
        date: format(day, "dd/MM"),
        fullDate: dateStr,
        programado: dayEntries.filter(e => e.entry_type === "programado").reduce((s, e) => s + e.value, 0),
        executado: dayEntries.filter(e => e.entry_type === "executado").reduce((s, e) => s + e.value, 0),
        validado: dayEntries.filter(e => e.entry_type === "validado_eqtl").reduce((s, e) => s + e.value, 0),
      };
    }).filter(d => d.programado > 0 || d.executado > 0 || d.validado > 0);
  }, [podaEntries, dateFrom, dateTo]);

  // Goal line for chart (15 per team visible)
  const goalValue = podaTeams.length * GOAL_PER_TEAM;

  // Add entry mutation
  const addEntry = useMutation({
    mutationFn: async () => {
      if (!user || !selectedTeam || !selectedDate || !entryValue) {
        throw new Error("Preencha todos os campos");
      }

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      const { error } = await supabase
        .from("productivity_entries")
        .upsert({
          team_id: selectedTeam,
          date: dateStr,
          entry_type: entryType,
          value: parseFloat(entryValue),
          created_by: user.id,
        }, {
          onConflict: "team_id,date,entry_type"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productivity-entries"] });
      setSelectedTeam("");
      setSelectedDate(undefined);
      setEntryValue("");
      toast({ title: "Registro salvo com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  // Delete entry mutation
  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("productivity_entries")
        .delete()
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productivity-entries"] });
      toast({ title: "Registro removido!" });
    },
  });

  // Export data
  const exportData = useMemo(() => {
    return tableData.flatMap(row => [
      {
        Equipe: row.team.name,
        "Total Programado": row.totalProgramado,
        "Total Executado": row.totalExecutado,
        "Total Validado": row.totalValidado,
      }
    ]);
  }, [tableData]);

  const daysInRange = eachDayOfInterval({ start: dateFrom, end: dateTo });

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[160px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => { if (date) { setDateFrom(date); setDateFromOpen(false); }}}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[160px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => { if (date) { setDateTo(date); setDateToOpen(false); }}}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1" />
            <ExportButton
              data={exportData}
              filename={`produtividade_poda_${format(dateFrom, "yyyy-MM-dd")}_${format(dateTo, "yyyy-MM-dd")}`}
              columns={[
                { key: "Equipe", header: "Equipe" },
                { key: "Total Programado", header: "Total Programado" },
                { key: "Total Executado", header: "Total Executado" },
                { key: "Total Validado", header: "Total Validado" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Média Exec. / Dia
            </CardDescription>
            <CardTitle className="text-2xl">{kpis.avgPerDay.toFixed(1)}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {kpis.numTeamsWithData} equipes em {kpis.daysWithData} dias
            </p>
          </CardHeader>
        </Card>

        <Card className={cn(
          kpis.percentual >= 100 ? "bg-green-500/10 border-green-500/30" :
          kpis.percentual >= 80 ? "bg-yellow-500/10 border-yellow-500/30" :
          "bg-red-500/10 border-red-500/30"
        )}>
          <CardHeader className="pb-2">
            <CardDescription className={cn(
              "flex items-center gap-1",
              kpis.percentual >= 100 ? "text-green-600" :
              kpis.percentual >= 80 ? "text-yellow-600" :
              "text-red-600"
            )}>
              <Target className="h-3 w-3" />
              Prog. / Exec. (%)
            </CardDescription>
            <CardTitle className="text-2xl">{kpis.percentual.toFixed(1)}%</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              Total Programado
            </CardDescription>
            <CardTitle className="text-2xl">{kpis.programadoTotal.toLocaleString("pt-BR")}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Total Executado
            </CardDescription>
            <CardTitle className="text-2xl">{kpis.executadoTotal.toLocaleString("pt-BR")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Add Entry Form - Only for admins/gestors */}
      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar Registro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Equipe</Label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {podaTeams.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover open={addDateOpen} onOpenChange={setAddDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => { setSelectedDate(date); setAddDateOpen(false); }}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="programado">Programado</SelectItem>
                    <SelectItem value="executado">Executado</SelectItem>
                    <SelectItem value="validado_eqtl">Validado EQTL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  value={entryValue}
                  onChange={(e) => setEntryValue(e.target.value)}
                  placeholder="0"
                  className="w-[100px]"
                />
              </div>
              <Button
                onClick={() => addEntry.mutate()}
                disabled={addEntry.isPending || !selectedTeam || !selectedDate || !entryValue}
              >
                {addEntry.isPending ? "Salvando..." : "Adicionar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar Chart - Per Team */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Produção por Equipe</CardTitle>
            <CardDescription>Comparação Programado x Executado x Validado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tableData.map(row => ({
                    name: row.team.name,
                    programado: row.totalProgramado,
                    executado: row.totalExecutado,
                    validado: row.totalValidado,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip />
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  <Bar dataKey="programado" name="Programado" fill={COLORS.programado} />
                  <Bar dataKey="executado" name="Executado" fill={COLORS.executado} />
                  <Bar dataKey="validado" name="Validado EQTL" fill={COLORS.validado} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Line Chart - Daily Evolution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Evolução Diária</CardTitle>
            <CardDescription>Meta: {goalValue} anomalias ({podaTeams.length} equipes x {GOAL_PER_TEAM})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip />
                  <Legend />
                  <ReferenceLine 
                    y={goalValue} 
                    stroke="#ef4444" 
                    strokeDasharray="5 5" 
                    label={{ value: "Meta", position: "right", fontSize: 11, fill: "#ef4444" }} 
                  />
                  <Line type="monotone" dataKey="programado" name="Programado" stroke={COLORS.programado} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="executado" name="Executado" stroke={COLORS.executado} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="validado" name="Validado EQTL" stroke={COLORS.validado} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Dados Detalhados</CardTitle>
          <CardDescription>Evolução mensal por equipe de poda</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">Equipe</TableHead>
                <TableHead className="text-right font-semibold">Prog.</TableHead>
                <TableHead className="text-right font-semibold">Exec.</TableHead>
                <TableHead className="text-right font-semibold">Valid.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map(row => (
                <TableRow key={row.team.id}>
                  <TableCell className="sticky left-0 bg-background font-medium">{row.team.name}</TableCell>
                  <TableCell className="text-right" style={{ color: COLORS.programado }}>{row.totalProgramado}</TableCell>
                  <TableCell className="text-right" style={{ color: COLORS.executado }}>{row.totalExecutado}</TableCell>
                  <TableCell className="text-right" style={{ color: COLORS.validado }}>{row.totalValidado}</TableCell>
                </TableRow>
              ))}
              {tableData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma equipe de poda cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Entries List - for deletion */}
      {canManage && podaEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Registros Recentes</CardTitle>
            <CardDescription>Últimos lançamentos de produtividade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {podaEntries.slice(0, 20).map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{entry.team?.name}</span>
                    <span className="text-sm text-muted-foreground">{format(parseISO(entry.date), "dd/MM/yyyy")}</span>
                    <Badge variant="outline" className="text-xs">
                      {entry.entry_type === "programado" ? "Programado" : 
                       entry.entry_type === "executado" ? "Executado" : "Validado"}
                    </Badge>
                    <span className="font-semibold">{entry.value}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteEntry.mutate(entry.id)}
                    disabled={deleteEntry.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
