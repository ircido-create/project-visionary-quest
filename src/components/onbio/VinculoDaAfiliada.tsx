import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SITUACAO_DO_VINCULO } from "@/lib/mcb/vinculos";
import { desfazerVinculo, pedirVinculo, situacaoDoVinculo } from "@/lib/mcb/vinculos.functions";

/**
 * Vínculo desta afiliada com o cadastro dela em outro ambiente. A gestora pede; quem
 * autoriza é a afiliada, no portal dela. Aqui só se vê o andamento.
 */
export function VinculoDaAfiliada({
  tenantId,
  influencerId,
  email,
  readOnly,
}: {
  tenantId: string;
  influencerId: string;
  email: string;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const buscar = useServerFn(situacaoDoVinculo);
  const pedir = useServerFn(pedirVinculo);
  const desfazer = useServerFn(desfazerVinculo);

  const chave = ["mcb", "vinculo", tenantId, influencerId];
  const consulta = useQuery({
    queryKey: chave,
    queryFn: () => buscar({ data: { tenantId, influencerId } }),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: chave });

  const pedido = useMutation({
    mutationFn: () => pedir({ data: { tenantId, influencerId, email } }),
    onSuccess: () => {
      toast.success("Pedido enviado. A afiliada autoriza no portal dela.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const remocao = useMutation({
    mutationFn: (vinculoId: string) => desfazer({ data: { vinculoId } }),
    onSuccess: () => {
      toast.success("Vínculo desfeito. Os cadastros continuam existindo.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const vinculo = consulta.data;

  return (
    <section className="glass rounded-xl border border-border/60 p-6">
      <h2 className="text-xl font-semibold">Vínculo com outro ambiente</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quando a mesma pessoa participa dos dois programas, nome, e-mail e WhatsApp podem ser
        compartilhados. Só ela pode autorizar, no portal dela.
      </p>

      {consulta.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
      ) : vinculo ? (
        <div className="mt-4 grid gap-3">
          <p className="text-sm">
            {SITUACAO_DO_VINCULO[vinculo.situacao]}
            <span className="text-muted-foreground">
              {" "}
              · pedido em {new Date(vinculo.solicitado_em).toLocaleDateString("pt-BR")}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {vinculo.situacao !== "PENDENTE" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly || remocao.isPending}
                onClick={() => remocao.mutate(vinculo.id)}
              >
                {vinculo.situacao === "ACEITO" ? "Desfazer vínculo" : "Limpar pedido"}
              </Button>
            ) : null}
            {vinculo.situacao === "RECUSADO" ? (
              <Button
                size="sm"
                disabled={readOnly || pedido.isPending}
                onClick={() => pedido.mutate()}
              >
                Pedir de novo
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <Button
          className="mt-4"
          size="sm"
          disabled={readOnly || pedido.isPending}
          onClick={() => pedido.mutate()}
        >
          {pedido.isPending ? "Enviando…" : "Pedir vínculo com o outro ambiente"}
        </Button>
      )}
    </section>
  );
}
