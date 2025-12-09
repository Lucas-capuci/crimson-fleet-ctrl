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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, User, Users, Shield, Link2, Unlink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "supervisor";

interface Profile {
  id: string;
  name: string;
  email: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface Team {
  id: string;
  name: string;
  type: string;
}

interface SupervisorTeam {
  id: string;
  supervisor_id: string;
  team_id: string;
  teams?: Team;
}

const Admin = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("supervisor");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserRole[];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["all_teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  const { data: supervisorTeams = [] } = useQuery({
    queryKey: ["supervisor_teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisor_teams")
        .select(`*, teams (id, name, type)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupervisorTeam[];
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      toast({ title: "Função atribuída com sucesso!" });
      setIsRoleDialogOpen(false);
      setSelectedUserId("");
    },
    onError: (error) => {
      toast({ title: "Erro ao atribuir função", description: error.message, variant: "destructive" });
    },
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      toast({ title: "Função removida com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover função", description: error.message, variant: "destructive" });
    },
  });

  const assignTeam = useMutation({
    mutationFn: async ({ supervisorId, teamId }: { supervisorId: string; teamId: string }) => {
      const { error } = await supabase.from("supervisor_teams").insert({ 
        supervisor_id: supervisorId, 
        team_id: teamId 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisor_teams"] });
      toast({ title: "Equipe vinculada com sucesso!" });
      setIsTeamDialogOpen(false);
      setSelectedUserId("");
      setSelectedTeamId("");
    },
    onError: (error) => {
      toast({ title: "Erro ao vincular equipe", description: error.message, variant: "destructive" });
    },
  });

  const unassignTeam = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("supervisor_teams").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisor_teams"] });
      toast({ title: "Vínculo removido com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover vínculo", description: error.message, variant: "destructive" });
    },
  });

  const supervisors = userRoles.filter((r) => r.role === "supervisor");
  const usersWithoutRole = profiles.filter(
    (p) => !userRoles.some((r) => r.user_id === p.id)
  );

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Administração</h1>
        <p className="text-muted-foreground">Gerencie usuários, funções e permissões</p>
      </div>

      <Tabs defaultValue="roles" className="animate-fade-in">
        <TabsList className="mb-6">
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Funções
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Link2 className="h-4 w-4" />
            Vínculos de Equipes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Usuários e Funções</h2>
            <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Atribuir Função
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Atribuir Função</DialogTitle>
                  <DialogDescription>
                    Selecione um usuário e a função a ser atribuída
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Usuário</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {usersWithoutRole.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Função</Label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => addRole.mutate({ userId: selectedUserId, role: selectedRole })}
                      disabled={!selectedUserId || addRole.isPending}
                    >
                      Atribuir
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRoles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        {role.profiles?.name || "Usuário"}
                      </div>
                    </TableCell>
                    <TableCell>{role.profiles?.email}</TableCell>
                    <TableCell>
                      <Badge variant={role.role === "admin" ? "default" : "secondary"}>
                        {role.role === "admin" ? "Administrador" : "Supervisor"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeRole.mutate(role.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {userRoles.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum usuário com função atribuída
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Supervisores e Equipes</h2>
            <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Vincular Equipe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vincular Equipe a Supervisor</DialogTitle>
                  <DialogDescription>
                    Selecione o supervisor e a equipe
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Supervisor</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um supervisor" />
                      </SelectTrigger>
                      <SelectContent>
                        {supervisors.map((s) => (
                          <SelectItem key={s.user_id} value={s.user_id}>
                            {s.profiles?.name} ({s.profiles?.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Equipe</Label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsTeamDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => assignTeam.mutate({ supervisorId: selectedUserId, teamId: selectedTeamId })}
                      disabled={!selectedUserId || !selectedTeamId || assignTeam.isPending}
                    >
                      Vincular
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisorTeams.map((st) => (
                  <TableRow key={st.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        {st.profiles?.name}
                      </div>
                    </TableCell>
                    <TableCell>{st.profiles?.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {st.teams?.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => unassignTeam.mutate(st.id)}
                      >
                        <Unlink className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {supervisorTeams.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum vínculo configurado
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Admin;
