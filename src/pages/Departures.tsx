import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Play, Check, X, ChevronLeft, ChevronRight, Calendar, Clock, Users, Pencil, AlertCircle } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { CsvColumn, formatBoolean } from "@/lib/exportCsv";

interface Team {
  id: string;
  name: string;
  type: string;
  show_in_departures: boolean;
  vehicles: { plate: string; model: string } | null;
}

interface TeamSchedule {
  team_id: string;
  is_working: boolean;
  observation: string | null;
}

interface Departure {
  id: string;
  team_id: string;
  supervisor_id: string;
  date: string;
  departed: boolean;
  departure_time: string | null;
  no_departure_reason: string | null;
  teams: { name: string; type: string };
  supervisorName: string;
}

interface DepartureFormData {
  departed: boolean;
  departure_time: string;
  no_departure_reason: string;
}

const Departures = () => {
  const { isAdmin, user, userTeamIds } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Wizard state for supervisor
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [wizardData, setWizardData] = useState<Record<string, DepartureFormData>>({});
  
  // Admin filter state
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterSupervisor, setFilterSupervisor] = useState<string>("all");
  
  // Admin edit state
  const [editingDeparture, setEditingDeparture] = useState<Departure | null>(null);
  const [editForm, setEditForm] = useState<DepartureFormData>({
    departed: true,
    departure_time: "07:00",
    no_departure_reason: "",
  });

  // Fetch teams for supervisor wizard (only those assigned to this supervisor)
  const { data: allTeams = [] } = useQuery({
    queryKey: ["supervisor_teams_departures", userTeamIds],
    queryFn: async () => {
      if (userTeamIds.length === 0) return [];
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, type, show_in_departures, vehicles(plate, model)")
        .in("id", userTeamIds)
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
    enabled: !isAdmin && userTeamIds.length > 0,
  });

  // Fetch team schedules for the selected date
  const { data: teamSchedules = [] } = useQuery({
    queryKey: ["team_schedules_for_date", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_schedules")
        .select("team_id, is_working, observation")
        .eq("date", selectedDate);
      if (error) throw error;
      return data as TeamSchedule[];
    },
    enabled: !isAdmin,
  });

  // Filter teams: only those visible in departures AND scheduled to work
  const teams = allTeams.filter((team) => {
    if (!team.show_in_departures) return false;
    
    // Check schedule - if there's no schedule entry, assume working
    const schedule = teamSchedules.find((s) => s.team_id === team.id);
    return schedule ? schedule.is_working : true;
  });

  // Teams that are visible but not scheduled (to show disabled)
  const notScheduledTeams = allTeams.filter((team) => {
    if (!team.show_in_departures) return false;
    const schedule = teamSchedules.find((s) => s.team_id === team.id);
    return schedule && !schedule.is_working;
  });

  // Fetch departures for the table
  const { data: departures = [], isLoading } = useQuery({
    queryKey: ["departures", filterDate, filterSupervisor],
    queryFn: async () => {
      let query = supabase
        .from("departures")
        .select("*, teams(name, type)")
        .eq("date", filterDate)
        .order("created_at", { ascending: false });
      
      if (filterSupervisor !== "all") {
        query = query.eq("supervisor_id", filterSupervisor);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch supervisor names separately
      const supervisorIds = [...new Set(data.map(d => d.supervisor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", supervisorIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      
      return data.map(d => ({
        ...d,
        supervisorName: profilesMap.get(d.supervisor_id) || "-"
      }));
    },
  });

  // CSV columns for departures
  const departuresCsvColumns: CsvColumn[] = [
    { key: "date", header: "Data", format: (v) => format(new Date(v + "T12:00:00"), "dd/MM/yyyy") },
    { key: "teams", header: "Equipe", format: (v) => v?.name || "-" },
    { key: "teams", header: "Tipo", format: (v) => v?.type || "-" },
    { key: "supervisorName", header: "Supervisor" },
    { key: "departed", header: "Status", format: (v) => formatBoolean(v, "Saiu", "Não Saiu") },
    { key: "departure_time", header: "Horário", format: (v) => v || "-" },
    { key: "no_departure_reason", header: "Motivo", format: (v) => v || "-" },
  ];

  // Fetch supervisors for admin filter
  const { data: supervisors = [] } = useQuery({
    queryKey: ["supervisors_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Check existing departures for wizard
  const { data: existingDepartures = [] } = useQuery({
    queryKey: ["existing_departures", selectedDate, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("departures")
        .select("team_id, departed, departure_time, no_departure_reason")
        .eq("date", selectedDate)
        .eq("supervisor_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !isAdmin && !!user?.id,
  });

  // Save departures mutation
  const saveDepartures = useMutation({
    mutationFn: async (departuresData: { team_id: string; data: DepartureFormData }[]) => {
      for (const dep of departuresData) {
        const existing = existingDepartures.find(e => e.team_id === dep.team_id);
        
        const departureRecord = {
          team_id: dep.team_id,
          supervisor_id: user?.id,
          date: selectedDate,
          departed: dep.data.departed,
          departure_time: dep.data.departed ? dep.data.departure_time : null,
          no_departure_reason: !dep.data.departed ? dep.data.no_departure_reason : null,
        };

        if (existing) {
          const { error } = await supabase
            .from("departures")
            .update(departureRecord)
            .eq("team_id", dep.team_id)
            .eq("date", selectedDate);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("departures")
            .insert(departureRecord);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departures"] });
      queryClient.invalidateQueries({ queryKey: ["existing_departures"] });
      toast({ title: "Lançamentos salvos com sucesso!" });
      setIsWizardOpen(false);
      setWizardData({});
      setCurrentTeamIndex(0);
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar", description: String(error), variant: "destructive" });
    },
  });

  // Admin edit mutation
  const updateDeparture = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DepartureFormData }) => {
      const { error } = await supabase
        .from("departures")
        .update({
          departed: data.departed,
          departure_time: data.departed ? data.departure_time : null,
          no_departure_reason: !data.departed ? data.no_departure_reason : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departures"] });
      toast({ title: "Saída atualizada com sucesso!" });
      setEditingDeparture(null);
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar", description: String(error), variant: "destructive" });
    },
  });

  // Initialize wizard with existing data
  const startWizard = () => {
    const initialData: Record<string, DepartureFormData> = {};
    teams.forEach(team => {
      const existing = existingDepartures.find(e => e.team_id === team.id);
      initialData[team.id] = {
        departed: existing?.departed ?? true,
        departure_time: existing?.departure_time ?? "07:00",
        no_departure_reason: existing?.no_departure_reason ?? "",
      };
    });
    setWizardData(initialData);
    setCurrentTeamIndex(0);
    setIsWizardOpen(true);
  };

  // Start editing a departure
  const startEditing = (dep: Departure) => {
    setEditingDeparture(dep);
    setEditForm({
      departed: dep.departed,
      departure_time: dep.departure_time || "07:00",
      no_departure_reason: dep.no_departure_reason || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingDeparture) return;
    updateDeparture.mutate({ id: editingDeparture.id, data: editForm });
  };

  const currentTeam = teams[currentTeamIndex];
  const currentData = currentTeam ? wizardData[currentTeam.id] : null;

  const updateCurrentTeam = (field: keyof DepartureFormData, value: any) => {
    if (!currentTeam) return;
    setWizardData(prev => ({
      ...prev,
      [currentTeam.id]: { ...prev[currentTeam.id], [field]: value },
    }));
  };

  const handleNext = () => {
    if (currentTeamIndex < teams.length - 1) {
      setCurrentTeamIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentTeamIndex > 0) {
      setCurrentTeamIndex(prev => prev - 1);
    }
  };

  const handleSaveAll = () => {
    const departuresData = Object.entries(wizardData).map(([team_id, data]) => ({
      team_id,
      data,
    }));
    saveDepartures.mutate(departuresData);
  };

  const totalTeams = teams.length;

  return (
    <MainLayout>
      <div className="mb-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Controle de Saída</h1>
        <p className="text-muted-foreground">
          {isAdmin ? "Visualize e edite os lançamentos por supervisor e data" : "Lance a saída das equipes por dia"}
        </p>
      </div>

      {/* Supervisor View - Quick Launch Button */}
      {!isAdmin && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="departure-date">Data do Lançamento</Label>
                <Input
                  id="departure-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-48 mt-1"
                />
              </div>
              <Button 
                onClick={startWizard} 
                size="lg" 
                className="gap-2"
                disabled={teams.length === 0}
              >
                <Play className="h-5 w-5" />
                Lançar Saídas ({teams.length} equipes)
              </Button>
            </div>
            
            {/* Show teams not scheduled for this date */}
            {notScheduledTeams.length > 0 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Equipes não escaladas para este dia:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {notScheduledTeams.map((team) => {
                    const schedule = teamSchedules.find((s) => s.team_id === team.id);
                    return (
                      <Badge key={team.id} variant="secondary" className="text-xs">
                        {team.name}
                        {schedule?.observation && ` - ${schedule.observation}`}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Filters */}
      {isAdmin && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <Label htmlFor="filter-date">Data</Label>
                <Input
                  id="filter-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-48 mt-1"
                />
              </div>
              <div>
                <Label htmlFor="filter-supervisor">Supervisor</Label>
                <Select value={filterSupervisor} onValueChange={setFilterSupervisor}>
                  <SelectTrigger className="w-48 mt-1">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {supervisors.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Departures Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lançamentos - {format(new Date(filterDate + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
          </CardTitle>
          <ExportButton
            data={departures}
            filename={`saidas-${filterDate}`}
            columns={departuresCsvColumns}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : departures.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum lançamento encontrado para esta data.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Tipo</TableHead>
                  {isAdmin && <TableHead>Supervisor</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Horário/Motivo</TableHead>
                  {isAdmin && <TableHead className="w-16">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {departures.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell className="font-medium">{dep.teams?.name}</TableCell>
                    <TableCell>{dep.teams?.type}</TableCell>
                    {isAdmin && <TableCell>{dep.supervisorName}</TableCell>}
                    <TableCell>
                      {dep.departed ? (
                        <Badge variant="default" className="bg-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Saiu
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <X className="h-3 w-3 mr-1" />
                          Não Saiu
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {dep.departed ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {dep.departure_time}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{dep.no_departure_reason || "-"}</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditing(dep)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Admin Edit Dialog */}
      <Dialog open={!!editingDeparture} onOpenChange={(open) => !open && setEditingDeparture(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Saída</DialogTitle>
          </DialogHeader>

          {editingDeparture && (
            <div className="space-y-6">
              {/* Team Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{editingDeparture.teams?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {editingDeparture.teams?.type} • {format(new Date(editingDeparture.date + "T12:00:00"), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Selection */}
              <div className="text-center">
                <p className="text-lg mb-4">Status da saída</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    size="lg"
                    variant={editForm.departed ? "default" : "outline"}
                    onClick={() => setEditForm(prev => ({ ...prev, departed: true }))}
                    className="w-32"
                  >
                    <Check className="h-5 w-5 mr-2" />
                    Saiu
                  </Button>
                  <Button
                    size="lg"
                    variant={!editForm.departed ? "destructive" : "outline"}
                    onClick={() => setEditForm(prev => ({ ...prev, departed: false }))}
                    className="w-32"
                  >
                    <X className="h-5 w-5 mr-2" />
                    Não Saiu
                  </Button>
                </div>
              </div>

              {/* Conditional Fields */}
              {editForm.departed ? (
                <div>
                  <Label htmlFor="edit-departure-time">Horário de Saída</Label>
                  <Input
                    id="edit-departure-time"
                    type="time"
                    value={editForm.departure_time}
                    onChange={(e) => setEditForm(prev => ({ ...prev, departure_time: e.target.value }))}
                    className="w-full mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="edit-no-departure-reason">Motivo</Label>
                  <Textarea
                    id="edit-no-departure-reason"
                    value={editForm.no_departure_reason}
                    onChange={(e) => setEditForm(prev => ({ ...prev, no_departure_reason: e.target.value }))}
                    placeholder="Informe o motivo da não saída..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setEditingDeparture(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={updateDeparture.isPending}>
                  {updateDeparture.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wizard Dialog */}
      <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Lançamento de Saída</span>
              <Badge variant="outline">
                {currentTeamIndex + 1} / {totalTeams}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {currentTeam && currentData && (
            <div className="space-y-6">
              {/* Team Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{currentTeam.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {currentTeam.type} {currentTeam.vehicles && `• ${currentTeam.vehicles.plate}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Question */}
              <div className="text-center">
                <p className="text-lg mb-4">A equipe saiu hoje?</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    size="lg"
                    variant={currentData.departed ? "default" : "outline"}
                    onClick={() => updateCurrentTeam("departed", true)}
                    className="w-32"
                  >
                    <Check className="h-5 w-5 mr-2" />
                    Sim
                  </Button>
                  <Button
                    size="lg"
                    variant={!currentData.departed ? "destructive" : "outline"}
                    onClick={() => updateCurrentTeam("departed", false)}
                    className="w-32"
                  >
                    <X className="h-5 w-5 mr-2" />
                    Não
                  </Button>
                </div>
              </div>

              {/* Conditional Fields */}
              {currentData.departed ? (
                <div>
                  <Label htmlFor="departure-time">Horário de Saída</Label>
                  <Input
                    id="departure-time"
                    type="time"
                    value={currentData.departure_time}
                    onChange={(e) => updateCurrentTeam("departure_time", e.target.value)}
                    className="w-full mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="no-departure-reason">Motivo</Label>
                  <Textarea
                    id="no-departure-reason"
                    value={currentData.no_departure_reason}
                    onChange={(e) => updateCurrentTeam("no_departure_reason", e.target.value)}
                    placeholder="Informe o motivo da não saída..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentTeamIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>

                {currentTeamIndex === totalTeams - 1 ? (
                  <Button 
                    onClick={handleSaveAll}
                    disabled={saveDepartures.isPending}
                  >
                    {saveDepartures.isPending ? "Salvando..." : "Salvar Todos"}
                  </Button>
                ) : (
                  <Button onClick={handleNext}>
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>

              {/* Progress */}
              <div className="flex gap-1">
                {teams.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      idx <= currentTeamIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Departures;
