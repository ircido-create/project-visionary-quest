/**
 * Fase 10 — Em Configurações, só para a dona: baixar todos os dados e excluir o ambiente
 * de vez, com o nome digitado de novo.
 */

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmacaoDoAmbienteConfere, resumoDaExclusaoDoAmbiente } from "@/lib/mcb/encerramento";
import { excluirAmbiente, exportarTudo } from "@/lib/mcb/encerramento.functions";

function baixar(nomeDoArquivo: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeDoArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export function EncerrarAmbienteSection({
  tenantId,
  nome,
  onExcluido,
}: {
  tenantId: string;
  nome: string;
  onExcluido: () => void;
}) {
  const exportar = useServerFn(exportarTudo);
  const excluir = useServerFn(excluirAmbiente);
  const [confirmacao, setConfirmacao] = useState("");

  const exportacao = useMutation({
    mutationFn: () => exportar({ data: { tenantId } }),
    onSuccess: (resultado) => {
      baixar(resultado.nomeDoArquivo, resultado.conteudo);
      toast.success("Dados baixados. O arquivo tem dados pessoais: guarde com cuidado.");
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível baixar os dados."),
  });

  const exclusao = useMutation({
    mutationFn: () => excluir({ data: { tenantId, confirmacao } }),
    onSuccess: (resultado) => {
      toast.success(`Ambiente excluído: ${resumoDaExclusaoDoAmbiente(resultado.contagem)}.`);
      setConfirmacao("");
      onExcluido();
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível excluir o ambiente."),
  });

  const confere = confirmacaoDoAmbienteConfere(confirmacao, nome);

  return (
    <section className="glass rounded-xl border border-destructive/40 p-6">
      <h2 className="font-serif text-xl">Encerrar o ambiente</h2>

      <div className="mt-3">
        <p className="text-sm text-muted-foreground">
          Baixe um arquivo com todos os dados do ambiente: candidatas, inscrições, tarefas, notas,
          feedbacks, números, avaliações, histórico, consentimentos e pagamentos. Os prints
          continuam na página de cada candidata.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={exportacao.isPending}
          onClick={() => exportacao.mutate()}
        >
          {exportacao.isPending ? "Preparando..." : "Baixar todos os dados"}
        </Button>
      </div>

      <form
        className="mt-6 border-t border-border/60 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!confere) return;
          if (!window.confirm(`Excluir "${nome}" de vez? Não dá para desfazer.`)) return;
          exclusao.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Excluir apaga de vez as candidatas, os prints, a página de candidatura, a equipe e o
          histórico deste ambiente. As contas de acesso das pessoas continuam existindo, e a
          exclusão não desfaz cobranças já pagas. Baixe os dados antes.
        </p>
        <label className="mt-3 block text-xs text-muted-foreground" htmlFor="confirmar-exclusao">
          Para confirmar, digite o nome do ambiente: <strong>{nome}</strong>
        </label>
        <Input
          id="confirmar-exclusao"
          className="mt-1 max-w-sm"
          value={confirmacao}
          autoComplete="off"
          onChange={(event) => setConfirmacao(event.target.value)}
        />
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          className="mt-3"
          disabled={!confere || exclusao.isPending}
        >
          {exclusao.isPending ? "Excluindo..." : "Excluir o ambiente de vez"}
        </Button>
      </form>
    </section>
  );
}
