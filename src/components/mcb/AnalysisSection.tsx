import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { confirmAnalysis, createProfileAnalysis, listAnalyses } from "@/lib/mcb/ai.functions";
import type { AnalysisOutput } from "@/lib/mcb/ai-prompt";
import { Button } from "@/components/ui/button";

type Props = {
  tenantId: string;
  influencerId: string;
  readOnly: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Em andamento",
  CONCLUIDA: "Concluída",
  ERRO: "Falhou",
};

const CONFIANCA_LABEL: Record<string, string> = {
  ALTA: "Confiança alta",
  MEDIA: "Confiança média",
  BAIXA: "Confiança baixa",
};

/** O output vem do banco como Json. Só renderiza o que de fato veio no formato. */
function asAnalysis(value: unknown): AnalysisOutput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AnalysisOutput>;
  return typeof candidate.resumo === "string" ? (candidate as AnalysisOutput) : null;
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 grid gap-1 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="text-muted-foreground">—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisSection({ tenantId, influencerId, readOnly }: Props) {
  const queryClient = useQueryClient();

  const fetchAnalyses = useServerFn(listAnalyses);
  const runAnalysis = useServerFn(createProfileAnalysis);
  const accept = useServerFn(confirmAnalysis);

  const queryKey = ["mcb", "analyses", tenantId, influencerId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAnalyses({ data: { tenantId, influencerId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const guard = () => {
    if (readOnly) {
      toast.error("Ambiente de demonstração: as alterações não são salvas.");
      return false;
    }
    return true;
  };

  const runMutation = useMutation({
    mutationFn: () => runAnalysis({ data: { tenantId, influencerId } }),
    onSuccess: (result) => {
      if (result.status === "ERRO") {
        toast.error("A análise falhou. O motivo ficou registrado no histórico.");
      } else {
        toast.success("Análise concluída. Revise antes de aceitar.");
      }
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível gerar a análise."),
  });

  const acceptMutation = useMutation({
    mutationFn: (analysisId: string) => accept({ data: { tenantId, analysisId } }),
    onSuccess: () => {
      toast.success("Análise aceita.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível aceitar a análise."),
  });

  const analyses = query.data?.analyses ?? [];

  return (
    <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl">Análise por IA</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={readOnly || runMutation.isPending}
          onClick={() => {
            if (!guard()) return;
            runMutation.mutate();
          }}
        >
          {runMutation.isPending ? "Analisando..." : "Gerar análise"}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        A IA lê apenas os dados da candidata e as evidências que uma pessoa já confirmou. A leitura
        não decide qualificação e não vale enquanto alguém não aceitar.
      </p>
      {runMutation.isPending ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Pode levar algum tempo — a análise roda no servidor e não é interrompida se você sair
          desta tela.
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando análises...</p>
      ) : analyses.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhuma análise gerada até agora.</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {analyses.map((analysis) => {
            const output = asAnalysis(analysis.output);
            return (
              <li key={analysis.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {STATUS_LABEL[analysis.status] ?? analysis.status}
                    {analysis.confirmed ? " · aceita" : ""}
                  </span>
                  <span>
                    {analysis.model} · prompt {analysis.prompt_version} ·{" "}
                    {new Date(analysis.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>

                {analysis.status === "ERRO" ? (
                  <p className="mt-2 text-sm text-destructive">
                    {analysis.error ?? "Falha sem detalhe registrado."}
                  </p>
                ) : output ? (
                  <>
                    <p className="mt-3 text-sm">{output.resumo}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {CONFIANCA_LABEL[output.confianca] ?? output.confianca}
                    </p>
                    <List title="Pontos fortes" items={output.pontos_fortes ?? []} />
                    <List title="Lacunas" items={output.lacunas ?? []} />
                    <List title="Próximos passos" items={output.proximos_passos ?? []} />
                    <List title="Dados faltantes" items={output.dados_faltantes ?? []} />

                    {!analysis.confirmed ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        disabled={readOnly || acceptMutation.isPending}
                        onClick={() => {
                          if (!guard()) return;
                          acceptMutation.mutate(analysis.id);
                        }}
                      >
                        Aceitar esta leitura
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Análise em andamento ou sem resultado legível.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
