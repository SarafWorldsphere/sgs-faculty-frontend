"use client";

/**
 * Dashboard Layout — Shell with Sidebar + Header
 *
 * Wraps all /dashboard/* pages with the navigation chrome.
 * Redirects unauthenticated users to the login page.
 */

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LOGIN_URL } from "@/lib/api";
import { NotesProvider } from "@/context/NotesContext";
import { ToastProvider } from "@/components/ui/Toast";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

function DashboardShell({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The guard this effect was always meant to hold. It was left empty, so
  // opening /dashboard with no token rendered the whole shell to anyone —
  // the API returns nothing without a token, so no data leaked, but the app
  // was reachable and there was no way back to the login page.
  //
  // window.location, not router.push: the login portal is a different
  // application on another path, and the Next router only moves within this one.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = LOGIN_URL;
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-lighter">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <NotesProvider>
        <ToastProvider>
          <DashboardShell>{children}</DashboardShell>
        </ToastProvider>
      </NotesProvider>
    </AuthProvider>
  );
}
