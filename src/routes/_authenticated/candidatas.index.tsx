import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/mcb/AppShell";
import { BotaoExportar } from "@/components/mcb/BotaoExportar";
import { listInfluencers } from "@/lib/mcb/app.functions";
import { exportarCandidatas } from "@/lib/mcb/export.functions";
import { useWorkspace } from "@/lib/mcb/useWorkspace";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/mcb/labels";
import { QUALIFICATION_LABELS } from "@/lib/mcb/qualification";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/candidatas/")({
  head: () => ({
    meta: [
      { title: "Candidatas — MCB" },
      { name: "description", content: "Lista de candidatas com status, nível e progresso." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CandidatesPage,
});

function CandidatesPage() {
  const { tenantId } = useWorkspace();
  const fetchList = useServerFn(listInfluencers);
  const exportar = useServerFn(exportarCandidatas);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("TODOS");
  const [view, setView] = useState<"lista" | "pipeline">("lista");

  const query = useQuery({
    queryKey: ["mcb", "influencers", tenantId],
    queryFn: () => fetchList({ data: { tenantId: tenantId! } }),
    enabled: Boolean(tenantId),
  });

  const rows = useMemo(() => {
    const list = query.data ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((row) => {
      const matchesTerm =
        term.length === 0 ||
        row.fullName.toLowerCase().includes(term) ||
        (row.instagramHandle ?? "").toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term);
      const matchesStatus = status === "TODOS" || row.status === status;
      return matchesTerm && matchesStatus;
    });
  }, [query.data, search, status]);

  return (
    <AppShell
      title="Candidatas"
      description="Filtre, acompanhe e abra o perfil detalhado de cada candidata."
      actions={
        <BotaoExportar
          rotulo="Exportar todas (CSV)"
          desabilitado={!tenantId}
          buscar={() => exportar({ data: { tenantId: tenantId! } })}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Buscar candidata"
          className="max-w-xs"
          placeholder="Buscar por nome, @ ou e-mail"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filtrar por status"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="TODOS">Todos os status</option>
          {STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <div className="ml-auto flex rounded-md border border-border p-1 text-sm">
          {(["lista", "pipeline"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={`rounded px-3 py-1 capitalize ${view === option ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando candidatas...</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Nenhuma candidata encontrada com esses filtros. Compartilhe sua página de candidatura para receber
          novas inscrições.
        </p>
      ) : view === "lista" ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Candidata</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Qualificação</th>
                <th className="px-4 py-3">Seguidores</th>
                <th className="px-4 py-3">Posts</th>
                <th className="px-4 py-3">Público fem.</th>
                <th className="px-4 py-3">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <Link to="/candidatas/$id" params={{ id: row.id }} className="font-medium hover:underline">
                      {row.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">@{row.instagramHandle ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">{STATUS_LABELS[row.status]}</td>
                  <td className="px-4 py-3">{QUALIFICATION_LABELS[row.qualification]}</td>
                  <td className="px-4 py-3">{row.followers ?? "—"}</td>
                  <td className="px-4 py-3">{row.postsCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.femaleAudiencePct === null ? "—" : `${row.femaleAudiencePct}%`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${row.score}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{row.score}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
          {STATUS_ORDER.filter((value) => rows.some((row) => row.status === value)).map((value) => (
            <div key={value} className="min-w-[240px] flex-1 rounded-xl border border-border/60 bg-muted/30 p-4">
              <h2 className="text-sm font-medium">{STATUS_LABELS[value]}</h2>
              <ul className="mt-3 grid gap-2">
                {rows
                  .filter((row) => row.status === value)
                  .map((row) => (
                    <li key={row.id} className="glass rounded-lg border border-border/60 p-3 text-sm">
                      <Link to="/candidatas/$id" params={{ id: row.id }} className="font-medium hover:underline">
                        {row.fullName}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.score}% · {row.pendingRequirements} pendência(s)
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
