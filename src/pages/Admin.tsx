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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, User, Users, Shield, Link2, Unlink, KeyRound, UserPlus, Settings, Check, Trash2 } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { CsvColumn } from "@/lib/exportCsv";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { PAGE_LABELS, ACTION_LABELS, PermissionAction, PageName } from "@/hooks/usePermissions";

type AppRole = "admin" | "supervisor" | "gestor";

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

interface PermissionProfile {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface ProfilePermission {
  id: string;
  profile_id: string;
  page: string;
  action: string;
}

interface UserPermission {
  id: string;
  user_id: string;
  profile_id: string | null;
}

const newUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres").regex(/^[a-z0-9._]+$/, "Use apenas letras minúsculas, números, pontos e underscores"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["admin", "supervisor", "gestor"]),
});

const PAGES: PageName[] = ["dashboard", "vehicles", "drivers", "teams", "departures", "maintenance", "incidents", "schedule", "workshop", "admin"];
const ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "export"];

const Admin = () => {
  const queryClient = useQueryClient();
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("supervisor");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [newUserForm, setNewUserForm] = useState({ name: "", username: "", password: "", role: "supervisor" as AppRole, permissionProfileId: "" });
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

  // Permission profiles
  const { data: permissionProfiles = [] } = useQuery({
    queryKey: ["permission_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_profiles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as PermissionProfile[];
    },
  });

  // Profile permissions
  const { data: profilePermissions = [] } = useQuery({
    queryKey: ["profile_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_permissions")
        .select("*");
      if (error) throw error;
      return data as ProfilePermission[];
    },
  });

  // User permissions (which profile each user has)
  const { data: userPermissions = [] } = useQuery({
    queryKey: ["user_permissions_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*");
      if (error) throw error;
      return data as UserPermission[];
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
    mutationFn: async (data: { name: string; username: string; password: string; role: AppRole; permissionProfileId?: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "create", name: data.name, username: data.username, password: data.password, role: data.role },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      // If a permission profile was selected, assign it
      if (data.permissionProfileId && response.data?.userId) {
        const { error: permError } = await supabase
          .from("user_permissions")
          .insert({ user_id: response.data.userId, profile_id: data.permissionProfileId });
        if (permError) console.error("Error assigning permission profile:", permError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles_with_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_permissions_all"] });
      toast({ title: "Usuário criado com sucesso!" });
      setIsNewUserDialogOpen(false);
      setNewUserForm({ name: "", username: "", password: "", role: "supervisor", permissionProfileId: "" });
      setErrors({});
    },
    onError: (error) => {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", userId },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles_with_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_permissions_all"] });
      queryClient.invalidateQueries({ queryKey: ["supervisor_teams_with_data"] });
      toast({ title: "Usuário excluído com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir usuário", description: error.message, variant: "destructive" });
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

  // Assign permission profile to user
  const assignPermissionProfile = useMutation({
    mutationFn: async ({ userId, profileId }: { userId: string; profileId: string }) => {
      // Check if user already has a permission
      const existing = userPermissions.find((up) => up.user_id === userId);
      
      if (existing) {
        const { error } = await supabase
          .from("user_permissions")
          .update({ profile_id: profileId })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .insert({ user_id: userId, profile_id: profileId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_permissions_all"] });
      toast({ title: "Perfil de permissão atribuído!" });
      setIsPermissionDialogOpen(false);
      setSelectedUserId("");
      setSelectedProfileId("");
    },
    onError: (error) => {
      toast({ title: "Erro ao atribuir perfil", description: error.message, variant: "destructive" });
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

  const openPermissionDialog = (userId: string) => {
    setSelectedUserId(userId);
    const existingPermission = userPermissions.find((up) => up.user_id === userId);
    setSelectedProfileId(existingPermission?.profile_id || "");
    setIsPermissionDialogOpen(true);
  };

  const supervisors = userRolesWithProfiles.filter((r) => r.role === "supervisor");
  const usersWithoutRole = profiles.filter(
    (p) => !userRolesWithProfiles.some((r) => r.user_id === p.id)
  );

  // Get user's permission profile name
  const getUserPermissionProfile = (userId: string) => {
    const userPerm = userPermissions.find((up) => up.user_id === userId);
    if (!userPerm?.profile_id) return null;
    return permissionProfiles.find((pp) => pp.id === userPerm.profile_id);
  };

  // Check if a profile has a specific permission
  const profileHasPermission = (profileId: string, page: string, action: string) => {
    return profilePermissions.some(
      (pp) => pp.profile_id === profileId && pp.page === page && pp.action === action
    );
  };

  // CSV columns for users
  const usersCsvColumns: CsvColumn[] = [
    { key: "profile", header: "Usuário", format: (v) => v?.username || "-" },
    { key: "profile", header: "Nome", format: (v) => v?.name || "-" },
    { key: "profile", header: "Email", format: (v) => v?.email || "-" },
    { key: "role", header: "Função", format: (v) => v === "admin" ? "Administrador" : v === "gestor" ? "Gestor" : "Supervisor" },
  ];

  // CSV columns for supervisor-team links
  const supervisorTeamsCsvColumns: CsvColumn[] = [
    { key: "profile", header: "Supervisor", format: (v) => v?.name || "-" },
    { key: "team", header: "Equipe", format: (v) => v?.name || "-" },
    { key: "team", header: "Tipo", format: (v) => v?.type || "-" },
  ];

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Administração</h1>
        <p className="text-muted-foreground">Gerencie usuários, funções e permissões</p>
      </div>

      <Tabs defaultValue="users" className="animate-fade-in">
        <TabsList className="mb-6 flex-wrap">
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
          <TabsTrigger value="permissions" className="gap-2">
            <Settings className="h-4 w-4" />
            Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Cadastro de Usuários</h2>
            <div className="flex gap-2">
              <ExportButton
                data={userRolesWithProfiles}
                filename={`usuarios-${new Date().toISOString().split('T')[0]}`}
                columns={usersCsvColumns}
              />
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
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUserForm.role === "supervisor" && (
                    <div className="space-y-2">
                      <Label>Perfil de Permissão</Label>
                      <Select 
                        value={newUserForm.permissionProfileId} 
                        onValueChange={(v) => setNewUserForm({ ...newUserForm, permissionProfileId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um perfil (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {permissionProfiles.map((pp) => (
                            <SelectItem key={pp.id} value={pp.id}>
                              {pp.name} {pp.description && `- ${pp.description}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Define quais páginas o usuário poderá visualizar
                      </p>
                    </div>
                  )}
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
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Perfil de Permissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRolesWithProfiles.map((role) => {
                  const permProfile = getUserPermissionProfile(role.user_id);
                  return (
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
                        <Badge variant={role.role === "admin" ? "default" : role.role === "gestor" ? "outline" : "secondary"}>
                          {role.role === "admin" ? "Administrador" : role.role === "gestor" ? "Gestor" : "Supervisor"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {role.role === "admin" ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            Acesso Total
                          </Badge>
                        ) : permProfile ? (
                          <Badge variant="outline">{permProfile.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não definido</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {role.role !== "admin" && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="gap-2"
                              onClick={() => openPermissionDialog(role.user_id)}
                            >
                              <Settings className="h-4 w-4" />
                              Permissões
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="gap-2"
                            onClick={() => openResetPasswordDialog(role.user_id)}
                          >
                            <KeyRound className="h-4 w-4" />
                            Resetar Senha
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="gap-2 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Tem certeza que deseja excluir o usuário ${role.profile?.name || role.profile?.username}?`)) {
                                deleteUser.mutate(role.user_id);
                              }
                            }}
                            disabled={deleteUser.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

          {/* Assign Permission Profile Dialog */}
          <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Atribuir Perfil de Permissão</DialogTitle>
                <DialogDescription>
                  Selecione o perfil de permissões para este usuário
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Perfil</Label>
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {permissionProfiles.map((pp) => (
                        <SelectItem key={pp.id} value={pp.id}>
                          {pp.name} {pp.description && `- ${pp.description}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsPermissionDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => assignPermissionProfile.mutate({ userId: selectedUserId, profileId: selectedProfileId })}
                    disabled={!selectedProfileId || assignPermissionProfile.isPending}
                  >
                    Atribuir
                  </Button>
                </div>
              </div>
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
                        <SelectItem value="gestor">Gestor</SelectItem>
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
                      <Badge variant={role.role === "admin" ? "default" : role.role === "gestor" ? "outline" : "secondary"}>
                        {role.role === "admin" ? "Administrador" : role.role === "gestor" ? "Gestor" : "Supervisor"}
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
            <div className="flex gap-2">
              <ExportButton
                data={supervisorTeamsWithData}
                filename={`vinculos-supervisor-equipe-${new Date().toISOString().split('T')[0]}`}
                columns={supervisorTeamsCsvColumns}
              />
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

        <TabsContent value="permissions">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Perfis de Permissão</h2>
            <p className="text-muted-foreground text-sm">
              Visualize os perfis de permissão disponíveis e suas configurações
            </p>
          </div>

          <div className="grid gap-6">
            {permissionProfiles.map((profile) => (
              <Card key={profile.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        {profile.name}
                        {profile.is_system && (
                          <Badge variant="secondary" className="text-xs">Sistema</Badge>
                        )}
                      </CardTitle>
                      {profile.description && (
                        <CardDescription>{profile.description}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-40">Página</TableHead>
                          {ACTIONS.map((action) => (
                            <TableHead key={action} className="text-center w-24">
                              {ACTION_LABELS[action]}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PAGES.map((page) => (
                          <TableRow key={page}>
                            <TableCell className="font-medium">{PAGE_LABELS[page]}</TableCell>
                            {ACTIONS.map((action) => (
                              <TableCell key={action} className="text-center">
                                {profileHasPermission(profile.id, page, action) ? (
                                  <Check className="h-4 w-4 text-green-600 mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Admin;
