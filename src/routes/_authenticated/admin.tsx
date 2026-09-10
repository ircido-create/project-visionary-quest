import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/mcb/AppShell";
import {
  getPlatformOverview,
  setTenantPlan,
  setTenantStatus,
  type AmbienteNaVisaoGeral,
} from "@/lib/mcb/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Administração da plataforma — MCB" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

/** Destaca o que já passou de 80% do limite, que é quando vale conversar sobre plano. */
function Uso({
  atual,
  limite,
  unidade,
}: {
  atual: number;
  limite: number | null;
  unidade?: string;
}) {
  if (limite === null) return <span className="text-muted-foreground">{atual}</span>;
  const proporcao = limite === 0 ? 1 : atual / limite;
  const cor =
    proporcao >= 1 ? "text-destructive" : proporcao >= 0.8 ? "text-primary" : "text-foreground";
  return (
    <span className={cor}>
      {atual} / {limite}
      {unidade ? ` ${unidade}` : ""}
    </span>
  );
}

function Ambiente({
  ambiente,
  planos,
  onTrocarPlano,
  onTrocarStatus,
  ocupado,
}: {
  ambiente: AmbienteNaVisaoGeral;
  planos: Array<{ id: string; nome: string }>;
  onTrocarPlano: (planId: string) => void;
  onTrocarStatus: (status: "ACTIVE" | "SUSPENDED") => void;
  ocupado: boolean;
}) {
  const suspenso = ambiente.status === "SUSPENDED";

  return (
    <li className="glass rounded-xl border border-border/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">
            {ambiente.nome}
            {ambiente.isDemo ? (
              <span className="ml-2 text-xs text-muted-foreground">demonstração</span>
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            /g/{ambiente.slug} · criado em {new Date(ambiente.criadoEm).toLocaleDateString("pt-BR")}
          </p>
        </div>
        {suspenso ? (
          <span className="rounded-full border border-destructive/60 px-3 py-1 text-xs text-destructive">
            Suspenso
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Candidatas</dt>
          <dd className="mt-1">
            <Uso atual={ambiente.uso.candidatas} limite={ambiente.limites?.candidatas ?? null} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Equipe</dt>
          <dd className="mt-1">
            <Uso atual={ambiente.uso.membros} limite={ambiente.limites?.membros ?? null} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Análises no mês</dt>
          <dd className="mt-1">
            <Uso atual={ambiente.uso.analisesNoMes} limite={ambiente.limites?.analises ?? null} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Armazenamento</dt>
          <dd className="mt-1">
            <Uso
              atual={ambiente.uso.armazenamentoMb}
              limite={ambiente.limites?.armazenamentoMb ?? null}
              unidade="MB"
            />
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground" htmlFor={`plano-${ambiente.id}`}>
          Plano
        </label>
        <select
          id={`plano-${ambiente.id}`}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={ambiente.plano?.id ?? ""}
          disabled={ocupado}
          onChange={(event) => {
            if (event.target.value) onTrocarPlano(event.target.value);
          }}
        >
          <option value="" disabled>
            Sem plano
          </option>
          {planos.map((plano) => (
            <option key={plano.id} value={plano.id}>
              {plano.nome}
            </option>
          ))}
        </select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ocupado}
          onClick={() => onTrocarStatus(suspenso ? "ACTIVE" : "SUSPENDED")}
        >
          {suspenso ? "Reativar" : "Suspender"}
        </Button>
      </div>
    </li>
  );
}

function AdminPage() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getPlatformOverview);
  const trocarPlano = useServerFn(setTenantPlan);
  const trocarStatus = useServerFn(setTenantStatus);

  const queryKey = ["mcb", "admin", "overview"];
  const query = useQuery({ queryKey, queryFn: () => fetchOverview() });

  const invalidar = () => queryClient.invalidateQueries({ queryKey });

  const planoMutation = useMutation({
    mutationFn: (input: { tenantId: string; planId: string }) => trocarPlano({ data: input }),
    onSuccess: () => {
      toast.success("Plano atualizado.");
      invalidar();
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível trocar o plano."),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { tenantId: string; status: "ACTIVE" | "SUSPENDED" }) =>
      trocarStatus({ data: input }),
    onSuccess: (_resultado, variaveis) => {
      toast.success(
        variaveis.status === "SUSPENDED"
          ? "Ambiente suspenso. A gestora continua vendo os dados, mas não consegue alterá-los."
          : "Ambiente reativado.",
      );
      invalidar();
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível alterar o status."),
  });

  const ocupado = planoMutation.isPending || statusMutation.isPending;

  if (query.error) {
    return (
      <AppShell title="Administração da plataforma">
        <p className="text-sm text-destructive">{(query.error as Error).message}</p>
      </AppShell>
    );
  }

  const ambientes = query.data?.ambientes ?? [];
  const planos = query.data?.planos ?? [];

  return (
    <AppShell
      title="Administração da plataforma"
      description="Todos os ambientes, o uso de cada um e as ações de plano e suspensão."
    >
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando ambientes...</p>
      ) : (
        <ul className="grid gap-4">
          {ambientes.map((ambiente) => (
            <Ambiente
              key={ambiente.id}
              ambiente={ambiente}
              planos={planos}
              ocupado={ocupado}
              onTrocarPlano={(planId) => planoMutation.mutate({ tenantId: ambiente.id, planId })}
              onTrocarStatus={(status) => statusMutation.mutate({ tenantId: ambiente.id, status })}
            />
          ))}
        </ul>
      )}
    </AppShell>
  );
}
