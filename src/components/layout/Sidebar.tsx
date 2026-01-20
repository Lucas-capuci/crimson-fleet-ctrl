import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Car,
  Menu,
  X,
  Truck,
  Users2,
  Shield,
  LogOut,
  LogIn,
  CalendarDays,
  BarChart3,
  FileText,
  ClipboardCheck,
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
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, page: "dashboard" },
  { title: "Equipes", url: "/equipes", icon: Users2, page: "teams" },
  { title: "Gestão de Frotas", url: "/frotas", icon: Car, page: "vehicles" },
  { title: "Escala", url: "/escala", icon: CalendarDays, page: "schedule" },
  { title: "Saída", url: "/saida", icon: LogIn, page: "departures" },
  { title: "Produção", url: "/producao", icon: BarChart3, page: "production" },
  { title: "Orçamento", url: "/orcamento", icon: FileText, page: "budget" as PageName },
  { title: "Relatórios", url: "/relatorios", icon: ClipboardCheck, page: "reports" as PageName, adminOnly: true },
];

// Pages allowed for Frotas profile (now just vehicles which includes workshop and drivers)
const FROTAS_ALLOWED_PAGES: PageName[] = ["vehicles"];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin, userRole, signOut } = useAuth();
  const { canViewPage, isFrotasProfile, getUserProfileName } = usePermissions();

  const profileName = getUserProfileName();
  const isProgramacao = profileName === "Programação";

  // Filter nav items based on permissions
  let visibleNavItems = navItems.filter((item) => {
    // For adminOnly items, check if user is admin/gestor or has Programação profile
    if (item.adminOnly) {
      return userRole === "admin" || userRole === "gestor" || isProgramacao;
    }
    // For vehicles page, also allow if user has workshop or drivers permission
    if (item.page === "vehicles") {
      return canViewPage("vehicles") || canViewPage("workshop") || canViewPage("drivers");
    }
    return canViewPage(item.page);
  });

  // If user has Frotas profile, restrict to only fleet management
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
      {/* Mobile Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-sidebar flex items-center justify-between px-4 lg:hidden shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-sidebar-accent">
            <Truck className="h-5 w-5 text-sidebar-foreground" />
          </div>
          <h1 className="text-lg font-bold text-sidebar-foreground">E-Grid</h1>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg bg-sidebar-accent text-sidebar-foreground"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

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
          {/* Logo - Hidden on mobile as it's in header */}
          <div className="hidden lg:flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
            <div className="p-2 rounded-xl bg-sidebar-accent">
              <Truck className="h-6 w-6 text-sidebar-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">E-Grid</h1>
              <p className="text-xs text-sidebar-foreground/70">Gestão Operacional</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 lg:py-6 space-y-1 lg:space-y-2 overflow-y-auto mt-16 lg:mt-0">
            {allNavItems.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 group active:scale-95"
                activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium shadow-lg"
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.title}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
            {user && (
              <div className="text-xs text-sidebar-foreground/70 truncate px-2">
                {user.email}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
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
