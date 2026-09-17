import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { GraficoSeguidores } from "@/components/mcb/GraficoSeguidores";
import { Crescimento, SeloSituacao } from "@/components/onbio/AcompanhamentoSeguidores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INTERVALOS_HORAS, ROTULO_FONTE } from "@/lib/onbio/seguidores";
import {
  atualizarSeguidoresAgora,
  desconectarInstagramPelaGestora,
  getHistoricoSeguidores,
  registrarSeguidoresManual,
} from "@/lib/onbio/seguidores.functions";

const numero = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));
const dataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/** Seguidores de uma afiliada ONBIO: situação, atualização, número manual e histórico. */
export function SeguidoresDaAfiliada({
  tenantId,
  influencerId,
  instagram,
  readOnly,
}: {
  tenantId: string;
  influencerId: string;
  instagram: string | null;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const buscar = useServerFn(getHistoricoSeguidores);
  const atualizar = useServerFn(atualizarSeguidoresAgora);
  const informar = useServerFn(registrarSeguidoresManual);
  const desconectar = useServerFn(desconectarInstagramPelaGestora);
  const [manual, setManual] = useState({ seguidores: "", posts: "" });

  const consulta = useQuery({
    queryKey: ["onbio", "historico", tenantId, influencerId],
    queryFn: () => buscar({ data: { tenantId, influencerId } }),
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["onbio", "historico", tenantId, influencerId] });
    queryClient.invalidateQueries({ queryKey: ["onbio", "seguidores", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["mcb", "influencer", tenantId, influencerId] });
    queryClient.invalidateQueries({ queryKey: ["mcb", "influencers", tenantId] });
  };

  const atualizacao = useMutation({
    mutationFn: () => atualizar({ data: { tenantId, influencerId } }),
    onSuccess: (r) => {
      toast.success(`Seguidores atualizados: ${numero(r.seguidores)}.`);
      invalidar();
    },
    onError: (erro: Error) => {
      toast.error(erro.message);
      invalidar();
    },
  });

  const registro = useMutation({
    mutationFn: () =>
      informar({
        data: {
          tenantId,
          influencerId,
          followers: Number(manual.seguidores),
          postsCount: manual.posts === "" ? null : Number(manual.posts),
        },
      }),
    onSuccess: () => {
      setManual({ seguidores: "", posts: "" });
      toast.success("Número informado registrado no histórico.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const remocao = useMutation({
    mutationFn: () => desconectar({ data: { tenantId, influencerId } }),
    onSuccess: () => {
      toast.success("Instagram desconectado. O token foi apagado.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const dados = consulta.data;
  const atual = dados?.historico[0] ?? null;
  const intervalo = INTERVALOS_HORAS.find(
    (i) => i.horas === dados?.intervaloHoras,
  )?.rotulo.toLowerCase();

  return (
    <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Seguidores no Instagram</h2>
          <p className="text-sm text-muted-foreground">
            {instagram ? `@${instagram.replace(/^@/, "")}` : "Sem @ cadastrado"}
          </p>
        </div>
        {dados ? <SeloSituacao situacao={dados.situacao} /> : null}
      </div>

      {consulta.isLoading || !dados ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando histórico...</p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Seguidores atuais</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {numero(atual?.atual ?? null)}
              </p>
              <p
                className={`text-xs ${atual?.fonte === "META_API" ? "text-primary" : "text-muted-foreground"}`}
              >
                {atual ? ROTULO_FONTE[atual.fonte] : "Sem dados ainda"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Desde o registro anterior</p>
              <p className="mt-2 text-lg">
                <Crescimento
                  valor={atual?.absoluta ?? null}
                  percentual={atual?.percentual ?? null}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Última atualização</p>
              <p className="mt-2 text-sm">{dataHora(atual?.data)}</p>
              {dados.conexao ? (
                <p className="text-xs text-muted-foreground">Consulta automática {intervalo}</p>
              ) : null}
            </div>
          </div>

          {dados.conexao?.ultimoErro ? (
            <p className="mt-4 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              Última consulta em {dataHora(dados.conexao.ultimaConsulta)} falhou:{" "}
              {dados.conexao.ultimoErro}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {dados.conexao ? (
              <>
                <Button
                  size="sm"
                  onClick={() => atualizacao.mutate()}
                  disabled={readOnly || atualizacao.isPending}
                >
                  {atualizacao.isPending ? "Atualizando…" : "Atualizar seguidores"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={readOnly || remocao.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Desconectar o Instagram desta afiliada? A consulta automática para e o token é apagado.",
                      )
                    ) {
                      remocao.mutate();
                    }
                  }}
                >
                  Desconectar Instagram
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Para a consulta automática, a afiliada autoriza a própria conta profissional em “Seu
                acompanhamento”. Use “Copiar acesso da afiliada” para enviar o link.
              </p>
            )}
          </div>

          <form
            className="mt-5 grid items-end gap-3 rounded-lg border border-border/60 p-4 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (readOnly) return;
              registro.mutate();
            }}
          >
            <p className="text-xs text-muted-foreground sm:col-span-3">
              Informar manualmente
              {dados.conexao ? " (fica marcado como manual, não como consulta da Meta)" : ""}
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="manual-seguidores">Seguidores</Label>
              <Input
                id="manual-seguidores"
                type="number"
                min={0}
                required
                inputMode="numeric"
                value={manual.seguidores}
                onChange={(e) => setManual((m) => ({ ...m, seguidores: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="manual-posts">Posts (opcional)</Label>
              <Input
                id="manual-posts"
                type="number"
                min={0}
                inputMode="numeric"
                value={manual.posts}
                onChange={(e) => setManual((m) => ({ ...m, posts: e.target.value }))}
              />
            </div>
            <Button type="submit" variant="outline" disabled={readOnly || registro.isPending}>
              Registrar
            </Button>
          </form>

          {dados.grafico.length > 1 ? (
            <div className="mt-5">
              <p className="text-xs text-muted-foreground">Evolução dos seguidores</p>
              <GraficoSeguidores pontos={dados.grafico} />
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Histórico de crescimento
            </h3>
            {dados.historico.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum registro ainda.</p>
            ) : (
              <table className="mt-2 w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Data da consulta</th>
                    <th className="py-2 pr-3 text-right">Anterior</th>
                    <th className="py-2 pr-3 text-right">Atual</th>
                    <th className="py-2 pr-3">Variação</th>
                    <th className="py-2">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.historico.map((h) => (
                    <tr key={h.data} className="border-t border-border/60">
                      <td className="py-2 pr-3 whitespace-nowrap">{dataHora(h.data)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{numero(h.anterior)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{numero(h.atual)}</td>
                      <td className="py-2 pr-3">
                        <Crescimento valor={h.absoluta} percentual={h.percentual} />
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {ROTULO_FONTE[h.fonte]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
