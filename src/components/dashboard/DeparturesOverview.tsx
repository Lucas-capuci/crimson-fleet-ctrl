import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

interface DepartureRecord {
  id: string;
  departed: boolean;
  departure_time: string | null;
  no_departure_reason: string | null;
  teams: { name: string } | null;
  supervisorName: string;
}

export function DeparturesOverview() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: departures = [], isLoading } = useQuery({
    queryKey: ["dashboard_departures", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departures")
        .select("id, departed, departure_time, no_departure_reason, supervisor_id, teams(name)")
        .eq("date", today)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      
      // Fetch supervisor names separately
      const supervisorIds = [...new Set(data.map(d => d.supervisor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", supervisorIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      
      return data.map(d => ({
        id: d.id,
        departed: d.departed,
        departure_time: d.departure_time,
        no_departure_reason: d.no_departure_reason,
        teams: d.teams,
        supervisorName: profilesMap.get(d.supervisor_id) || "-"
      })) as DepartureRecord[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard_departures_stats", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departures")
        .select("departed")
        .eq("date", today);
      if (error) throw error;
      
      const total = data.length;
      const departed = data.filter(d => d.departed).length;
      const notDeparted = total - departed;
      
      return { total, departed, notDeparted };
    },
  });

  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">
          Saídas de Hoje - {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
        </CardTitle>
        {stats && stats.total > 0 && (
          <div className="flex gap-3 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              {stats.departed}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-4 w-4" />
              {stats.notDeparted}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : departures.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhum lançamento registrado hoje.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipe</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Horário/Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departures.map((dep) => (
                <TableRow key={dep.id}>
                  <TableCell className="font-medium">{dep.teams?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{dep.supervisorName}</TableCell>
                  <TableCell>
                    {dep.departed ? (
                      <Badge variant="default" className="bg-green-600 text-xs">
                        Saiu
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Não Saiu
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dep.departed ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dep.departure_time}
                      </span>
                    ) : (
                      <span className="truncate max-w-32">{dep.no_departure_reason || "-"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}