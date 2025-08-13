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
        console.debug('[CSRF] Token fetched:', data.csrfToken);
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
    // Always ensure we have a CSRF token before making a state-changing request
    if (!csrfToken && method !== 'GET') {
      await fetchCsrfToken();
    }
    const csrfHeaders = getCsrfHeaders();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (csrfHeaders['x-csrf-token']) {
      headers['x-csrf-token'] = csrfHeaders['x-csrf-token'];
      console.debug('[CSRF] Sending token in header:', csrfHeaders['x-csrf-token']);
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      const bodyWithToken = {
        ...data,
        csrfToken: csrfToken || (csrfHeaders['x-csrf-token'] ?? undefined),
      };
      options.body = JSON.stringify(bodyWithToken);
      console.debug('[CSRF] Sending token in body:', bodyWithToken.csrfToken);
    }

    const response = await fetch(url, options);
    // If CSRF token is invalid, refresh and retry once
    if (response.status === 403) {
      let code: string | undefined;
      try {
        // Clone the response so callers can still read the body
        const cloned = response.clone();
        const errorData = await cloned.json();
        code = errorData?.code;
      } catch (_) {
        // Non-JSON error body; ignore
      }
      if (code === 'CSRF_VIOLATION') {
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