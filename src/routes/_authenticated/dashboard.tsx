import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell, StatCard } from "@/components/mcb/AppShell";
import { getDashboard } from "@/lib/mcb/app.functions";
import { useWorkspace } from "@/lib/mcb/useWorkspace";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Visão geral — MCB" },
      { name: "description", content: "Painel da gestora com candidatas, evolução e pendências." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { tenantId, isLoading, tenants } = useWorkspace();
  const fetchDashboard = useServerFn(getDashboard);
  const query = useQuery({
    queryKey: ["mcb", "dashboard", tenantId],
    queryFn: () => fetchDashboard({ data: { tenantId: tenantId! } }),
    enabled: Boolean(tenantId),
  });

  if (!isLoading && tenants.length === 0) {
    return (
      <AppShell title="Bem-vinda ao MCB" description="Crie seu ambiente para começar a receber candidaturas.">
        <Button asChild>
          <Link to="/configuracoes">Criar meu ambiente</Link>
        </Button>
      </AppShell>
    );
  }

  const data = query.data;

  return (
    <AppShell
      title="Visão geral"
      description="Onde cada candidata está e o que precisa de atenção hoje."
      actions={
        <Button asChild variant="outline">
          <Link to="/candidatas">Ver candidatas</Link>
        </Button>
      }
    >
      {query.isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Carregando indicadores...</p>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Candidatas" value={data.totals.candidates} hint="total no ambiente" />
            <StatCard label="Novas (14 dias)" value={data.totals.newApplications} />
            <StatCard label="Qualificadas" value={data.totals.qualified} tone="positive" hint="todos os critérios atendidos" />
            <StatCard label="Em desenvolvimento" value={data.totals.developing} />
            <StatCard label="Aguardando dados" value={data.totals.waitingData} hint="pendência de comprovação" />
            <StatCard label="Prontas para auditoria" value={data.totals.readyForAudit} />
            <StatCard label="Tarefas atrasadas" value={data.totals.lateTasks} tone={data.totals.lateTasks > 0 ? "warning" : "default"} />
            <StatCard label="Crescimento médio" value={`${data.totals.averageGrowth > 0 ? "+" : ""}${data.totals.averageGrowth}`} hint="seguidores desde a entrada" />
          </div>

          <section className="glass rounded-xl border border-border/60 p-6">
            <h2 className="font-serif text-xl">Funil da jornada</h2>
            <div className="mt-4 grid gap-3">
              {data.funnel.map((step) => {
                const max = Math.max(...data.funnel.map((s) => s.value), 1);
                return (
                  <div key={step.key} className="grid gap-1">
                    <div className="flex justify-between text-sm">
                      <span>{step.label}</span>
                      <span className="text-muted-foreground">{step.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(step.value / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="glass rounded-xl border border-border/60 p-6">
              <h2 className="font-serif text-xl">Perto da meta</h2>
              {data.nearGoal.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nenhuma candidata em desenvolvimento agora.</p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {data.nearGoal.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link
                        to="/candidatas/$id"
                        params={{ id: item.id }}
                        className="underline-offset-4 hover:underline"
                      >
                        {item.name}
                      </Link>
                      <span className="text-muted-foreground">
                        {item.score}% · {item.pending} pendência(s)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass rounded-xl border border-border/60 p-6">
              <h2 className="font-serif text-xl">Aguardando auditoria</h2>
              {data.awaitingAudit.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nenhuma candidata esperando auditoria.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 text-sm">
                  {data.awaitingAudit.map((item) => (
                    <li key={item.id}>
                      <Link
                        to="/candidatas/$id"
                        params={{ id: item.id }}
                        className="underline-offset-4 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass rounded-xl border border-border/60 p-6">
              <h2 className="font-serif text-xl">Tarefas atrasadas</h2>
              {data.lateTasks.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nada atrasado. Ótimo trabalho.</p>
              ) : (
                <ul className="mt-4 grid gap-3 text-sm">
                  {data.lateTasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-3">
                      <span>{task.title}</span>
                      <span className="text-destructive">{task.dueDate}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" className="mt-5">
                <Link to="/tarefas">Abrir tarefas</Link>
              </Button>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
