import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Car,
  Wrench,
  Users,
  AlertTriangle,
  Menu,
  X,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Veículos", url: "/veiculos", icon: Car },
  { title: "Manutenção", url: "/manutencao", icon: Wrench },
  { title: "Motoristas", url: "/motoristas", icon: Users },
  { title: "Ocorrências", url: "/ocorrencias", icon: AlertTriangle },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

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
            {navItems.map((item) => (
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
          <div className="px-6 py-4 border-t border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/50 text-center">
              © 2024 FleetControl
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
