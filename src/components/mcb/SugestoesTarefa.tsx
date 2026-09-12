/**
 * Fase 5 — Tarefas sugeridas para o nível da candidata, dentro da seção "Tarefas".
 *
 * Mostra os modelos do nível em que ela está e que ela ainda não tem. Vêm todos marcados;
 * a gestora desmarca o que não servir e confirma. Nada é criado sem esse clique.
 */

import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  chaveModelosTarefa,
  descreverPrazo,
  sugestoesParaNivel,
  type TarefaExistente,
} from "@/lib/mcb/modelosTarefa";
import { criarTarefasDeModelos, listarModelosTarefa } from "@/lib/mcb/modelosTarefa.functions";

export function SugestoesTarefa({
  tenantId,
  influencerId,
  nivel,
  tarefas,
  readOnly,
}: {
  tenantId: string;
  influencerId: string;
  nivel: string;
  tarefas: TarefaExistente[];
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarModelosTarefa);
  const criar = useServerFn(criarTarefasDeModelos);
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());

  const consulta = useQuery({
    queryKey: chaveModelosTarefa(tenantId),
    queryFn: () => listar({ data: { tenantId } }),
    // A biblioteca muda pouco; editar em Configurações invalida esta chave.
    staleTime: 60_000,
  });

  const sugestoes = sugestoesParaNivel(nivel, consulta.data?.modelos ?? [], tarefas);
  const escolhidos = sugestoes.filter((m) => !desmarcados.has(m.id));

  const mutacao = useMutation({
    mutationFn: () =>
      criar({ data: { tenantId, influencerId, modeloIds: escolhidos.map((m) => m.id) } }),
    onSuccess: (r) => {
      toast.success(r.criadas === 1 ? "1 tarefa criada." : `${r.criadas} tarefas criadas.`);
      setDesmarcados(new Set());
      queryClient.invalidateQueries({ queryKey: ["mcb", "influencer", tenantId, influencerId] });
      queryClient.invalidateQueries({ queryKey: ["mcb", "tasks", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["mcb", "dashboard", tenantId] });
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível criar as tarefas."),
  });

  if (!consulta.data) return null;

  if (consulta.data.modelos.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Tarefas prontas para cada nível podem ser cadastradas em{" "}
        <Link to="/configuracoes" className="underline underline-offset-4">
          Configurações
        </Link>
        .
      </p>
    );
  }

  if (sugestoes.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
      <p className="text-sm font-medium">Sugeridas para {nivel}</p>
      <p className="text-xs text-muted-foreground">
        Do modelo deste nível, as que ela ainda não tem. Desmarque o que não servir.
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {sugestoes.map((m) => (
          <li key={m.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              aria-label={`Incluir tarefa: ${m.title}`}
              checked={!desmarcados.has(m.id)}
              onChange={(e) =>
                setDesmarcados((prev) => {
                  const proximo = new Set(prev);
                  if (e.target.checked) proximo.delete(m.id);
                  else proximo.add(m.id);
                  return proximo;
                })
              }
            />
            <span>
              {m.title}
              <span className="ml-1 text-xs text-muted-foreground">
                ({descreverPrazo(m.due_in_days)})
              </span>
            </span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3"
        disabled={escolhidos.length === 0 || mutacao.isPending}
        onClick={() => {
          if (readOnly) {
            toast.error("Ambiente de demonstração: as alterações não são salvas.");
            return;
          }
          mutacao.mutate();
        }}
      >
        {mutacao.isPending
          ? "Criando…"
          : escolhidos.length === 1
            ? "Criar 1 tarefa"
            : `Criar ${escolhidos.length} tarefas`}
      </Button>
    </div>
  );
}
