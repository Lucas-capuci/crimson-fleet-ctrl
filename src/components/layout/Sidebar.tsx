import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Car,
  Users,
  Menu,
  X,
  Truck,
  Users2,
  Building,
  Shield,
  LogOut,
  LogIn,
  CalendarDays,
  BarChart3,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { usePermissions, PageName } from "@/hooks/usePermissions";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  page: PageName;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, page: "dashboard" },
  { title: "Equipes", url: "/equipes", icon: Users2, page: "teams" },
  { title: "Veículos", url: "/veiculos", icon: Car, page: "vehicles" },
  { title: "Escala", url: "/escala", icon: CalendarDays, page: "schedule" },
  { title: "Saída", url: "/saida", icon: LogIn, page: "departures" },
  { title: "Oficina", url: "/oficina", icon: Building, page: "workshop" },
  { title: "Motoristas", url: "/motoristas", icon: Users, page: "drivers" },
  { title: "Produção", url: "/producao", icon: BarChart3, page: "production" },
  { title: "Orçamento", url: "/orcamento", icon: FileText, page: "budget" as PageName },
];

// Pages allowed for Frotas profile
const FROTAS_ALLOWED_PAGES: PageName[] = ["vehicles", "workshop"];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin, userRole, signOut } = useAuth();
  const { canViewPage, isFrotasProfile } = usePermissions();

  // Filter nav items based on permissions
  let visibleNavItems = navItems.filter((item) => canViewPage(item.page));

  // If user has Frotas profile, restrict to only vehicles and workshop
  if (isFrotasProfile()) {
    visibleNavItems = visibleNavItems.filter((item) => 
      FROTAS_ALLOWED_PAGES.includes(item.page)
    );
  }

  // Add admin page only if user is admin (not gestor)
  const allNavItems = userRole === "admin"
    ? [...visibleNavItems, { title: "Administração", url: "/admin", icon: Shield, page: "admin" as PageName }]
    : visibleNavItems;

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-primary text-primary-foreground lg:hidden shadow-lg"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
            <div className="p-2 rounded-xl bg-sidebar-accent">
              <Truck className="h-6 w-6 text-sidebar-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">E-Grid</h1>
              <p className="text-xs text-sidebar-foreground/70">Gestão Operacional</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {allNavItems.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 group"
                activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium shadow-lg"
              >
                <item.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>{item.title}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
            {user && (
              <div className="text-xs text-sidebar-foreground/70 truncate px-2">
                {user.email}
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
