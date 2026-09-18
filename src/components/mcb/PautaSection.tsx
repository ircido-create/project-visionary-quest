import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { gerarPauta, listarPautas } from "@/lib/mcb/pautas.functions";
import { SECOES, pautaEmTexto, type Pauta } from "@/lib/mcb/pautas";

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 14, rotulo: "14 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
] as const;

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Pauta de reunião sugerida por IA. Na página da afiliada fala do caso dela; no painel,
 * da equipe. A gestora revisa antes de usar: a pauta é rascunho, não decisão.
 */
export function PautaSection({
  tenantId,
  influencerId = null,
  readOnly,
  className = "",
}: {
  tenantId: string;
  influencerId?: string | null;
  readOnly: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const gerar = useServerFn(gerarPauta);
  const listar = useServerFn(listarPautas);
  const [dias, setDias] = useState<(typeof PERIODOS)[number]["dias"]>(30);

  const chave = ["mcb", "pautas", tenantId, influencerId ?? "equipe"];
  const consulta = useQuery({
    queryKey: chave,
    queryFn: () => listar({ data: { tenantId, influencerId } }),
  });

  const geracao = useMutation({
    mutationFn: () => gerar({ data: { tenantId, influencerId, dias } }),
    onSuccess: () => {
      toast.success("Pauta gerada. Revise antes de usar na reunião.");
      queryClient.invalidateQueries({ queryKey: chave });
    },
    onError: (erro: Error) => {
      toast.error(erro.message);
      queryClient.invalidateQueries({ queryKey: chave });
    },
  });

  const titulo = influencerId ? "Pauta da reunião individual" : "Pauta da reunião de equipe";
  const pautas = consulta.data ?? [];

  const copiar = async (pauta: Pauta, quando: string) => {
    try {
      await navigator.clipboard.writeText(pautaEmTexto(pauta, `${titulo} — ${dataHora(quando)}`));
      toast.success("Pauta copiada.");
    } catch {
      toast.error("Não foi possível copiar. Verifique a permissão do navegador.");
    }
  };

  return (
    <section className={`glass rounded-xl border border-border/60 p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">{titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rascunho a partir dos dados do período. Revise antes da conversa: a IA não decide nada.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Período
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={dias}
              onChange={(e) => setDias(Number(e.target.value) as typeof dias)}
            >
              {PERIODOS.map((p) => (
                <option key={p.dias} value={p.dias}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            onClick={() => geracao.mutate()}
            disabled={readOnly || geracao.isPending}
          >
            {geracao.isPending ? "Preparando…" : "Gerar pauta"}
          </Button>
        </div>
      </div>

      {consulta.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando pautas...</p>
      ) : pautas.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma pauta ainda. Gere a primeira quando for preparar a reunião.
        </p>
      ) : (
        <div className="mt-5 grid gap-4">
          {pautas.map((registro) => (
            <article key={registro.id} className="rounded-lg border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">{dataHora(registro.created_at)}</strong>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {registro.status === "CONCLUIDA"
                      ? "Pronta para revisão"
                      : registro.status === "ERRO"
                        ? "Falhou"
                        : "Em preparo"}
                  </span>
                  {registro.output ? (
                    <button
                      type="button"
                      className="text-xs underline underline-offset-4"
                      onClick={() => void copiar(registro.output!, registro.created_at)}
                    >
                      Copiar
                    </button>
                  ) : null}
                </div>
              </div>

              {registro.output ? (
                <div className="mt-3 grid gap-3 text-sm">
                  <p>{registro.output.resumo_executivo}</p>
                  {SECOES.map((secao) => {
                    const itens = registro.output?.[secao.chave] ?? [];
                    if (itens.length === 0) return null;
                    return (
                      <div key={secao.chave}>
                        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                          {secao.titulo}
                        </h3>
                        <ul className="mt-1 grid list-disc gap-1 pl-5">
                          {itens.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : registro.error ? (
                <p className="mt-2 text-sm text-destructive">{registro.error}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
