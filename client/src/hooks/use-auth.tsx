import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrf } from "@/hooks/use-csrf";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser & { hospitalName: string; hospitalType: string }>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { apiRequestWithCsrf, refreshToken } = useCsrf();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequestWithCsrf("POST", "/api/login", credentials);
      let data;
      try {
        data = await res.clone().json();
      } catch (err) {
        // If response is not JSON, fallback to text
        data = { message: await res.clone().text() };
      }
      if (!res.ok) {
        // If CSRF error, show a clear message
        if (res.status === 403 && data && data.message && data.message.toLowerCase().includes('csrf')) {
          throw new Error("Invalid or missing CSRF token. Please refresh the page and try again.");
        }
        throw new Error(data.message || "Login failed");
      }
      return data;
    },
    onSuccess: async (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      await refreshToken();
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.hospitalName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser & { hospitalName: string; hospitalType: string }) => {
      const res = await apiRequestWithCsrf("POST", "/api/register", credentials);
      let data;
      try {
        data = await res.clone().json();
      } catch (err) {
        data = { message: await res.clone().text() };
      }
      if (!res.ok) {
        if (res.status === 403 && data && data.message && data.message.toLowerCase().includes('csrf')) {
          throw new Error("Invalid or missing CSRF token. Please refresh the page and try again.");
        }
        throw new Error(data.message || "Registration failed");
      }
      return data;
    },
    onSuccess: async (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      await refreshToken();
      toast({
        title: "Hospital Registered",
        description: `Welcome to MediBridge! Your hospital has been registered successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/logout');
      await apiRequestWithCsrf("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
