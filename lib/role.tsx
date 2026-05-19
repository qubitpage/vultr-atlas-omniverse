"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "demo" | null;

const RoleCtx = createContext<Role>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  useEffect(() => {
    fetch("/api/auth/whoami")
      .then((r) => (r.ok ? r.json() : { role: null }))
      .then((j) => setRole(j.role ?? null))
      .catch(() => setRole(null));
  }, []);
  return <RoleCtx.Provider value={role}>{children}</RoleCtx.Provider>;
}

export function useRole(): Role {
  return useContext(RoleCtx);
}

export function useIsDemo(): boolean {
  return useRole() === "demo";
}
