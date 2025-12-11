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
import { Plus, User, Users, Shield, Link2, Unlink, KeyRound, UserPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

type AppRole = "admin" | "supervisor";

interface Profile {
  id: string;
  name: string;
  email: string;
  username: string | null;
}

interface UserRoleWithProfile {
  id: string;
  user_id: string;
  role: AppRole;
  profile: Profile | null;
}

interface Team {
  id: string;
  name: string;
  type: string;
}

interface SupervisorTeamWithData {
  id: string;
  supervisor_id: string;
  team_id: string;
  team: Team | null;
  profile: Profile | null;
}

const newUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres").regex(/^[a-z0-9._]+$/, "Use apenas letras minúsculas, números, pontos e underscores"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["admin", "supervisor"]),
});

const Admin = () => {
  const queryClient = useQueryClient();
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("supervisor");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [newUserForm, setNewUserForm] = useState({ name: "", username: "", password: "", role: "supervisor" as AppRole });
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswordUserId, setResetPasswordUserId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const { data: userRolesWithProfiles = [] } = useQuery({
    queryKey: ["user_roles_with_profiles"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });
      if (rolesError) throw rolesError;

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*");
      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData.map((p) => [p.id, p]));
      
      return roles.map((role) => ({
        ...role,
        profile: profilesMap.get(role.user_id) || null,
      })) as UserRoleWithProfile[];
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

  const { data: supervisorTeamsWithData = [] } = useQuery({
    queryKey: ["supervisor_teams_with_data"],
    queryFn: async () => {
      const { data: stData, error: stError } = await supabase
        .from("supervisor_teams")
        .select("*")
        .order("created_at", { ascending: false });
      if (stError) throw stError;

      const { data: profilesData } = await supabase.from("profiles").select("*");
      const { data: teamsData } = await supabase.from("teams").select("*");

      const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);
      const teamsMap = new Map(teamsData?.map((t) => [t.id, t]) || []);

      return stData.map((st) => ({
        ...st,
        profile: profilesMap.get(st.supervisor_id) || null,
        team: teamsMap.get(st.team_id) || null,
      })) as SupervisorTeamWithData[];
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_roles_with_profiles"] });
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
      queryClient.invalidateQueries({ queryKey: ["user_roles_with_profiles"] });
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
      queryClient.invalidateQueries({ queryKey: ["supervisor_teams_with_data"] });
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
      queryClient.invalidateQueries({ queryKey: ["supervisor_teams_with_data"] });
      toast({ title: "Vínculo removido com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover vínculo", description: error.message, variant: "destructive" });
    },
  });

  const createUser = useMutation({
    mutationFn: async (data: { name: string; username: string; password: string; role: AppRole }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "create", ...data },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles_with_profiles"] });
      toast({ title: "Usuário criado com sucesso!" });
      setIsNewUserDialogOpen(false);
      setNewUserForm({ name: "", username: "", password: "", role: "supervisor" });
      setErrors({});
    },
    onError: (error) => {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "reset-password", userId, newPassword },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast({ title: "Senha alterada com sucesso!" });
      setIsResetPasswordDialogOpen(false);
      setNewPassword("");
      setResetPasswordUserId("");
    },
    onError: (error) => {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = newUserSchema.safeParse(newUserForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    createUser.mutate(newUserForm);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    resetPassword.mutate({ userId: resetPasswordUserId, newPassword });
  };

  const openResetPasswordDialog = (userId: string) => {
    setResetPasswordUserId(userId);
    setNewPassword("");
    setIsResetPasswordDialogOpen(true);
  };

  const supervisors = userRolesWithProfiles.filter((r) => r.role === "supervisor");
  const usersWithoutRole = profiles.filter(
    (p) => !userRolesWithProfiles.some((r) => r.user_id === p.id)
  );

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Administração</h1>
        <p className="text-muted-foreground">Gerencie usuários, funções e permissões</p>
      </div>

      <Tabs defaultValue="users" className="animate-fade-in">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Funções
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Link2 className="h-4 w-4" />
            Vínculos de Equipes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Cadastro de Usuários</h2>
            <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo usuário no sistema
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      placeholder="Nome completo"
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Usuário</Label>
                    <Input
                      value={newUserForm.username}
                      onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value.toLowerCase() })}
                      placeholder="usuario.exemplo"
                    />
                    {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input
                      type="password"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      placeholder="••••••••"
                    />
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Função</Label>
                    <Select value={newUserForm.role} onValueChange={(v) => setNewUserForm({ ...newUserForm, role: v as AppRole })}>
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
                    <Button type="button" variant="outline" onClick={() => setIsNewUserDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createUser.isPending}>
                      Criar Usuário
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRolesWithProfiles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        {role.profile?.username || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{role.profile?.name || "Usuário"}</TableCell>
                    <TableCell>
                      <Badge variant={role.role === "admin" ? "default" : "secondary"}>
                        {role.role === "admin" ? "Administrador" : "Supervisor"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="gap-2"
                        onClick={() => openResetPasswordDialog(role.user_id)}
                      >
                        <KeyRound className="h-4 w-4" />
                        Resetar Senha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {userRolesWithProfiles.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum usuário cadastrado
              </div>
            )}
          </div>

          {/* Reset Password Dialog */}
          <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Resetar Senha</DialogTitle>
                <DialogDescription>
                  Digite a nova senha para o usuário
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nova Senha</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={resetPassword.isPending}>
                    Alterar Senha
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

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
                            {p.name} ({p.username || p.email})
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
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRolesWithProfiles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        {role.profile?.username || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{role.profile?.name || "Usuário"}</TableCell>
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
            {userRolesWithProfiles.length === 0 && (
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
                            {s.profile?.name} ({s.profile?.username || s.profile?.email})
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
                  <TableHead>Nome</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisorTeamsWithData.map((st) => (
                  <TableRow key={st.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        {st.profile?.username || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{st.profile?.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {st.team?.name}
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
            {supervisorTeamsWithData.length === 0 && (
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
