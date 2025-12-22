import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCsv, CsvColumn } from "@/lib/exportCsv";
import { toast } from "@/hooks/use-toast";

interface ExportButtonProps<T extends Record<string, any>> {
  data: T[];
  filename: string;
  columns: CsvColumn[];
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

export function ExportButton<T extends Record<string, any>>({
  data,
  filename,
  columns,
  variant = "outline",
  size = "sm",
  className,
  label = "Exportar CSV",
}: ExportButtonProps<T>) {
  const handleExport = () => {
    if (data.length === 0) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há registros disponíveis para exportação.",
        variant: "destructive",
      });
      return;
    }

    exportToCsv(data, filename, columns);
    toast({
      title: "Exportação concluída",
      description: `${data.length} registro(s) exportado(s) com sucesso.`,
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      className={className}
    >
      <Download className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}
