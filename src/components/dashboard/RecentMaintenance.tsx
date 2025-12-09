import { Wrench, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaintenanceItem {
  id: number;
  vehicle: string;
  plate: string;
  type: string;
  date: string;
  status: "completed" | "pending" | "overdue";
}

const maintenanceData: MaintenanceItem[] = [
  {
    id: 1,
    vehicle: "Fiat Strada",
    plate: "ABC-1234",
    type: "Troca de óleo",
    date: "05/12/2024",
    status: "completed",
  },
  {
    id: 2,
    vehicle: "VW Saveiro",
    plate: "DEF-5678",
    type: "Revisão geral",
    date: "08/12/2024",
    status: "pending",
  },
  {
    id: 3,
    vehicle: "Toyota Hilux",
    plate: "GHI-9012",
    type: "Alinhamento",
    date: "01/12/2024",
    status: "overdue",
  },
  {
    id: 4,
    vehicle: "Ford Ranger",
    plate: "JKL-3456",
    type: "Troca de pneus",
    date: "10/12/2024",
    status: "pending",
  },
];

const statusConfig = {
  completed: {
    icon: CheckCircle,
    label: "Concluída",
    className: "status-available",
  },
  pending: {
    icon: Wrench,
    label: "Pendente",
    className: "status-maintenance",
  },
  overdue: {
    icon: AlertCircle,
    label: "Atrasada",
    className: "status-in-use",
  },
};

export function RecentMaintenance() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          Manutenções Recentes
        </h3>
        <p className="text-sm text-muted-foreground">
          Últimas atividades de manutenção
        </p>
      </div>
      <div className="space-y-4">
        {maintenanceData.map((item) => {
          const status = statusConfig[item.status];
          const StatusIcon = status.icon;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wrench className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.vehicle}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.plate} • {item.type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{item.date}</span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                    status.className
                  )}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
