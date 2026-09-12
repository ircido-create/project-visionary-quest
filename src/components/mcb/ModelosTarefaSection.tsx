/**
 * Fase 5 — Biblioteca de modelos de tarefa, em Configurações.
 *
 * Uma lista por nível da jornada. Na página da candidata, os modelos do nível em que ela
 * está aparecem como sugestão (`SugestoesTarefa.tsx`). As regras estão em
 * `modelosTarefa.ts`; quem pode editar é conferido no servidor.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONJUNTO_INICIAL,
  NIVEIS,
  NIVEL_INICIAL,
  PRAZO_MAXIMO_DIAS,
  PRIORIDADE_LABELS,
  chaveModelosTarefa,
  descreverPrazo,
  type ModeloTarefa,
  type Prioridade,
} from "@/lib/mcb/modelosTarefa";
import {
  carregarConjuntoInicial,
  listarModelosTarefa,
  removerModeloTarefa,
  salvarModeloTarefa,
} from "@/lib/mcb/modelosTarefa.functions";

type Formulario = {
  id: string | null;
  level: string;
  title: string;
  description: string;
  dueInDays: string;
  priority: Prioridade;
};

const VAZIO: Formulario = {
  id: null,
  level: NIVEL_INICIAL,
  title: "",
  description: "",
  dueInDays: "7",
  priority: "MEDIA",
};

const paraFormulario = (m: ModeloTarefa): Formulario => ({
  id: m.id,
  level: m.level,
  title: m.title,
  description: m.description ?? "",
  dueInDays: m.due_in_days === null ? "" : String(m.due_in_days),
  priority: m.priority,
});

export function ModelosTarefaSection({
  tenantId,
  readOnly,
}: {
  tenantId: string;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarModelosTarefa);
  const salvar = useServerFn(salvarModeloTarefa);
  const remover = useServerFn(removerModeloTarefa);
  const carregar = useServerFn(carregarConjuntoInicial);
  const [form, setForm] = useState<Formulario>(VAZIO);

  const consulta = useQuery({
    queryKey: chaveModelosTarefa(tenantId),
    queryFn: () => listar({ data: { tenantId } }),
  });
  const atualizar = () => queryClient.invalidateQueries({ queryKey: chaveModelosTarefa(tenantId) });

  const salvarMutacao = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          tenantId,
          id: form.id ?? undefined,
          level: form.level,
          title: form.title,
          description: form.description,
          dueInDays: form.dueInDays === "" ? null : Number(form.dueInDays),
          priority: form.priority,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Modelo atualizado." : "Modelo criado.");
      // Mantém o nível escolhido: o normal é cadastrar vários do mesmo nível em sequência.
      setForm({ ...VAZIO, level: form.level });
      atualizar();
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível salvar o modelo."),
  });

  const removerMutacao = useMutation({
    mutationFn: (id: string) => remover({ data: { tenantId, id } }),
    onSuccess: () => {
      toast.success("Modelo removido.");
      atualizar();
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível remover o modelo."),
  });

  const carregarMutacao = useMutation({
    mutationFn: () => carregar({ data: { tenantId } }),
    onSuccess: (r) => {
      toast.success(`${r.criados} modelo(s) adicionados à biblioteca.`);
      atualizar();
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível carregar o conjunto."),
  });

  const modelos = consulta.data?.modelos ?? [];
  const podeEditar = consulta.data?.podeEditar === true && !readOnly;
  const editando = form.id !== null;

  return (
    <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-2">
      <h2 className="font-serif text-xl">Modelos de tarefa</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        As tarefas de cada nível da jornada. Na página da candidata, as do nível em que ela está
        aparecem como sugestão, e você escolhe quais criar.
      </p>

      {podeEditar ? (
        <form
          className="mt-4 grid gap-3 rounded-lg border border-border/60 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            salvarMutacao.mutate();
          }}
        >
          <p className="text-sm font-medium sm:col-span-2">
            {editando ? "Editar modelo" : "Novo modelo"}
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="modelo-nivel">Nível</Label>
            <select
              id="modelo-nivel"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.level}
              onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value }))}
            >
              {NIVEIS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="modelo-titulo">Tarefa</Label>
            <Input
              id="modelo-titulo"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
              minLength={3}
              maxLength={160}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="modelo-descricao">Orientação para a candidata (opcional)</Label>
            <Textarea
              id="modelo-descricao"
              rows={2}
              maxLength={1000}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="modelo-prazo">Prazo em dias (vazio = sem prazo)</Label>
            <Input
              id="modelo-prazo"
              type="number"
              min={0}
              max={PRAZO_MAXIMO_DIAS}
              value={form.dueInDays}
              onChange={(e) => setForm((prev) => ({ ...prev, dueInDays: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="modelo-prioridade">Prioridade</Label>
            <select
              id="modelo-prioridade"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.priority}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, priority: e.target.value as Prioridade }))
              }
            >
              {(Object.keys(PRIORIDADE_LABELS) as Prioridade[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORIDADE_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={salvarMutacao.isPending}>
              {editando ? "Salvar alterações" : "Adicionar modelo"}
            </Button>
            {editando ? (
              <Button type="button" variant="outline" onClick={() => setForm(VAZIO)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      ) : consulta.data ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {readOnly
            ? "Ambiente de demonstração: os modelos não podem ser alterados."
            : "Só a dona ou a administradora do ambiente edita os modelos."}
        </p>
      ) : null}

      {podeEditar && consulta.data && modelos.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm">
          <p>
            A biblioteca está vazia. Você pode começar pelo conjunto inicial do método —{" "}
            {CONJUNTO_INICIAL.length} tarefas distribuídas nos cinco níveis — e ajustar depois.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={carregarMutacao.isPending}
            onClick={() => carregarMutacao.mutate()}
          >
            Carregar conjunto inicial
          </Button>
        </div>
      ) : null}

      {consulta.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando modelos…</p>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {NIVEIS.map((n) => {
            const doNivel = modelos.filter((m) => m.level === n);
            return (
              <div key={n}>
                <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  {n} · {doNivel.length}
                </h3>
                {doNivel.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum modelo.</p>
                ) : (
                  <ul className="mt-2 grid gap-2 text-sm">
                    {doNivel.map((m) => (
                      <li key={m.id} className="rounded-lg border border-border/60 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium">{m.title}</p>
                          {podeEditar ? (
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setForm(paraFormulario(m));
                                  // Leva a pessoa até o formulário, que fica no topo da seção.
                                  document.getElementById("modelo-titulo")?.focus();
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={removerMutacao.isPending}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Remover o modelo "${m.title}"? As tarefas já criadas a partir dele continuam.`,
                                    )
                                  )
                                    return;
                                  removerMutacao.mutate(m.id);
                                }}
                              >
                                Remover
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {descreverPrazo(m.due_in_days)} · prioridade{" "}
                          {PRIORIDADE_LABELS[m.priority].toLowerCase()}
                        </p>
                        {m.description ? (
                          <p className="mt-1 text-muted-foreground">{m.description}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
