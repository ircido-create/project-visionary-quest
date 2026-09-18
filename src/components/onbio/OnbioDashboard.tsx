import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell, StatCard } from "@/components/mcb/AppShell";
import { PautaSection } from "@/components/mcb/PautaSection";
import { AcompanhamentoSeguidores } from "@/components/onbio/AcompanhamentoSeguidores";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/mcb/useWorkspace";
import { getOnbioDashboard } from "@/lib/onbio/onbio.functions";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function OnbioDashboard({ tenantId }: { tenantId: string }) {
  const { readOnly } = useWorkspace();
  const fetchDashboard = useServerFn(getOnbioDashboard);
  const query = useQuery({
    queryKey: ["onbio", "dashboard", tenantId],
    queryFn: () => fetchDashboard({ data: { tenantId } }),
  });
  return (
    <AppShell
      title="Visão geral ONBIO"
      description="Afiliadas, resultados e prioridades comerciais em um só lugar."
      actions={
        <Button asChild>
          <Link to="/candidatas">Gerenciar afiliadas</Link>
        </Button>
      }
    >
      {query.isLoading || !query.data ? (
        <p className="text-sm text-muted-foreground">Carregando indicadores...</p>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Afiliadas" value={query.data.affiliates} />
            <StatCard label="Faturamento" value={money(query.data.revenue)} tone="positive" />
            <StatCard label="Pedidos" value={query.data.orders} />
            <StatCard label="Comissões" value={money(query.data.commission)} />
            <StatCard
              label="Tarefas atrasadas"
              value={query.data.lateTasks}
              tone={query.data.lateTasks ? "warning" : "default"}
            />
          </div>
          <AcompanhamentoSeguidores tenantId={tenantId} readOnly={readOnly} modo="painel" />
          <PautaSection tenantId={tenantId} readOnly={readOnly} />
          <section className="glass rounded-xl border border-border/60 p-6">
            <h2 className="text-xl font-semibold">Resultados recentes</h2>
            {query.data.latest.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Afiliada</th>
                      <th>Período</th>
                      <th>Faturamento</th>
                      <th>Pedidos</th>
                      <th>Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.latest.map((row) => (
                      <tr
                        key={`${row.influencer_id}-${row.period_end}`}
                        className="border-t border-border/60"
                      >
                        <td className="py-3">
                          <Link
                            to="/candidatas/$id"
                            params={{ id: row.influencer_id }}
                            className="font-medium hover:underline"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td>
                          {new Date(`${row.period_end}T12:00:00`).toLocaleDateString("pt-BR")}
                        </td>
                        <td>{money(row.revenue_cents)}</td>
                        <td>{row.orders}</td>
                        <td>{money(row.commission_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Cadastre o primeiro resultado no perfil de uma afiliada.
              </p>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
