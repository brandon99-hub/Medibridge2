import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, RouteProps } from "wouter";
import NotFound from "@/pages/not-found"; // Or a specific "Forbidden" component

interface AdminProtectedRouteProps extends Omit<RouteProps, 'component'> {
  component: React.ComponentType<any>;
}

export function AdminProtectedRoute({ component: Component, ...rest }: AdminProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      // Using path from ...rest if provided, or a generic loader display
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    // Not authenticated, redirect to login
    return <Redirect to="/auth" />;
  }

  if (user.isAdmin !== true) {
    // Authenticated but not an admin, show forbidden/not found or redirect to home
    // Using NotFound for simplicity, but a dedicated "403 Forbidden" page would be better.
    return <Route {...rest} component={NotFound} />;
    // Or redirect to home: return <Redirect to="/" />;
  }

  // User is authenticated and is an admin, render the component
  return <Route {...rest} component={Component} />;
}
