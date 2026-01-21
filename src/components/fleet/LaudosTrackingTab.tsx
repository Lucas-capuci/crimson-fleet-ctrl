import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, AlertCircle, Clock, CheckCircle, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VehicleWithLaudos {
  id: string;
  plate: string;
  model: string;
  team_id: string | null;
  laudo_eletrico: string | null;
  laudo_acustico: string | null;
  laudo_liner: string | null;
  laudo_tacografo: string | null;
}

interface Team {
  id: string;
  name: string;
}

type LaudoType = "laudo_eletrico" | "laudo_acustico" | "laudo_liner" | "laudo_tacografo";

const LAUDO_LABELS: Record<LaudoType, string> = {
  laudo_eletrico: "Laudo Elétrico",
  laudo_acustico: "Laudo Acústico",
  laudo_liner: "Laudo Liner",
  laudo_tacografo: "Laudo Tacógrafo",
};

interface LaudoExpiring {
  vehicle: VehicleWithLaudos;
  teamName: string;
  laudoType: LaudoType;
  laudoLabel: string;
  expirationDate: Date;
  daysUntilExpiration: number;
}

export const LaudosTrackingTab = () => {
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery({
    queryKey: ["vehicles_with_laudos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, model, team_id, laudo_eletrico, laudo_acustico, laudo_liner, laudo_tacografo")
        .order("plate");
      if (error) throw error;
      return data as VehicleWithLaudos[];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  const teamsMap = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((t) => {
      map[t.id] = t.name;
    });
    return map;
  }, [teams]);

  const expiringLaudos = useMemo(() => {
    const today = new Date();
    const expiring: LaudoExpiring[] = [];

    vehicles.forEach((vehicle) => {
      const laudoTypes: LaudoType[] = ["laudo_eletrico", "laudo_acustico", "laudo_liner", "laudo_tacografo"];

      laudoTypes.forEach((laudoType) => {
        const laudoDate = vehicle[laudoType];
        if (laudoDate) {
          const expirationDate = new Date(laudoDate);
          const daysUntil = differenceInDays(expirationDate, today);

          // Only include if expiring within 90 days (and not already expired long ago)
          if (daysUntil <= 90 && daysUntil >= -30) {
            expiring.push({
              vehicle,
              teamName: vehicle.team_id ? teamsMap[vehicle.team_id] || "Sem equipe" : "Sem equipe",
              laudoType,
              laudoLabel: LAUDO_LABELS[laudoType],
              expirationDate,
              daysUntilExpiration: daysUntil,
            });
          }
        }
      });
    });

    return expiring.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  }, [vehicles, teamsMap]);

  const clusters = useMemo(() => {
    const expired = expiringLaudos.filter((l) => l.daysUntilExpiration < 0);
    const within30 = expiringLaudos.filter((l) => l.daysUntilExpiration >= 0 && l.daysUntilExpiration <= 30);
    const within60 = expiringLaudos.filter((l) => l.daysUntilExpiration > 30 && l.daysUntilExpiration <= 60);
    const within90 = expiringLaudos.filter((l) => l.daysUntilExpiration > 60 && l.daysUntilExpiration <= 90);

    return { expired, within30, within60, within90 };
  }, [expiringLaudos]);

  const formatDate = (date: Date) => format(date, "dd/MM/yyyy", { locale: ptBR });

  const getStatusBadge = (days: number) => {
    if (days < 0) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Vencido</Badge>;
    }
    if (days <= 30) {
      return <Badge className="bg-red-500/20 text-red-700 gap-1"><AlertTriangle className="h-3 w-3" />Crítico</Badge>;
    }
    if (days <= 60) {
      return <Badge className="bg-orange-500/20 text-orange-700 gap-1"><Clock className="h-3 w-3" />Atenção</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-700 gap-1"><Clock className="h-3 w-3" />Em breve</Badge>;
  };

  const ClusterCard = ({
    title,
    items,
    icon: Icon,
    colorClass,
    borderClass,
  }: {
    title: string;
    items: LaudoExpiring[];
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    borderClass: string;
  }) => (
    <Card className={`${borderClass} border-2`}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-lg ${colorClass}`}>
          <Icon className="h-5 w-5" />
          {title}
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum laudo nesta categoria
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="py-2">Veículo</TableHead>
                  <TableHead className="py-2">Equipe</TableHead>
                  <TableHead className="py-2">Laudo</TableHead>
                  <TableHead className="py-2">Vencimento</TableHead>
                  <TableHead className="py-2 text-right">Dias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={`${item.vehicle.id}-${item.laudoType}-${index}`} className="text-sm">
                    <TableCell className="py-2 font-medium">{item.vehicle.plate}</TableCell>
                    <TableCell className="py-2">{item.teamName}</TableCell>
                    <TableCell className="py-2">{item.laudoLabel}</TableCell>
                    <TableCell className="py-2">{formatDate(item.expirationDate)}</TableCell>
                    <TableCell className="py-2 text-right">
                      {item.daysUntilExpiration < 0 ? (
                        <span className="text-red-600 font-medium">
                          {Math.abs(item.daysUntilExpiration)}d atrás
                        </span>
                      ) : (
                        <span className={item.daysUntilExpiration <= 30 ? "text-red-600 font-medium" : ""}>
                          {item.daysUntilExpiration}d
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoadingVehicles) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  // Summary stats
  const totalVehicles = vehicles.length;
  const vehiclesWithAllLaudos = vehicles.filter(
    (v) => v.laudo_eletrico && v.laudo_acustico && v.laudo_liner && v.laudo_tacografo
  ).length;
  const vehiclesMissingLaudos = vehicles.filter(
    (v) => !v.laudo_eletrico || !v.laudo_acustico || !v.laudo_liner || !v.laudo_tacografo
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Veículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVehicles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Laudos Completos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {vehiclesWithAllLaudos}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Laudos Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              {vehiclesMissingLaudos}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Laudos a Vencer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {expiringLaudos.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {clusters.expired.length > 0 && (
          <ClusterCard
            title="Laudos Vencidos"
            items={clusters.expired}
            icon={AlertCircle}
            colorClass="text-red-700"
            borderClass="border-red-500"
          />
        )}
        <ClusterCard
          title="Vencer em até 30 dias"
          items={clusters.within30}
          icon={AlertTriangle}
          colorClass="text-red-600"
          borderClass="border-red-400"
        />
        <ClusterCard
          title="Vencer em até 60 dias"
          items={clusters.within60}
          icon={Clock}
          colorClass="text-orange-600"
          borderClass="border-orange-400"
        />
        <ClusterCard
          title="Vencer em até 90 dias"
          items={clusters.within90}
          icon={Clock}
          colorClass="text-yellow-600"
          borderClass="border-yellow-400"
        />
      </div>

      {/* Full list if no expiring */}
      {expiringLaudos.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Nenhum laudo próximo do vencimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Todos os laudos cadastrados estão com validade superior a 90 dias ou ainda não foram cadastrados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
