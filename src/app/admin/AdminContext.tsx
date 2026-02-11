"use client";

import { createContext, useContext } from "react";

interface AdminContextValue {
  expertId: string;
  expertName: string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AdminContextValue;
}) {
  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return ctx;
}
