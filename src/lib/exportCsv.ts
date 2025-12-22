export interface CsvColumn {
  key: string;
  header: string;
  format?: (value: any, row: any) => string;
}

export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns: CsvColumn[]
) {
  if (data.length === 0) {
    return;
  }

  // Create header row
  const headers = columns.map((col) => col.header);

  // Create data rows
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      if (col.format) {
        return formatCsvValue(col.format(value, row));
      }
      return formatCsvValue(value);
    })
  );

  // Combine headers and rows
  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.join(";")),
  ].join("\n");

  // Add BOM for UTF-8 encoding (Excel compatibility)
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

  // Create download link
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Escape double quotes and wrap in quotes if contains special characters
  if (stringValue.includes(";") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("pt-BR");
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleString("pt-BR");
  } catch {
    return dateString;
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function formatBoolean(value: boolean | null | undefined, trueLabel = "Sim", falseLabel = "Não"): string {
  if (value === null || value === undefined) return "";
  return value ? trueLabel : falseLabel;
}
