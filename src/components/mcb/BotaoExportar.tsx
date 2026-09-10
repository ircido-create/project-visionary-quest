import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { baixarCsv, gerarCsv } from "@/lib/mcb/csv";
import { Button } from "@/components/ui/button";

type Exportacao = {
  nomeDoArquivo: string;
  cabecalho: string[];
  linhas: unknown[][];
};

/**
 * Pede os dados ao servidor e baixa o CSV.
 *
 * A montagem do arquivo acontece aqui, no navegador, porque o download depende de uma
 * URL temporária que só existe nele. O servidor decide **o que** exportar; o navegador,
 * só como entregar.
 */
export function BotaoExportar({
  rotulo,
  buscar,
  desabilitado,
}: {
  rotulo: string;
  buscar: () => Promise<Exportacao>;
  desabilitado?: boolean;
}) {
  const mutation = useMutation({
    mutationFn: buscar,
    onSuccess: (dados) => {
      if (dados.linhas.length === 0) {
        toast.error("Não há nada para exportar ainda.");
        return;
      }
      baixarCsv(dados.nomeDoArquivo, gerarCsv(dados.cabecalho, dados.linhas));
      toast.success(`${dados.linhas.length} registro(s) exportado(s).`);
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível exportar."),
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={desabilitado || mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? "Preparando..." : rotulo}
    </Button>
  );
}
