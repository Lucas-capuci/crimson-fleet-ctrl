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
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Check, X, MessageSquare, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay } from "date-fns";
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
  const [editingDay, setEditingDay] = useState<{ teamId: string; date: string } | null>(null);
  const [observation, setObservation] = useState("");

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
    const newStatus = existing ? !existing.is_working : false; // default is working, so toggle to off
    scheduleMutation.mutate({ teamId, date: dateStr, isWorking: newStatus });
  };

  const saveObservation = () => {
    if (!editingDay) return;
    const existing = schedules.find(s => s.team_id === editingDay.teamId && s.date === editingDay.date);
    scheduleMutation.mutate({
      teamId: editingDay.teamId,
      date: editingDay.date,
      isWorking: existing?.is_working ?? true,
      obs: observation,
    });
    setEditingDay(null);
    setObservation("");
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500" />
            <span className="text-muted-foreground">Trabalho</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500" />
            <span className="text-muted-foreground">Folga</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Com observação</span>
          </div>
        </div>

        {/* Schedule Grid */}
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
                {weekDays.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
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
                            "aspect-square rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm transition-all relative",
                            "hover:ring-2 hover:ring-primary/50",
                            isToday(day) && "ring-2 ring-primary",
                            isWorking
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                              : "bg-red-500/20 text-red-700 dark:text-red-400"
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            toggleDayStatus(team.id, day);
                          }}
                        >
                          <span className="font-medium">{format(day, "d")}</span>
                          {hasObs && (
                            <MessageSquare className="h-3 w-3 absolute top-0.5 right-0.5 text-primary" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="center">
                        <div className="space-y-3">
                          <div className="text-sm font-medium">
                            {format(day, "dd/MM/yyyy")} - {team.name}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={isWorking ? "default" : "outline"}
                              className="flex-1"
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
      </div>
    </MainLayout>
  );
}
