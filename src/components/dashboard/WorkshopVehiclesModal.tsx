import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Car, Wrench } from "lucide-react";

interface WorkshopVehiclesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkshopVehiclesModal({
  open,
  onOpenChange,
}: WorkshopVehiclesModalProps) {
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["workshop_vehicles_modal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          id,
          plate,
          model,
          status,
          team_id,
          teams (name)
        `)
        .in("status", ["manutencao", "oficina"]);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: workshopEntries } = useQuery({
    queryKey: ["workshop_entries_modal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshop_entries")
        .select("vehicle_id, reason, entry_date, status")
        .is("exit_date", null);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getWorkshopInfo = (vehicleId: string) => {
    return workshopEntries?.find((entry) => entry.vehicle_id === vehicleId);
  };

  const statusLabels: Record<string, string> = {
    manutencao: "Manutenção",
    oficina: "Oficina",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Veículos em Manutenção/Oficina
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : vehicles && vehicles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Entrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => {
                const workshopInfo = getWorkshopInfo(vehicle.id);
                return (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        {vehicle.plate}
                      </div>
                    </TableCell>
                    <TableCell>{vehicle.model}</TableCell>
                    <TableCell>
                      {vehicle.teams?.name || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          vehicle.status === "oficina" ? "destructive" : "secondary"
                        }
                      >
                        {statusLabels[vehicle.status] || vehicle.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {workshopInfo?.reason || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {workshopInfo?.entry_date ? (
                        format(new Date(workshopInfo.entry_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum veículo em manutenção ou oficina no momento.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}