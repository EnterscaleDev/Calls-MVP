"use client";

// Mock authentication only — this phase has no real backend. It exists so
// the admin/agent shells have a genuine gate to redirect through, matching
// the shape a real Supabase Auth check will take later.

import { useEffect, useState } from "react";

const ADMIN_KEY = "calls-ops-admin-session";
const AGENT_KEY = "calls-ops-agent-session";

export interface AdminSession {
  name: string;
}
export interface AgentSession {
  agentId: string;
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setAdminSession(session: AdminSession) {
  window.sessionStorage.setItem(ADMIN_KEY, JSON.stringify(session));
}
export function clearAdminSession() {
  window.sessionStorage.removeItem(ADMIN_KEY);
}
export function setAgentSession(session: AgentSession) {
  window.sessionStorage.setItem(AGENT_KEY, JSON.stringify(session));
}
export function clearAgentSession() {
  window.sessionStorage.removeItem(AGENT_KEY);
}

export function useAdminSession() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AdminSession | null>(null);
  useEffect(() => {
    setSession(read<AdminSession>(ADMIN_KEY));
    setReady(true);
  }, []);
  return { ready, session };
}

export function useAgentSession() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AgentSession | null>(null);
  useEffect(() => {
    setSession(read<AgentSession>(AGENT_KEY));
    setReady(true);
  }, []);
  return { ready, session };
}
