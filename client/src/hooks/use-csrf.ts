import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

/**
 * CSRF Token Management Hook
 * Automatically fetches and manages CSRF tokens for API requests
 * Prevents multiple simultaneous token fetches and consolidates token handling
 */
export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent multiple simultaneous token fetches
  const fetchingRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  // Fetch CSRF token on mount
  useEffect(() => {
    fetchCsrfToken();
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchCsrfToken = async (): Promise<void> => {
    // If already fetching, return the existing promise
    if (fetchingRef.current) {
      return fetchingRef.current;
    }

    // Create new fetch promise
    fetchingRef.current = (async () => {
      try {
        if (!mountedRef.current) return;
        
        setIsLoading(true);
        setError(null);
        
        // Use fetch directly with credentials to ensure cookies are handled properly
        const response = await fetch('/api/csrf-token', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.csrfToken && mountedRef.current) {
          setCsrfToken(data.csrfToken);
          console.debug('[CSRF] Token fetched successfully');
        } else {
          throw new Error('Invalid CSRF token response');
        }
      } catch (err: any) {
        console.error('[CSRF] Token fetch error:', err);
        if (mountedRef.current) {
          setError(err.message || 'Failed to fetch CSRF token');
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
        fetchingRef.current = null; // Reset fetch promise
      }
    })();

    return fetchingRef.current;
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
  const apiRequestWithCsrf = async (method: string, url: string, data?: any): Promise<Response> => {
    // Always ensure we have a CSRF token before making a state-changing request
    if (!csrfToken && method !== 'GET') {
      await fetchCsrfToken();
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only include token in header (not in body) for consistency
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
      console.debug('[CSRF] Sending token in header only');
    }

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    // Don't include CSRF token in body to avoid conflicts
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
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
        console.debug('[CSRF] Token invalid, refreshing and retrying...');
        await refreshToken();
        
        // Only retry once to prevent infinite loops
        const retryHeaders = { ...headers };
        if (csrfToken) {
          retryHeaders['x-csrf-token'] = csrfToken;
        }
        
        return fetch(url, {
          ...options,
          headers: retryHeaders,
        });
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