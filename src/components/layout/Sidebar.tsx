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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Equipes", url: "/equipes", icon: Users2 },
  { title: "Veículos", url: "/veiculos", icon: Car },
  { title: "Saída", url: "/saida", icon: LogIn },
  { title: "Oficina", url: "/oficina", icon: Building },
  { title: "Motoristas", url: "/motoristas", icon: Users },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();

  const allNavItems = isAdmin 
    ? [...navItems, { title: "Administração", url: "/admin", icon: Shield }]
    : navItems;

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
              <h1 className="text-lg font-bold text-sidebar-foreground">FleetControl</h1>
              <p className="text-xs text-sidebar-foreground/70">Sistema de Frotas</p>
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
