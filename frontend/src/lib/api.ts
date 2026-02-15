import { supabase } from './supabase';

// Get access token from Supabase session
export async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Synchronous version for backward compatibility (uses cached session)
export function getAuthTokenSync(): string | null {
  // This is a temporary solution for components that need synchronous access
  // Ideally, components should use the async version
  const storageKey = `sb-${import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.access_token ?? null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Legacy function for backward compatibility
export function setAuthToken(_token: string | null) {
  // No longer needed - Supabase handles token storage
  console.warn('setAuthToken is deprecated with Supabase auth. Token is managed automatically.');
}

export async function api<T = unknown>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    skipAuth?: boolean;
  }
): Promise<T> {
  // Get token asynchronously from Supabase
  const token = init?.skipAuth ? null : await getAuthToken();

  // Determine the base URL based on environment
  const isDevelopment = import.meta.env.DEV;
  let baseUrl;

  if (isDevelopment) {
    baseUrl = ''; // Use relative URLs in development (Vite proxy will handle it)
  } else {
    // Production: Use environment variable or explicit fallback
    baseUrl = (import.meta.env.VITE_API_URL || 'https://fox-trading-api-production.up.railway.app').replace(/\/$/, '');
    console.log('Production API URL:', baseUrl); // Debug log
  }

  const fullUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;

  // Only log in development mode to improve performance
  if (import.meta.env.DEV) {
    console.log('API call:', fullUrl, 'Token:', token ? 'Present' : 'Missing');
  }

  const res = await fetch(fullUrl, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (import.meta.env.DEV) {
    console.log('API response status:', res.status, res.statusText);
  }

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      if (import.meta.env.DEV) {
        console.error('API error data:', data);
      }
      // Handle Zod validation errors
      if (data?.error?.fieldErrors || data?.error?.formErrors) {
        const fieldErrors = data.error.fieldErrors || {};
        const formErrors = data.error.formErrors || [];
        message = formErrors[0] || Object.values(fieldErrors)[0]?.[0] || 'Validation failed';
      } else {
        message = data?.error?.message || data?.error || data?.message || message;
      }
    } catch { }
    if (import.meta.env.DEV) {
      console.error('API error:', message);
    }
    throw new Error(message);
  }

  try {
    const data = await res.json();
    if (import.meta.env.DEV) {
      console.log('API response data:', data);
    }
    return data as T;
  } catch (e) {
    // If the response body is empty, return an empty object.
    return {} as T;
  }
}

// Synchronous API function for backward compatibility
export function apiSync<T = unknown>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>
  }
): Promise<T> {
  const token = getAuthTokenSync();

  const isDevelopment = import.meta.env.DEV;
  let baseUrl;

  if (isDevelopment) {
    baseUrl = '';
  } else {
    baseUrl = import.meta.env.VITE_API_URL || 'https://fox-trading-api-2jv8.onrender.com';
  }

  const fullUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;

  return fetch(fullUrl, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  }).then(async (res) => {
    if (!res.ok) {
      let message = 'Request failed';
      try {
        const data = await res.json();
        if (data?.error?.fieldErrors || data?.error?.formErrors) {
          const fieldErrors = data.error.fieldErrors || {};
          const formErrors = data.error.formErrors || [];
          message = formErrors[0] || Object.values(fieldErrors)[0]?.[0] || 'Validation failed';
        } else {
          message = data?.error?.message || data?.error || data?.message || message;
        }
      } catch { }
      throw new Error(message);
    }

    try {
      return await res.json() as T;
    } catch {
      return {} as T;
    }
  });
}
