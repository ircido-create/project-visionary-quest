import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getWorkspaces } from "@/lib/mcb/app.functions";

const STORAGE_KEY = "mcb.activeTenant";

export function useWorkspace() {
  const fetchWorkspaces = useServerFn(getWorkspaces);
  // A lista de ambientes não muda sozinha durante a sessão, e os dois pontos que a
  // mudam (criar e renomear ambiente) chamam `refetch()` logo depois — que ignora o
  // staleTime. Sem isto, esta consulta era refeita a cada navegação, em toda página,
  // porque o hook vive no AppShell.
  const query = useQuery({
    queryKey: ["mcb", "workspaces"],
    queryFn: () => fetchWorkspaces(),
    staleTime: Infinity,
  });
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
