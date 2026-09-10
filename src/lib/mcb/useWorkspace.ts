import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getWorkspaces } from "@/lib/mcb/app.functions";

const STORAGE_KEY = "mcb.activeTenant";

export function useWorkspace() {
  const fetchWorkspaces = useServerFn(getWorkspaces);
  const query = useQuery({ queryKey: ["mcb", "workspaces"], queryFn: () => fetchWorkspaces() });
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    setStored(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const tenants = query.data?.tenants ?? [];
  const active = useMemo(() => {
    if (tenants.length === 0) return null;
    return tenants.find((t) => t.id === stored) ?? tenants[0]!;
  }, [tenants, stored]);

  const setActive = useCallback((tenantId: string) => {
    window.localStorage.setItem(STORAGE_KEY, tenantId);
    setStored(tenantId);
  }, []);

  return {
    isLoading: query.isLoading,
    error: query.error,
    profile: query.data?.profile ?? null,
    tenants,
    active,
    tenantId: active?.id ?? null,
    readOnly: active?.readOnly ?? false,
    /** Ambiente suspenso pela administração: leitura continua, escrita não. */
    suspenso: (active as { status?: string } | null)?.status === "SUSPENDED",
    setActive,
    refetch: query.refetch,
  };
}
