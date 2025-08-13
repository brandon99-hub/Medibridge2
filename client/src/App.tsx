import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { Web3Provider } from "@/hooks/use-web3";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminProtectedRoute } from "./lib/admin-protected-route"; // Import AdminProtectedRoute
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import PatientPortal from "@/pages/patient-portal";
import Web3PatientDashboard from "@/components/web3-patient-dashboard";

import AdminDashboard from "@/components/admin-dashboard"; // Import AdminDashboard
import EmergencyAccessPage from "@/pages/emergency-access-page"; // Import EmergencyAccessPage
import EmergencyAccessDashboard from "@/components/emergency-access-dashboard"; // Import EmergencyAccessDashboard
import AcceptInvitation from "@/pages/accept-invitation"; // Import AcceptInvitation
import VerifierPage from "@/pages/verifier";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <AdminProtectedRoute path="/admin" component={AdminDashboard} />
      <ProtectedRoute path="/emergency-access" component={EmergencyAccessPage} /> {/* Add emergency access route */}
      <ProtectedRoute path="/emergency-dashboard" component={EmergencyAccessDashboard} /> {/* Add emergency dashboard route */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/accept-invitation" component={() => (<AcceptInvitation /> as unknown as JSX.Element)} /> {/* Legacy query param support */}
      <Route path="/accept-invitation/:token" component={AcceptInvitation} /> {/* Path-based token support */}
      <Route path="/patient-portal" component={PatientPortal} />
      <Route path="/web3-patient" component={Web3PatientDashboard} />
      <Route path="/verifier" component={VerifierPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Web3Provider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </Web3Provider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
