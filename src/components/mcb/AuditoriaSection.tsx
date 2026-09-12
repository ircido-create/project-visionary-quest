/**
 * Fase 5 — Seção "Auditoria" da página da candidata.
 *
 * Aparece quando a candidata está em "Pronta para auditoria", ou quando já houve alguma
 * decisão — o histórico continua visível depois que ela avança. As regras da decisão
 * estão em `auditoria.ts`; quem pode decidir é conferido no servidor.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ETAPA_DEVOLUCAO_PADRAO,
  ETAPA_EM_AUDITORIA,
  ETAPAS_DE_DEVOLUCAO,
  NOTA_MINIMA,
  REGISTRO_LABELS,
  requisitosPendentes,
  type DecisaoAuditoria,
} from "@/lib/mcb/auditoria";
import {
  decidirAuditoria,
  listarDecisoesAuditoria,
  podeAuditar,
} from "@/lib/mcb/auditoria.functions";
import { STATUS_LABELS, type InfluencerStatus } from "@/lib/mcb/labels";
import type { RequirementResult } from "@/lib/mcb/qualification";

const SITUACAO: Record<string, { texto: string; tom: string }> = {
  PASS: { texto: "Cumprido", tom: "text-primary" },
  FAIL: { texto: "Não cumprido", tom: "text-destructive" },
  UNKNOWN: { texto: "Sem dado", tom: "text-muted-foreground" },
  REVIEW: { texto: "Em revisão", tom: "text-muted-foreground" },
};

const ORIGEM: Record<string, string> = {
  MANUAL: "manual",
  SCREENSHOT: "print",
  META_API: "Instagram",
  INTERNAL: "sistema",
};

const valor = (v: string | number | null) =>
  v === null ? "—" : typeof v === "number" ? v.toLocaleString("pt-BR") : v;

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function AuditoriaSection({
  tenantId,
  influencerId,
  status,
  requisitos,
  readOnly,
}: {
  tenantId: string;
  influencerId: string;
  status: InfluencerStatus;
  requisitos: RequirementResult[];
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const verificarPermissao = useServerFn(podeAuditar);
  const buscarDecisoes = useServerFn(listarDecisoesAuditoria);
  const decidir = useServerFn(decidirAuditoria);

  const [decisao, setDecisao] = useState<DecisaoAuditoria>("APROVAR");
  const [nota, setNota] = useState("");
  const [etapa, setEtapa] = useState<InfluencerStatus>(ETAPA_DEVOLUCAO_PADRAO);

  const chaveDecisoes = ["mcb", "auditoria", tenantId, influencerId];

  const permissao = useQuery({
    queryKey: ["mcb", "pode-auditar", tenantId],
    queryFn: () => verificarPermissao({ data: { tenantId } }),
    // O papel da pessoa no ambiente não muda enquanto ela navega.
    staleTime: Infinity,
  });

  const decisoes = useQuery({
    queryKey: chaveDecisoes,
    queryFn: () => buscarDecisoes({ data: { tenantId, influencerId } }),
  });

  const mutacao = useMutation({
    mutationFn: () =>
      decidir({
        data: {
          tenantId,
          influencerId,
          decisao,
          nota,
          etapaDevolucao: decisao === "DEVOLVER" ? etapa : undefined,
        },
      }),
    onSuccess: (r) => {
      setNota("");
      toast.success(
        `Auditoria registrada: ${REGISTRO_LABELS[r.registro]}. Etapa agora: ${r.proximaEtapaLabel}.`,
      );
      // A decisão muda a etapa, a fila do painel e, na devolução, as tarefas.
      queryClient.invalidateQueries({ queryKey: chaveDecisoes });
      queryClient.invalidateQueries({ queryKey: ["mcb", "influencer", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["mcb", "influencers", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["mcb", "dashboard", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["mcb", "tasks", tenantId] });
    },
    // A mensagem do servidor é a que explica a recusa.
    onError: (erro: Error) => toast.error(erro.message),
  });

  const emAuditoria = status === ETAPA_EM_AUDITORIA;
  const historico = decisoes.data ?? [];
  if (!emAuditoria && historico.length === 0) return null;

  const pendentes = requisitosPendentes(requisitos);
  const podeDecidir = permissao.data?.pode === true && !readOnly;
  const precisaNota = decisao === "DEVOLVER" || pendentes.length > 0;

  return (
    <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-3">
      <h2 className="font-serif text-xl">Auditoria</h2>

      {emAuditoria ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Confira cada requisito antes de a candidata seguir para a análise oficial. As evidências
            que embasam os números estão na seção de evidências desta página.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-normal">Requisito</th>
                  <th className="py-2 pr-4 font-normal">Atual</th>
                  <th className="py-2 pr-4 font-normal">Meta</th>
                  <th className="py-2 pr-4 font-normal">Situação</th>
                  <th className="py-2 font-normal">Origem do dado</th>
                </tr>
              </thead>
              <tbody>
                {requisitos.map((r) => {
                  const s = SITUACAO[r.status] ?? { texto: r.status, tom: "" };
                  return (
                    <tr key={r.key} className="border-t border-border/60">
                      <td className="py-2 pr-4">{r.label}</td>
                      <td className="py-2 pr-4">{valor(r.currentValue)}</td>
                      <td className="py-2 pr-4">{r.targetLabel}</td>
                      <td className={`py-2 pr-4 ${s.tom}`}>{s.texto}</td>
                      <td className="py-2 text-muted-foreground">{ORIGEM[r.source] ?? r.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pendentes.length > 0 ? (
            <p className="mt-3 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {pendentes.length} requisito(s) sem cumprir ou sem dado. Aprovar mesmo assim exige
              justificativa, registrada como exceção.
            </p>
          ) : null}

          {podeDecidir ? (
            <form
              className="mt-5 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutacao.mutate();
              }}
            >
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Decisão</legend>
                {/* aria-labelledby aponta para o próprio texto visível: o nome lido pelo leitor
                    de tela é o que está escrito. A regra de lint não enxerga o label em volta. */}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="decisao"
                    checked={decisao === "APROVAR"}
                    onChange={() => setDecisao("APROVAR")}
                    aria-labelledby="auditoria-opcao-aprovar"
                  />
                  <span id="auditoria-opcao-aprovar">
                    Aprovar — segue para &ldquo;{STATUS_LABELS.QUALIFICADA}&rdquo;
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="decisao"
                    checked={decisao === "DEVOLVER"}
                    onChange={() => setDecisao("DEVOLVER")}
                    aria-labelledby="auditoria-opcao-devolver"
                  />
                  <span id="auditoria-opcao-devolver">
                    Devolver — volta para uma etapa anterior, com tarefa do que falta
                  </span>
                </label>
              </fieldset>

              {decisao === "DEVOLVER" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="auditoria-etapa">Voltar para</Label>
                  <select
                    id="auditoria-etapa"
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={etapa}
                    onChange={(e) => setEtapa(e.target.value as InfluencerStatus)}
                  >
                    {ETAPAS_DE_DEVOLUCAO.map((e) => (
                      <option key={e} value={e}>
                        {STATUS_LABELS[e]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="auditoria-nota">
                  {decisao === "DEVOLVER"
                    ? "Motivo da devolução (vira a tarefa da candidata)"
                    : pendentes.length > 0
                      ? "Justificativa da exceção"
                      : "Observação (opcional)"}
                </Label>
                <Textarea
                  id="auditoria-nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                {precisaNota ? (
                  <p className="text-xs text-muted-foreground">
                    Obrigatório, com pelo menos {NOTA_MINIMA} caracteres.
                  </p>
                ) : null}
              </div>

              <div>
                <Button type="submit" disabled={mutacao.isPending}>
                  {mutacao.isPending
                    ? "Registrando…"
                    : decisao === "APROVAR"
                      ? "Registrar aprovação"
                      : "Registrar devolução"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {readOnly
                ? "Ambiente de demonstração: a decisão não é registrada."
                : "Só a dona ou a administradora do ambiente decide a auditoria."}
            </p>
          )}
        </>
      ) : null}

      {historico.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Decisões anteriores
          </h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {historico.map((d) => (
              <li key={d.id} className="rounded-lg border border-border/60 p-3">
                <p>
                  <span className="font-medium">{REGISTRO_LABELS[d.registro] ?? d.registro}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {dataHora(d.quando)}
                    {d.quem ? ` · ${d.quem}` : ""}
                  </span>
                </p>
                {d.nota ? <p className="mt-1 text-muted-foreground">{d.nota}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
