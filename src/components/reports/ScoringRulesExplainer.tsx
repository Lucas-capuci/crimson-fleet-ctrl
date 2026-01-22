import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, 
  Target, 
  Calculator, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ExamplePerson {
  name: string;
  totalReports: number;
  reports: { name: string; status: "on_time" | "late" | "error" }[];
}

const EXAMPLE_SCENARIOS: ExamplePerson[] = [
  {
    name: "Wander (6 relatórios)",
    totalReports: 6,
    reports: [
      { name: "Relatório 1", status: "on_time" },
      { name: "Relatório 2", status: "on_time" },
      { name: "Relatório 3", status: "on_time" },
      { name: "Relatório 4", status: "on_time" },
      { name: "Relatório 5", status: "on_time" },
      { name: "Relatório 6", status: "on_time" },
    ],
  },
  {
    name: "Maria (4 relatórios)",
    totalReports: 4,
    reports: [
      { name: "Relatório 1", status: "on_time" },
      { name: "Relatório 2", status: "late" },
      { name: "Relatório 3", status: "on_time" },
      { name: "Relatório 4", status: "error" },
    ],
  },
  {
    name: "João (3 relatórios)",
    totalReports: 3,
    reports: [
      { name: "Relatório 1", status: "late" },
      { name: "Relatório 2", status: "error" },
      { name: "Relatório 3", status: "late" },
    ],
  },
];

function calculateNewScore(person: ExamplePerson) {
  const basePoints = 20 / person.totalReports;
  let dailyScore = 0;
  let onTime = 0;
  let late = 0;
  let error = 0;

  person.reports.forEach((report) => {
    if (report.status === "on_time") {
      dailyScore += basePoints;
      onTime++;
    } else if (report.status === "late") {
      dailyScore -= basePoints / 2;
      late++;
    } else {
      dailyScore -= basePoints;
      error++;
    }
  });

  return {
    basePoints: Math.round(basePoints * 100) / 100,
    dailyScore: Math.round(dailyScore * 100) / 100,
    onTime,
    late,
    error,
  };
}

export function ScoringRulesExplainer() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(0);

  const person = EXAMPLE_SCENARIOS[selectedScenario];
  const calculation = calculateNewScore(person);

  const getStatusIcon = (status: "on_time" | "late" | "error") => {
    switch (status) {
      case "on_time":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "late":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusLabel = (status: "on_time" | "late" | "error") => {
    switch (status) {
      case "on_time":
        return "No horário";
      case "late":
        return "Atrasado";
      case "error":
        return "Esqueceu/Erro";
    }
  };

  const getPointsForStatus = (status: "on_time" | "late" | "error", basePoints: number) => {
    switch (status) {
      case "on_time":
        return `+${basePoints.toFixed(2)}`;
      case "late":
        return `−${(basePoints / 2).toFixed(2)}`;
      case "error":
        return `−${basePoints.toFixed(2)}`;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 10) return "text-green-500";
    if (score >= 0) return "text-green-400";
    if (score >= -10) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                Como funciona a pontuação?
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* New Formula Explanation */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-5 w-5 text-primary" />
                <span className="font-semibold">Nova Fórmula Simplificada</span>
              </div>
              <div className="space-y-2 text-sm font-mono bg-background p-3 rounded border">
                <p className="font-bold text-primary">Pontos Base = 20 ÷ Quantidade de Relatórios</p>
                <div className="border-t pt-2 mt-2 space-y-1">
                  <p className="text-green-600">✓ No horário: <strong>+base</strong></p>
                  <p className="text-yellow-600">⏱ Atrasado: <strong>−base/2</strong> (perde metade)</p>
                  <p className="text-red-600">✗ Esqueceu/Erro: <strong>−base</strong> (perde tudo)</p>
                </div>
              </div>
            </div>

            {/* Visual Score Range */}
            <div className="text-center p-4 bg-card rounded-lg border">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <span className="font-bold text-red-500">-20</span>
                </div>
                <div className="flex-1 max-w-xs h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                <div className="flex items-center gap-1">
                  <span className="font-bold text-green-500">+20</span>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Sua pontuação diária sempre estará entre <strong>-20</strong> e <strong>+20</strong>
              </p>
            </div>

            {/* Key Rules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-green-700 dark:text-green-400">Meta</span>
                </div>
                <p className="text-sm">
                  100% no horário = <strong>+20 pts</strong>
                </p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold text-yellow-700 dark:text-yellow-400">Atraso</span>
                </div>
                <p className="text-sm">
                  Perde <strong>metade</strong> dos pontos base
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-700 dark:text-red-400">Erro</span>
                </div>
                <p className="text-sm">
                  Perde <strong>todos</strong> os pontos base
                </p>
              </div>
            </div>

            {/* Interactive Example */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">Exemplo Interativo</span>
              </div>

              {/* Scenario Selector */}
              <div className="flex flex-wrap gap-2 mb-4">
                {EXAMPLE_SCENARIOS.map((s, idx) => (
                  <Button
                    key={s.name}
                    variant={selectedScenario === idx ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedScenario(idx)}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>

              {/* Base Points Calculation */}
              <div className="p-3 mb-4 rounded bg-primary/10 border border-primary/30">
                <p className="text-sm font-medium">
                  📊 Pontos base: <strong>20 ÷ {person.totalReports} = {calculation.basePoints.toFixed(2)} pts</strong> por relatório
                </p>
              </div>

              {/* Scenario Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {person.reports.map((report, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded bg-muted/50"
                    >
                      {getStatusIcon(report.status)}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{report.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {getStatusLabel(report.status)}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          report.status === "on_time" 
                            ? "text-green-600 border-green-300" 
                            : report.status === "late"
                            ? "text-yellow-600 border-yellow-300"
                            : "text-red-600 border-red-300"
                        }`}
                      >
                        {getPointsForStatus(report.status, calculation.basePoints)}
                      </Badge>
                    </div>
                  ))}
                </div>

                {/* Calculation Breakdown */}
                <div className="p-3 rounded bg-muted/30 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-600">✓ No horário ({calculation.onTime}x):</span>
                    <span className="font-mono text-green-600">
                      +{(calculation.basePoints * calculation.onTime).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-600">⏱ Atrasados ({calculation.late}x):</span>
                    <span className="font-mono text-yellow-600">
                      −{((calculation.basePoints / 2) * calculation.late).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-600">✗ Erros ({calculation.error}x):</span>
                    <span className="font-mono text-red-600">
                      −{(calculation.basePoints * calculation.error).toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-base">
                    <span>Pontuação do Dia:</span>
                    <span className={`font-mono ${getScoreColor(calculation.dailyScore)}`}>
                      {calculation.dailyScore > 0 ? "+" : ""}{calculation.dailyScore.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fairness Note */}
            <p className="text-xs text-muted-foreground text-center italic">
              💡 Este sistema é justo porque quem tem mais relatórios ganha menos pontos por cada um,
              mas todos podem alcançar +20 ou -20 no dia.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
