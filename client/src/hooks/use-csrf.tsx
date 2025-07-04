import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

/**
 * CSRF Token Management Hook
 * Automatically fetches and manages CSRF tokens for API requests
 */
export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch CSRF token on mount
  useEffect(() => {
    fetchCsrfToken();
  }, []);

  const fetchCsrfToken = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest('GET', '/api/csrf-token');
      const data = await response.json();
      
      if (data.success && data.csrfToken) {
        setCsrfToken(data.csrfToken);
      } else {
        throw new Error('Failed to get CSRF token');
      }
    } catch (err: any) {
      console.error('CSRF token fetch error:', err);
      setError(err.message || 'Failed to fetch CSRF token');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh CSRF token
  const refreshToken = () => {
    return fetchCsrfToken();
  };

  // Get headers with CSRF token
  const getCsrfHeaders = () => {
    if (!csrfToken) {
      return {};
    }
    
    return {
      'x-csrf-token': csrfToken,
    };
  };

  // Enhanced API request with CSRF token
  const apiRequestWithCsrf = async (method: string, url: string, data?: any) => {
    const headers = {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify({
        ...data,
        csrfToken, // Include token in body as well
      });
    }

    const response = await fetch(url, options);
    
    // If CSRF token is invalid, refresh and retry once
    if (response.status === 403) {
      const errorData = await response.json();
      if (errorData.code === 'CSRF_VIOLATION') {
        await refreshToken();
        // Retry the request with new token
        return apiRequestWithCsrf(method, url, data);
      }
    }

    return response;
  };

  return {
    csrfToken,
    isLoading,
    error,
    refreshToken,
    getCsrfHeaders,
    apiRequestWithCsrf,
  };
}

/**
 * CSRF Token Provider Component
 * Provides CSRF token context to child components
 */
export function CsrfProvider({ children }: { children: React.ReactNode }) {
  const csrf = useCsrf();

  return (
    <div>
      {csrf.isLoading ? (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-slate-600">Loading security tokens...</div>
        </div>
      ) : csrf.error ? (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-red-600">
            Security error: {csrf.error}
            <button 
              onClick={csrf.refreshToken}
              className="ml-2 text-blue-600 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>{children}</>
      )}
    </div>
  );
} 