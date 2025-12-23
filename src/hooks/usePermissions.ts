import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "export";
export type PageName = "dashboard" | "vehicles" | "drivers" | "teams" | "departures" | "maintenance" | "incidents" | "schedule" | "workshop" | "admin" | "production";

export const PAGE_LABELS: Record<PageName, string> = {
  dashboard: "Dashboard",
  vehicles: "Veículos",
  drivers: "Motoristas",
  teams: "Equipes",
  departures: "Saídas",
  maintenance: "Manutenção",
  incidents: "Ocorrências",
  schedule: "Escala",
  workshop: "Oficina",
  admin: "Administração",
  production: "Produção",
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  export: "Exportar",
};

export interface PermissionProfile {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface ProfilePermission {
  id: string;
  profile_id: string;
  page: string;
  action: PermissionAction;
}

export interface UserPermission {
  id: string;
  user_id: string;
  profile_id: string | null;
}

export interface UserCustomPermission {
  id: string;
  user_id: string;
  page: string;
  action: PermissionAction;
  allowed: boolean;
}

export function usePermissions() {
  const { user, isAdmin } = useAuth();

  // Fetch permission profiles
  const { data: profiles = [] } = useQuery({
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

  // Fetch profile permissions
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

  // Fetch user's assigned profile
  const { data: userPermission } = useQuery({
    queryKey: ["user_permission", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserPermission | null;
    },
    enabled: !!user?.id,
  });

  // Fetch user's custom permissions (overrides)
  const { data: customPermissions = [] } = useQuery({
    queryKey: ["user_custom_permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_custom_permissions")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as UserCustomPermission[];
    },
    enabled: !!user?.id,
  });

  // Check if user has a specific permission
  const hasPermission = (page: PageName, action: PermissionAction): boolean => {
    // Admins have all permissions
    if (isAdmin) return true;

    // Check custom permissions first (they override profile permissions)
    const customPerm = customPermissions.find(
      (cp) => cp.page === page && cp.action === action
    );
    if (customPerm !== undefined) {
      return customPerm.allowed;
    }

    // Fall back to profile permissions
    if (userPermission?.profile_id) {
      return profilePermissions.some(
        (pp) =>
          pp.profile_id === userPermission.profile_id &&
          pp.page === page &&
          pp.action === action
      );
    }

    // No permission assigned - deny by default
    return false;
  };

  // Check if user can view a page
  const canViewPage = (page: PageName): boolean => {
    return hasPermission(page, "view");
  };

  // Get all permissions for a profile
  const getProfilePermissions = (profileId: string): ProfilePermission[] => {
    return profilePermissions.filter((pp) => pp.profile_id === profileId);
  };

  return {
    profiles,
    profilePermissions,
    userPermission,
    customPermissions,
    hasPermission,
    canViewPage,
    getProfilePermissions,
    isLoading: !profiles.length,
  };
}
