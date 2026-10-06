"use client";

/**
 * AuthContext — Mock Authentication Provider
 *
 * Manages login/logout state with localStorage persistence.
 * TODO: Replace with real JWT/session-based auth via FastAPI backend.
 *
 * Expected backend endpoints:
 *   POST /api/auth/login   — returns JWT token + user profile
 *   POST /api/auth/logout  — invalidates the session
 *   GET  /api/auth/me      — returns current user from token
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginTeacher, logoutTeacher } from "@/lib/api";
import { clearActiveClass, getActiveClass, setActiveClass } from "@/lib/activeClass";

const AuthContext = createContext(undefined);

const STORAGE_KEY = "swais_faculty_auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Read in the effect below, not during render: localStorage does not exist on
  // the server, and reading it inline would render one value on the server and
  // another on the client.
  const [activeClassId, setActiveClassId] = useState(null);

  useEffect(() => {
    async function restoreSession() {
      try {
        setActiveClassId(getActiveClass());

        // 1. Check URL for ?token= param (the login app redirects here with token)
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
          localStorage.setItem("swais_faculty_token", urlToken);
          // Clean token from URL without triggering a navigation
          const clean = window.location.pathname;
          window.history.replaceState({}, "", clean);
        }

        // 2. Show the cached profile straight away so the header does not flash
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
          setIsLoading(false);
        }

        // 3. Then refresh it from /api/v1/auth/me. This is not just for sessions
        //    with no cached profile: the profile carries the class list and the
        //    headcount for the selected class, both of which a cached copy can
        //    have stale — a teacher whose classes changed, or a cache written
        //    before the class selector existed.
        const token = localStorage.getItem("swais_faculty_token");
        if (token) {
          const { fetchMe } = await import("@/lib/api");
          const profile = await fetchMe();
          if (profile) {
            setUser(profile);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
            // fetchMe drops a selection the teacher has lost access to, so read
            // it back rather than trusting what we had a moment ago.
            setActiveClassId(getActiveClass());
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("swais_faculty_token");
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  /**
   * Log in with email and password.
   * TODO: Replace with API call — POST /api/auth/login
   */
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginTeacher(email, password);

      if (result.success) {
        setUser(result.user);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.user));
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMsg = "An unexpected error occurred. Please try again.";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Log out the current user — calls backend then clears local state.
   */
  const logout = useCallback(async () => {
    await logoutTeacher(); // clears TOKEN_KEY from localStorage
    setUser(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    // The selection belongs to the teacher who made it — the next person to log
    // in on this browser must not inherit it.
    clearActiveClass();
    setActiveClassId(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Switch the class the teacher is working in.
   *
   * Every page fetches its own data in a mount effect, and the class is read
   * from storage at request time, so a reload is what makes the whole app —
   * dashboard, students, reports, assignments — agree on the new class. Doing
   * it any other way means threading the selection through four pages' effects
   * and their derived state, for a change a teacher makes a few times a day.
   */
  const switchClass = useCallback((classId) => {
    if (getActiveClass() === Number(classId)) return;
    setActiveClass(classId);
    setActiveClassId(Number(classId));
    window.location.reload();
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    clearError,
    classes: user?.classes ?? [],
    // Nothing stored means the primary class, which is what the backend uses
    // when no class_id is sent.
    activeClassId:
      activeClassId ??
      (user?.classes ?? []).find((c) => c.is_primary)?.class_id ??
      null,
    switchClass,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
