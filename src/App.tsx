import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppModeProvider } from "@/contexts/AppModeContext";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Runner from "./pages/Runner";
import Infra from "./pages/Infra";
import Platform from "./pages/Platform";
import SupabaseSetup from "./pages/SupabaseSetup";
import Deployer from "./pages/Deployer";
import DeployerWizard from "./pages/DeployerWizard";
import Gateway from "./pages/Gateway";
import Observability from "./pages/Observability";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppModeProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/*"
                element={
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/runner" element={<Runner />} />
                      <Route path="/infra" element={<Infra />} />
                      <Route path="/platform" element={<Platform />} />
                      <Route path="/platform/supabase" element={<SupabaseSetup />} />
                      <Route path="/deployer" element={<Deployer />} />
                      <Route path="/deployer/new" element={<DeployerWizard />} />
                      <Route path="/gateway" element={<Gateway />} />
                      <Route path="/observability" element={<Observability />} />
                      {/* Redirects for old routes */}
                      <Route path="/live" element={<Navigate to="/observability" replace />} />
                      <Route path="/activity" element={<Navigate to="/observability" replace />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                }
              />
            </Routes>
          </BrowserRouter>
        </AppModeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
