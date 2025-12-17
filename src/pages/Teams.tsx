import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Users, Truck, Car } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type TeamType = "linha_viva" | "linha_morta" | "poda" | "linha_morta_obras" | "recolha";

interface Team {
  id: string;
  name: string;
  type: TeamType;
  has_basket: boolean;
  cost_center: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  name: string;
  username: string | null;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  team_id: string | null;
}

const teamTypeLabels: Record<TeamType, string> = {
  linha_viva: "Linha Viva",
  linha_morta: "Linha Morta",
  poda: "Poda",
  linha_morta_obras: "Linha Morta Obras",
  recolha: "Recolha",
};

const Teams = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterBasket, setFilterBasket] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "linha_viva" as TeamType,
    has_basket: false,
    cost_center: "",
    supervisor_id: "",
    vehicle_id: "",
  });

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch vehicles for dropdown
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, model, team_id")
        .order("plate");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  // Fetch supervisors for dropdown
  const { data: supervisors = [] } = useQuery({
    queryKey: ["supervisors"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "supervisor");
      if (rolesError) throw rolesError;

      const supervisorIds = roles.map((r) => r.user_id);
      if (supervisorIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, username")
        .in("id", supervisorIds);
      if (profilesError) throw profilesError;

      return profiles as Profile[];
    },
  });

  // Fetch supervisor_teams to show current assignment
  const { data: supervisorTeams = [] } = useQuery({
    queryKey: ["supervisor_teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supervisor_teams").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createTeam = useMutation({
    mutationFn: async (data: { name: string; type: TeamType; has_basket: boolean; cost_center: string; supervisor_id: string; vehicle_id: string }) => {
      const { cost_center, supervisor_id, vehicle_id, ...teamData } = data;
      const { data: newTeam, error } = await supabase
        .from("teams")
        .insert({ ...teamData, cost_center: cost_center || null })
        .select()
        .single();
      if (error) throw error;

      // If supervisor is selected, create the assignment
      if (supervisor_id && newTeam) {
        const { error: stError } = await supabase
          .from("supervisor_teams")
          .insert({ supervisor_id, team_id: newTeam.id });
        if (stError) console.error("Error assigning supervisor:", stError);
      }

      // If vehicle is selected, update the vehicle's team_id
      if (vehicle_id && newTeam) {
        const { error: vError } = await supabase
          .from("vehicles")
          .update({ team_id: newTeam.id })
          .eq("id", vehicle_id);
        if (vError) console.error("Error assigning vehicle:", vError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["supervisor_teams"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Equipe criada com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao criar equipe", description: error.message, variant: "destructive" });
    },
  });

  const updateTeam = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; type: TeamType; has_basket: boolean; cost_center: string; supervisor_id: string; vehicle_id: string } }) => {
      const { cost_center, supervisor_id, vehicle_id, ...teamData } = data;
      const { error } = await supabase
        .from("teams")
        .update({ ...teamData, cost_center: cost_center || null })
        .eq("id", id);
      if (error) throw error;

      // Update supervisor assignment
      await supabase.from("supervisor_teams").delete().eq("team_id", id);
      if (supervisor_id) {
        const { error: stError } = await supabase
          .from("supervisor_teams")
          .insert({ supervisor_id, team_id: id });
        if (stError) console.error("Error assigning supervisor:", stError);
      }

      // Update vehicle assignment - first remove old assignment for this team
      await supabase.from("vehicles").update({ team_id: null }).eq("team_id", id);
      
      // Then assign new vehicle if selected
      if (vehicle_id) {
        const { error: vError } = await supabase
          .from("vehicles")
          .update({ team_id: id })
          .eq("id", vehicle_id);
        if (vError) console.error("Error assigning vehicle:", vError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["supervisor_teams"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Equipe atualizada com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar equipe", description: error.message, variant: "destructive" });
    },
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      // First unlink vehicle
      await supabase.from("vehicles").update({ team_id: null }).eq("team_id", id);
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Equipe removida com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover equipe", description: error.message, variant: "destructive" });
    },
  });

  const filteredTeams = teams.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesBasket = filterBasket === "all" || 
      (filterBasket === "with" && t.has_basket) || 
      (filterBasket === "without" && !t.has_basket);
    return matchesSearch && matchesType && matchesBasket;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeam) {
      updateTeam.mutate({ id: editingTeam.id, data: formData });
    } else {
      createTeam.mutate(formData);
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    const assignment = supervisorTeams.find((st) => st.team_id === team.id);
    const linkedVehicle = vehicles.find((v) => v.team_id === team.id);
    setFormData({ 
      name: team.name, 
      type: team.type, 
      has_basket: team.has_basket,
      cost_center: team.cost_center || "",
      supervisor_id: assignment?.supervisor_id || "",
      vehicle_id: linkedVehicle?.id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover esta equipe?")) {
      deleteTeam.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", type: "linha_viva", has_basket: false, cost_center: "", supervisor_id: "", vehicle_id: "" });
    setEditingTeam(null);
    setIsDialogOpen(false);
  };

  // Helper to get supervisor name for a team
  const getSupervisorName = (teamId: string) => {
    const assignment = supervisorTeams.find((st) => st.team_id === teamId);
    if (!assignment) return null;
    const supervisor = supervisors.find((s) => s.id === assignment.supervisor_id);
    return supervisor?.name || supervisor?.username || null;
  };

  // Helper to get vehicle for a team
  const getTeamVehicle = (teamId: string) => {
    return vehicles.find((v) => v.team_id === teamId);
  };

  // Get available vehicles (not assigned to any team or assigned to current editing team)
  const getAvailableVehicles = () => {
    return vehicles.filter((v) => !v.team_id || (editingTeam && v.team_id === editingTeam.id));
  };

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Equipes</h1>
        <p className="text-muted-foreground">Gerencie as equipes da frota</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar equipes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="linha_viva">Linha Viva</SelectItem>
            <SelectItem value="linha_morta">Linha Morta</SelectItem>
            <SelectItem value="poda">Poda</SelectItem>
            <SelectItem value="linha_morta_obras">Linha Morta Obras</SelectItem>
            <SelectItem value="recolha">Recolha</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterBasket} onValueChange={setFilterBasket}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Cesto aéreo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="with">Com Cesto</SelectItem>
            <SelectItem value="without">Sem Cesto</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Equipe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingTeam ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
                <DialogDescription>
                  {editingTeam ? "Atualize os dados da equipe" : "Preencha os dados da nova equipe"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Equipe</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome da equipe"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: TeamType) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linha_viva">Linha Viva</SelectItem>
                        <SelectItem value="linha_morta">Linha Morta</SelectItem>
                        <SelectItem value="poda">Poda</SelectItem>
                        <SelectItem value="linha_morta_obras">Linha Morta Obras</SelectItem>
                        <SelectItem value="recolha">Recolha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_center">Centro de Custo</Label>
                    <Input
                      id="cost_center"
                      value={formData.cost_center}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setFormData({ ...formData, cost_center: value });
                      }}
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle">Veículo Vinculado</Label>
                  <Select
                    value={formData.vehicle_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, vehicle_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {getAvailableVehicles().map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate} - {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supervisor">Supervisor Responsável</Label>
                  <Select
                    value={formData.supervisor_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, supervisor_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {supervisors.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>
                          {sup.name} {sup.username ? `(${sup.username})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_basket"
                    checked={formData.has_basket}
                    onCheckedChange={(checked) => setFormData({ ...formData, has_basket: checked === true })}
                  />
                  <Label htmlFor="has_basket" className="cursor-pointer flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Possui Cesto Aéreo
                  </Label>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createTeam.isPending || updateTeam.isPending}>
                    {editingTeam ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Cesto Aéreo</TableHead>
              {isAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeams.map((team) => {
              const vehicle = getTeamVehicle(team.id);
              return (
                <TableRow key={team.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {team.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {teamTypeLabels[team.type]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {team.cost_center || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {vehicle ? (
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-primary" />
                        <span>{vehicle.plate}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getSupervisorName(team.id) || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {team.has_basket ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Truck className="h-4 w-4" />
                        Sim
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Não</span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(team.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {isLoading && (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        )}
        {!isLoading && filteredTeams.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Nenhuma equipe encontrada</div>
        )}
      </div>
    </MainLayout>
  );
};

export default Teams;