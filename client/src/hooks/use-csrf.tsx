import { useState, useEffect } from 'react';
import React from 'react';
import { apiRequest } from '../lib/queryClient';

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
      
      // Use fetch directly with credentials to ensure cookies are handled properly
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      
      // Try to get token from response body first
      if (data.success && data.csrfToken) {
        setCsrfToken(data.csrfToken);
        return;
      }
      
      // If not in response body, try to get from cookie
      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrftoken='));
      
      if (csrfCookie) {
        const token = csrfCookie.split('=')[1];
        if (token) {
          setCsrfToken(token);
          return;
        }
      }
      
      // If still no token, check if the request was successful and try to parse from response
      if (data.success) {
        // The backend might have set the cookie but not returned it in body
        // Try to get it from the response headers or wait a moment and check cookies again
        setTimeout(() => {
          const cookiesAfterDelay = document.cookie.split(';');
          const csrfCookieAfterDelay = cookiesAfterDelay.find(cookie => cookie.trim().startsWith('csrftoken='));
          if (csrfCookieAfterDelay) {
            const tokenAfterDelay = csrfCookieAfterDelay.split('=')[1];
            if (tokenAfterDelay) {
              setCsrfToken(tokenAfterDelay);
            }
          }
        }, 100);
        return;
      }
      
      throw new Error('Failed to get CSRF token');
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
    console.debug(`[CSRF] Making ${method} request to ${url} with token: ${csrfToken ? 'present' : 'missing'}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include', // Include cookies in the request
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data); // Don't include csrfToken in body
    }

    const response = await fetch(url, options);
    
    // If CSRF token is invalid, refresh and retry once
    if (response.status === 403) {
      const errorData = await response.json();
      if (errorData.code === 'CSRF_VIOLATION') {
        console.debug('[CSRF] Token invalid, refreshing and retrying...');
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