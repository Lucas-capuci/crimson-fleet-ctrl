import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Check, X, MessageSquare, Calendar, Users, LayoutGrid, Filter, Clock } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { CsvColumn, formatDate, formatBoolean } from "@/lib/exportCsv";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay, parseISO } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ScheduleRecord = {
  id: string;
  team_id: string;
  date: string;
  is_working: boolean;
  observation: string | null;
  scheduled_entry_time: string;
  scheduled_exit_time: string;
};

type Team = {
  id: string;
  name: string;
  type: string;
};

type SupervisorTeam = {
  supervisor_id: string;
  team_id: string;
};

type Profile = {
  id: string;
  name: string;
};

const TEAM_TYPES = [
  { value: "all", label: "Todos os tipos" },
  { value: "linha_viva", label: "Linha Viva" },
  { value: "linha_morta", label: "Linha Morta" },
  { value: "poda", label: "Poda" },
  { value: "linha_morta_obras", label: "Linha Morta Obras" },
  { value: "recolha", label: "Recolha" },
];

export default function Schedule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all");
  const [selectedTeamType, setSelectedTeamType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedReportDate, setSelectedReportDate] = useState<Date>(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ["teams-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, type")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch supervisor-team relationships
  const { data: supervisorTeams = [] } = useQuery({
    queryKey: ["supervisor-teams-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisor_teams")
        .select("supervisor_id, team_id");
      if (error) throw error;
      return data as SupervisorTeam[];
    },
  });

  // Fetch profiles for supervisors
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Get unique supervisors from supervisor_teams
  const supervisors = useMemo(() => {
    const profileMap = new Map(profiles.map(p => [p.id, p.name]));
    const uniqueSupervisors = new Map<string, string>();
    supervisorTeams.forEach(st => {
      const name = profileMap.get(st.supervisor_id);
      if (name && !uniqueSupervisors.has(st.supervisor_id)) {
        uniqueSupervisors.set(st.supervisor_id, name);
      }
    });
    return Array.from(uniqueSupervisors, ([id, name]) => ({ id, name })).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }, [supervisorTeams, profiles]);

  // Generate CSV data for schedule export
  const getScheduleCsvData = () => {
    const data: any[] = [];
    filteredTeams.forEach(team => {
      daysInMonth.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const schedule = schedules.find(s => s.team_id === team.id && s.date === dateStr);
        data.push({
          team: team.name,
          type: team.type,
          date: dateStr,
          is_working: schedule?.is_working ?? true,
          observation: schedule?.observation || "",
        });
      });
    });
    return data;
  };

  // CSV columns for schedule
  const scheduleCsvColumns: CsvColumn[] = [
    { key: "team", header: "Equipe" },
    { key: "type", header: "Tipo" },
    { key: "date", header: "Data", format: (v) => formatDate(v) },
    { key: "is_working", header: "Status", format: (v) => formatBoolean(v, "Trabalho", "Folga") },
    { key: "observation", header: "Observação" },
  ];

  // Fetch schedules for the month
  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules", format(currentDate, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_schedules")
        .select("*")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data as ScheduleRecord[];
    },
  });

  // Mutation for creating/updating schedule
  const scheduleMutation = useMutation({
    mutationFn: async ({ 
      teamId, 
      date, 
      isWorking, 
      obs,
      entryTime,
      exitTime 
    }: { 
      teamId: string; 
      date: string; 
      isWorking: boolean; 
      obs?: string;
      entryTime?: string;
      exitTime?: string;
    }) => {
      const existing = schedules.find(s => s.team_id === teamId && s.date === date);
      
      if (existing) {
        const updateData: any = { is_working: isWorking, observation: obs || null };
        if (entryTime !== undefined) updateData.scheduled_entry_time = entryTime;
        if (exitTime !== undefined) updateData.scheduled_exit_time = exitTime;
        
        const { error } = await supabase
          .from("team_schedules")
          .update(updateData)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("team_schedules")
          .insert({ 
            team_id: teamId, 
            date, 
            is_working: isWorking, 
            observation: obs || null,
            scheduled_entry_time: entryTime || '07:00:00',
            scheduled_exit_time: exitTime || '17:00:00'
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({ title: "Escala atualizada" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar escala", variant: "destructive" });
    },
  });

  // Filter teams based on all filters
  const filteredTeams = useMemo(() => {
    let result = teams;

    // Filter by team type
    if (selectedTeamType !== "all") {
      result = result.filter(t => t.type === selectedTeamType);
    }

    // Filter by supervisor
    if (selectedSupervisor !== "all") {
      const teamIdsForSupervisor = supervisorTeams
        .filter(st => st.supervisor_id === selectedSupervisor)
        .map(st => st.team_id);
      result = result.filter(t => teamIdsForSupervisor.includes(t.id));
    }

    // Filter by specific team (in team tab)
    if (selectedTeamId !== "all") {
      result = result.filter(t => t.id === selectedTeamId);
    }

    return result;
  }, [teams, selectedTeamType, selectedSupervisor, selectedTeamId, supervisorTeams]);

  const getScheduleForDay = (teamId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.find(s => s.team_id === teamId && s.date === dateStr);
  };

  const toggleDayStatus = (teamId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = getScheduleForDay(teamId, date);
    const newStatus = existing ? !existing.is_working : false;
    scheduleMutation.mutate({ teamId, date: dateStr, isWorking: newStatus });
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Overview - get stats for today
  const todayStats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    let working = 0;
    let off = 0;
    filteredTeams.forEach(team => {
      const schedule = schedules.find(s => s.team_id === team.id && s.date === today);
      if (schedule?.is_working === false) {
        off++;
      } else {
        working++;
      }
    });
    return { working, off, total: filteredTeams.length };
  }, [filteredTeams, schedules]);

  // Get supervisor name for a team
  const getSupervisorForTeam = (teamId: string) => {
    const st = supervisorTeams.find(s => s.team_id === teamId);
    if (!st) return "-";
    const profile = profiles.find(p => p.id === st.supervisor_id);
    return profile?.name || "-";
  };

  // Fetch schedules for the selected report date
  const { data: reportDateSchedules = [] } = useQuery({
    queryKey: ["schedules-report", format(selectedReportDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const dateStr = format(selectedReportDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("team_schedules")
        .select("*")
        .eq("date", dateStr);
      if (error) throw error;
      return data as ScheduleRecord[];
    },
  });

  // Get teams scheduled for the selected report date
  const teamsScheduledForReportDate = useMemo(() => {
    const dateStr = format(selectedReportDate, "yyyy-MM-dd");
    return teams.map(team => {
      const schedule = reportDateSchedules.find(s => s.team_id === team.id);
      const isWorking = schedule?.is_working ?? true;
      return {
        ...team,
        isWorking,
        observation: schedule?.observation || null,
        entryTime: schedule?.scheduled_entry_time || "07:00",
        exitTime: schedule?.scheduled_exit_time || "17:00",
        supervisor: getSupervisorForTeam(team.id),
      };
    }).filter(t => t.isWorking);
  }, [teams, reportDateSchedules, selectedReportDate, supervisorTeams, profiles]);

  const teamsOffForReportDate = useMemo(() => {
    const dateStr = format(selectedReportDate, "yyyy-MM-dd");
    return teams.map(team => {
      const schedule = reportDateSchedules.find(s => s.team_id === team.id);
      const isWorking = schedule?.is_working ?? true;
      return {
        ...team,
        isWorking,
        observation: schedule?.observation || null,
        supervisor: getSupervisorForTeam(team.id),
      };
    }).filter(t => !t.isWorking);
  }, [teams, reportDateSchedules, selectedReportDate, supervisorTeams, profiles]);

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Controle de Escala
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie a escala mensal das equipes</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Supervisor</Label>
                <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos os supervisores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os supervisores</SelectItem>
                    {supervisors.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo de Equipe</Label>
                <Select value={selectedTeamType} onValueChange={setSelectedTeamType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(selectedSupervisor !== "all" || selectedTeamType !== "all") && (
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSupervisor("all");
                      setSelectedTeamType("all");
                    }}
                  >
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{todayStats.total}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="bg-success/10 border-success/30">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-success">{todayStats.working}</div>
              <div className="text-xs sm:text-sm text-success/80">Trabalho</div>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-destructive">{todayStats.off}</div>
              <div className="text-xs sm:text-sm text-destructive/80">Folga</div>
            </CardContent>
          </Card>
        </div>

        {/* Month Navigation */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg capitalize">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
              <span className="sm:hidden">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Por Equipe</span>
              <span className="sm:hidden">Equipe</span>
            </TabsTrigger>
            <TabsTrigger value="bydate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Por Data</span>
              <span className="sm:hidden">Data</span>
            </TabsTrigger>
          </TabsList>
          <ExportButton
            data={getScheduleCsvData()}
            filename={`escala-${format(currentDate, "yyyy-MM")}`}
            columns={scheduleCsvColumns}
          />

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {filteredTeams.length === teams.length 
                      ? "Todas as Equipes" 
                      : `${filteredTeams.length} Equipe${filteredTeams.length !== 1 ? 's' : ''}`}
                  </CardTitle>
                  <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-success" />
                      <span className="text-muted-foreground">Trabalho</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-destructive" />
                      <span className="text-muted-foreground">Folga</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {filteredTeams.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma equipe encontrada com os filtros selecionados.</p>
                ) : (
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-1 sm:px-2 font-medium text-muted-foreground sticky left-0 bg-card min-w-[100px]">
                          Equipe
                        </th>
                        {daysInMonth.map((day, index) => {
                          const dayOfWeek = getDay(day);
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          return (
                            <th
                              key={format(day, "yyyy-MM-dd")}
                              className={cn(
                                "text-center py-2 px-0.5 sm:px-1 font-medium min-w-[28px] sm:min-w-[32px] border-r border-border/30",
                                isToday(day) ? "text-primary" : "text-muted-foreground",
                                isWeekend && "bg-muted/50 text-muted-foreground font-semibold",
                                dayOfWeek === 0 && "text-destructive/70"
                              )}
                            >
                              <div>{format(day, "d")}</div>
                              <div className="text-[10px] opacity-60">{weekDays[dayOfWeek].charAt(0)}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeams.map((team) => (
                        <tr key={team.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-1.5 px-1 sm:px-2 font-medium sticky left-0 bg-card">
                            <div className="truncate max-w-[100px] sm:max-w-[150px]" title={team.name}>
                              {team.name}
                            </div>
                          </td>
                          {daysInMonth.map((day) => {
                            const schedule = getScheduleForDay(team.id, day);
                            const isWorking = schedule?.is_working ?? true;
                            const hasObs = !!schedule?.observation;
                            const dateStr = format(day, "yyyy-MM-dd");
                            const dayOfWeek = getDay(day);
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                            return (
                              <td 
                                key={dateStr} 
                                className={cn(
                                  "text-center py-1 px-0.5 border-r border-border/30",
                                  isWeekend && "bg-muted/50"
                                )}
                              >
                                {isAdmin ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        className={cn(
                                          "w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition-all text-[10px] sm:text-xs font-medium relative",
                                          "hover:ring-2 hover:ring-ring/50",
                                          isToday(day) && "ring-1 ring-primary",
                                          isWorking
                                            ? "bg-success/20 text-success hover:bg-success/30"
                                            : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                                        )}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          toggleDayStatus(team.id, day);
                                        }}
                                      >
                                        {isWorking ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                        {hasObs && (
                                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-3" align="center">
                                      <SchedulePopoverContent
                                        day={day}
                                        team={team}
                                        schedule={schedule}
                                        isWorking={isWorking}
                                        dateStr={dateStr}
                                        scheduleMutation={scheduleMutation}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <div
                                        className={cn(
                                          "w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-[10px] sm:text-xs font-medium relative cursor-default",
                                          isToday(day) && "ring-1 ring-primary",
                                          isWorking
                                            ? "bg-success/20 text-success"
                                            : "bg-destructive/20 text-destructive"
                                        )}
                                      >
                                        {isWorking ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                        {hasObs && (
                                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                                        )}
                                      </div>
                                    </PopoverTrigger>
                                    {hasObs && (
                                      <PopoverContent className="w-64 p-3" align="center">
                                        <div className="text-sm">
                                          <div className="font-medium mb-1">{team.name}</div>
                                          <div className="text-xs text-muted-foreground mb-2">
                                            {format(day, "dd/MM/yyyy")}
                                          </div>
                                          <div className="text-xs bg-muted p-2 rounded">{schedule?.observation}</div>
                                        </div>
                                      </PopoverContent>
                                    )}
                                  </Popover>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="mt-4 space-y-4">
            {/* Team Filter */}
            <div className="w-full sm:w-64">
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  {teams
                    .filter(team => {
                      // Apply supervisor and type filters
                      if (selectedTeamType !== "all" && team.type !== selectedTeamType) return false;
                      if (selectedSupervisor !== "all") {
                        const teamIdsForSupervisor = supervisorTeams
                          .filter(st => st.supervisor_id === selectedSupervisor)
                          .map(st => st.team_id);
                        if (!teamIdsForSupervisor.includes(team.id)) return false;
                      }
                      return true;
                    })
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-success/20 border-2 border-success" />
                <span className="text-muted-foreground">Trabalho</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-destructive/20 border-2 border-destructive" />
                <span className="text-muted-foreground">Folga</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Com observação</span>
              </div>
            </div>

            {/* Schedule Grid per Team */}
            {filteredTeams.map((team) => (
              <Card key={team.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{team.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Supervisor: {getSupervisorForTeam(team.id)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {team.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Week days header */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day, i) => (
                      <div
                        key={day}
                        className={cn(
                          "text-center text-xs font-medium py-1",
                          i === 0 ? "text-destructive/70" : "text-muted-foreground"
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for days before month starts */}
                    {Array.from({ length: getDay(monthStart) }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {/* Days of the month */}
                    {daysInMonth.map((day) => {
                      const schedule = getScheduleForDay(team.id, day);
                      const isWorking = schedule?.is_working ?? true;
                      const hasObs = !!schedule?.observation;
                      const dateStr = format(day, "yyyy-MM-dd");

                      return isAdmin ? (
                        <Popover key={dateStr}>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm transition-all relative font-medium",
                                "hover:ring-2 hover:ring-ring/50",
                                isToday(day) && "ring-2 ring-primary",
                                isWorking
                                  ? "bg-success/15 text-success border border-success/30 hover:bg-success/25"
                                  : "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25"
                              )}
                              onClick={(e) => {
                                e.preventDefault();
                                toggleDayStatus(team.id, day);
                              }}
                            >
                              <span>{format(day, "d")}</span>
                              {hasObs && (
                                <MessageSquare className="h-3 w-3 absolute top-0.5 right-0.5 text-primary" />
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="center">
                            <SchedulePopoverContent
                              day={day}
                              team={team}
                              schedule={schedule}
                              isWorking={isWorking}
                              dateStr={dateStr}
                              scheduleMutation={scheduleMutation}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Popover key={dateStr}>
                          <PopoverTrigger asChild>
                            <div
                              className={cn(
                                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm relative font-medium cursor-default",
                                isToday(day) && "ring-2 ring-primary",
                                isWorking
                                  ? "bg-success/15 text-success border border-success/30"
                                  : "bg-destructive/15 text-destructive border border-destructive/30"
                              )}
                            >
                              <span>{format(day, "d")}</span>
                              {hasObs && (
                                <MessageSquare className="h-3 w-3 absolute top-0.5 right-0.5 text-primary" />
                              )}
                            </div>
                          </PopoverTrigger>
                          {hasObs && (
                            <PopoverContent className="w-64 p-3" align="center">
                              <div className="text-sm">
                                <div className="font-medium mb-1">{team.name}</div>
                                <div className="text-xs text-muted-foreground mb-2">
                                  {format(day, "dd/MM/yyyy")}
                                </div>
                                <div className="text-xs bg-muted p-2 rounded">{schedule?.observation}</div>
                              </div>
                            </PopoverContent>
                          )}
                        </Popover>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredTeams.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma equipe encontrada com os filtros selecionados
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* By Date Tab */}
          <TabsContent value="bydate" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Selecione a Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(selectedReportDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={selectedReportDate}
                        onSelect={(date) => date && setSelectedReportDate(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-md">
                      <div className="w-3 h-3 rounded-full bg-success" />
                      <span className="text-success font-medium">{teamsScheduledForReportDate.length}</span>
                      <span className="text-muted-foreground">Trabalho</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-md">
                      <div className="w-3 h-3 rounded-full bg-destructive" />
                      <span className="text-destructive font-medium">{teamsOffForReportDate.length}</span>
                      <span className="text-muted-foreground">Folga</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Teams Working */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-success">
                  <Check className="h-4 w-4" />
                  Equipes Escaladas ({teamsScheduledForReportDate.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamsScheduledForReportDate.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhuma equipe escalada para este dia</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Equipe</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tipo</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Supervisor</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Entrada</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Saída</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamsScheduledForReportDate.map((team) => (
                          <tr key={team.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-3 font-medium">{team.name}</td>
                            <td className="py-2 px-3">
                              <Badge variant="outline" className="text-xs">
                                {TEAM_TYPES.find(t => t.value === team.type)?.label || team.type}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{team.supervisor}</td>
                            <td className="py-2 px-3">{team.entryTime?.slice(0, 5) || "07:00"}</td>
                            <td className="py-2 px-3">{team.exitTime?.slice(0, 5) || "17:00"}</td>
                            <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate" title={team.observation || ""}>
                              {team.observation || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Teams Off */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <X className="h-4 w-4" />
                  Equipes de Folga ({teamsOffForReportDate.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamsOffForReportDate.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhuma equipe de folga para este dia</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Equipe</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tipo</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Supervisor</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamsOffForReportDate.map((team) => (
                          <tr key={team.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-3 font-medium">{team.name}</td>
                            <td className="py-2 px-3">
                              <Badge variant="outline" className="text-xs">
                                {TEAM_TYPES.find(t => t.value === team.type)?.label || team.type}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{team.supervisor}</td>
                            <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate" title={team.observation || ""}>
                              {team.observation || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// Extracted popover content component
function SchedulePopoverContent({
  day,
  team,
  schedule,
  isWorking,
  dateStr,
  scheduleMutation,
}: {
  day: Date;
  team: Team;
  schedule: ScheduleRecord | undefined;
  isWorking: boolean;
  dateStr: string;
  scheduleMutation: any;
}) {
  const [entryTime, setEntryTime] = useState(schedule?.scheduled_entry_time?.slice(0, 5) || "07:00");
  const [exitTime, setExitTime] = useState(schedule?.scheduled_exit_time?.slice(0, 5) || "17:00");

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">
        {format(day, "dd/MM/yyyy")} - {team.name}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={isWorking ? "default" : "outline"}
          className={cn("flex-1", isWorking && "bg-success hover:bg-success/90")}
          onClick={() => {
            if (!isWorking) {
              scheduleMutation.mutate({ teamId: team.id, date: dateStr, isWorking: true, obs: schedule?.observation });
            }
          }}
        >
          <Check className="h-4 w-4 mr-1" />
          Trabalho
        </Button>
        <Button
          size="sm"
          variant={!isWorking ? "destructive" : "outline"}
          className="flex-1"
          onClick={() => {
            if (isWorking) {
              scheduleMutation.mutate({ teamId: team.id, date: dateStr, isWorking: false, obs: schedule?.observation });
            }
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Folga
        </Button>
      </div>
      
      {/* Entry and Exit Time */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Entrada
          </label>
          <Input
            type="time"
            value={entryTime}
            onChange={(e) => setEntryTime(e.target.value)}
            onBlur={(e) => {
              if (e.target.value !== (schedule?.scheduled_entry_time?.slice(0, 5) || "07:00")) {
                scheduleMutation.mutate({
                  teamId: team.id,
                  date: dateStr,
                  isWorking,
                  obs: schedule?.observation,
                  entryTime: e.target.value + ":00",
                });
              }
            }}
            className="mt-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Saída
          </label>
          <Input
            type="time"
            value={exitTime}
            onChange={(e) => setExitTime(e.target.value)}
            onBlur={(e) => {
              if (e.target.value !== (schedule?.scheduled_exit_time?.slice(0, 5) || "17:00")) {
                scheduleMutation.mutate({
                  teamId: team.id,
                  date: dateStr,
                  isWorking,
                  obs: schedule?.observation,
                  exitTime: e.target.value + ":00",
                });
              }
            }}
            className="mt-1 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Observação (opcional)</label>
        <Textarea
          placeholder="Adicionar observação..."
          className="mt-1 h-20 text-sm"
          defaultValue={schedule?.observation || ""}
          onBlur={(e) => {
            if (e.target.value !== (schedule?.observation || "")) {
              scheduleMutation.mutate({
                teamId: team.id,
                date: dateStr,
                isWorking,
                obs: e.target.value,
              });
            }
          }}
        />
      </div>
      {schedule?.observation && (
        <div className="text-xs bg-muted p-2 rounded">
          <span className="font-medium">Obs:</span> {schedule.observation}
        </div>
      )}
    </div>
  );
}