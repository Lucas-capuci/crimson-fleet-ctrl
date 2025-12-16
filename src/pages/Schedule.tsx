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
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Check, X, MessageSquare, Calendar, Users, LayoutGrid } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ScheduleRecord = {
  id: string;
  team_id: string;
  date: string;
  is_working: boolean;
  observation: string | null;
};

type Team = {
  id: string;
  name: string;
  type: string;
};

export default function Schedule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("overview");

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
    mutationFn: async ({ teamId, date, isWorking, obs }: { teamId: string; date: string; isWorking: boolean; obs?: string }) => {
      const existing = schedules.find(s => s.team_id === teamId && s.date === date);
      
      if (existing) {
        const { error } = await supabase
          .from("team_schedules")
          .update({ is_working: isWorking, observation: obs || null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("team_schedules")
          .insert({ team_id: teamId, date, is_working: isWorking, observation: obs || null });
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

  const filteredTeams = useMemo(() => {
    if (selectedTeamId === "all") return teams;
    return teams.filter(t => t.id === selectedTeamId);
  }, [teams, selectedTeamId]);

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
    teams.forEach(team => {
      const schedule = schedules.find(s => s.team_id === team.id && s.date === today);
      if (schedule?.is_working === false) {
        off++;
      } else {
        working++;
      }
    });
    return { working, off, total: teams.length };
  }, [teams, schedules]);

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
          <TabsList className="grid w-full grid-cols-2">
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
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Todas as Equipes</CardTitle>
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
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-1 sm:px-2 font-medium text-muted-foreground sticky left-0 bg-card min-w-[100px]">
                        Equipe
                      </th>
                      {daysInMonth.map((day) => (
                        <th
                          key={format(day, "yyyy-MM-dd")}
                          className={cn(
                            "text-center py-2 px-0.5 sm:px-1 font-medium min-w-[28px] sm:min-w-[32px]",
                            isToday(day) ? "text-primary" : "text-muted-foreground",
                            getDay(day) === 0 && "text-destructive/70"
                          )}
                        >
                          <div>{format(day, "d")}</div>
                          <div className="text-[10px] opacity-60">{weekDays[getDay(day)].charAt(0)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
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

                          return (
                            <td key={dateStr} className="text-center py-1 px-0.5">
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
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  {teams.map((team) => (
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
                    <CardTitle className="text-base">{team.name}</CardTitle>
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

                      return (
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
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredTeams.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma equipe encontrada
                </CardContent>
              </Card>
            )}
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
