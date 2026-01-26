import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import FleetManagement from "./pages/FleetManagement";
import Teams from "./pages/Teams";
import Departures from "./pages/Departures";
import Schedule from "./pages/Schedule";
import Admin from "./pages/Admin";
import Production from "./pages/Production";
import Budget from "./pages/Budget";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/frotas" element={<ProtectedRoute><FleetManagement /></ProtectedRoute>} />
            <Route path="/equipes" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
            <Route path="/escala" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/saida" element={<ProtectedRoute><Departures /></ProtectedRoute>} />
            <Route path="/producao" element={<ProtectedRoute><Production /></ProtectedRoute>} />
            <Route path="/orcamento" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
