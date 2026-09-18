import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TEXTO_DO_CONSENTIMENTO_DE_VINCULO } from "@/lib/mcb/vinculos";
import { meusVinculosPendentes, responderVinculo } from "@/lib/mcb/vinculos.functions";

/**
 * Aparece no portal quando uma gestora pede para vincular o cadastro da afiliada a outro
 * ambiente. Quem decide é ela: sem resposta, nada é compartilhado.
 */
export function VinculoPendenteCard() {
  const queryClient = useQueryClient();
  const buscar = useServerFn(meusVinculosPendentes);
  const responder = useServerFn(responderVinculo);

  const consulta = useQuery({
    queryKey: ["mcb", "vinculos", "pendentes"],
    queryFn: () => buscar({}),
  });

  const resposta = useMutation({
    mutationFn: (entrada: { vinculoId: string; aceitar: boolean }) => responder({ data: entrada }),
    onSuccess: (_r, entrada) => {
      toast.success(entrada.aceitar ? "Vínculo autorizado." : "Pedido recusado.");
      queryClient.invalidateQueries({ queryKey: ["mcb", "vinculos", "pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["mcb", "portal"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const pendentes = consulta.data ?? [];
  if (pendentes.length === 0) return null;

  return (
    <div className="grid gap-4">
      {pendentes.map((pedido) => (
        <section
          key={pedido.id}
          className="glass rounded-xl border border-accent/50 p-6"
          aria-label="Pedido de vínculo entre ambientes"
        >
          <h2 className="font-serif text-xl">
            {pedido.gestora} quer acompanhar você também em {pedido.ambiente}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{TEXTO_DO_CONSENTIMENTO_DE_VINCULO}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={resposta.isPending}
              onClick={() => resposta.mutate({ vinculoId: pedido.id, aceitar: true })}
            >
              Autorizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={resposta.isPending}
              onClick={() => resposta.mutate({ vinculoId: pedido.id, aceitar: false })}
            >
              Recusar
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Pedido feito em {new Date(pedido.solicitado_em).toLocaleDateString("pt-BR")}. Recusar
            não afeta o seu acompanhamento atual.
          </p>
        </section>
      ))}
    </div>
  );
}
