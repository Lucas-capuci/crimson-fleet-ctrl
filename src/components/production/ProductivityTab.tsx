import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, getDaysInMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, BarChart3, Table as TableIcon, Users, UserCheck, Filter } from "lucide-react";
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
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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

const chartConfig = {
  programado: {
    label: "Programado",
    color: "hsl(var(--chart-1))",
  },
  executado: {
    label: "Executado",
    color: "hsl(var(--chart-2))",
  },
  validado_eqtl: {
    label: "Validado EQTL",
    color: "hsl(var(--chart-3))",
  },
};

export function ProductivityTab() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
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
    queryKey: ["productivity_entries", selectedMonth, selectedTeamFilter, selectedTeamTypeFilter, selectedSupervisorFilter],
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

        <div className="flex-1" />

        {/* Chart Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <BarChart3 className="mr-2 h-4 w-4" />
              Gráfico
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Comparativo de Produtividade</SheetTitle>
            </SheetHeader>
            <div className="mt-4 h-[calc(100vh-120px)]">
              {chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="programado" name="Programado" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="executado" name="Executado" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="validado_eqtl" name="Validado EQTL" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

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

      {/* Monthly Table */}
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
                            <TableCell className="sticky left-[120px] bg-background z-10 text-xs text-primary font-medium">
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
                            <TableCell className="sticky left-[120px] bg-background z-10 text-xs text-chart-2 font-medium">
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
                            <TableCell className="sticky left-[120px] bg-background z-10 text-xs text-chart-3 font-medium">
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
    </div>
  );
}
