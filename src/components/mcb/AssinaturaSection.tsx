/**
 * Fase 7 — Assinatura do ambiente, em Configurações: situação, vencimento, pagamentos
 * registrados e o cancelamento pela dona.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DIAS_DE_ARREPENDIMENTO,
  estadoDaAssinatura,
  precoBR,
  textoDaSituacao,
} from "@/lib/mcb/assinatura";
import { cancelarAssinatura, resumoDaAssinatura } from "@/lib/mcb/assinatura.functions";
import { CONTROLADOR } from "@/lib/mcb/documentosLegais";
import { dataBR } from "@/lib/mcb/relatorio";

export function AssinaturaSection({ tenantId }: { tenantId: string }) {
  const buscar = useServerFn(resumoDaAssinatura);
  const cancelar = useServerFn(cancelarAssinatura);
  const queryClient = useQueryClient();
  const chave = ["mcb", "assinatura", tenantId];

  const consulta = useQuery({ queryKey: chave, queryFn: () => buscar({ data: { tenantId } }) });
  const cancelamento = useMutation({
    mutationFn: () => cancelar({ data: { tenantId } }),
    onSuccess: (resultado) => {
      toast.success(
        resultado.arrependimento
          ? `Assinatura cancelada dentro dos ${DIAS_DE_ARREPENDIMENTO} dias de arrependimento. A MCB vai devolver o valor pago.`
          : `Assinatura cancelada. O ambiente continua funcionando até ${dataBR(resultado.valeAte)}.`,
      );
      void queryClient.invalidateQueries({ queryKey: chave });
    },
    onError: (erro: Error) =>
      toast.error(erro.message || "Não foi possível cancelar a assinatura."),
  });

  const resumo = consulta.data;
  if (!resumo) return null;
  const estado = estadoDaAssinatura(resumo.dados);
  if (estado.fase === "isenta") return null;

  const podeCancelar =
    resumo.souDona &&
    (estado.fase === "avaliacao" || estado.fase === "paga" || estado.fase === "tolerancia");

  return (
    <section className="glass rounded-xl border border-border/60 p-6">
      <h2 className="font-serif text-xl">Assinatura</h2>
      <p className="mt-2 text-sm">{textoDaSituacao(estado)}</p>
      {resumo.plano ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Plano {resumo.plano.nome}
          {resumo.plano.precoCentavos > 0
            ? ` · ${precoBR(resumo.plano.precoCentavos)} por mês`
            : ""}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        O pagamento é combinado com a MCB pelo e-mail{" "}
        <a href={`mailto:${CONTROLADOR.email}`} className="underline underline-offset-4">
          {CONTROLADOR.email}
        </a>
        . Assim que ele é registrado, o novo vencimento aparece aqui.
      </p>

      {resumo.pagamentos.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Pagamentos registrados
          </h3>
          <ul className="mt-2 grid gap-1 text-sm">
            {resumo.pagamentos.map((pagamento) => (
              <li key={pagamento.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {precoBR(pagamento.valorCentavos)} · {pagamento.forma}
                </span>
                <span className="text-xs text-muted-foreground">
                  de {dataBR(pagamento.periodoInicio)} a {dataBR(pagamento.periodoFim)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {podeCancelar ? (
        <div className="mt-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cancelamento.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  "Cancelar a assinatura? O ambiente continua funcionando até o fim do período e depois fica disponível só para leitura.",
                )
              ) {
                return;
              }
              cancelamento.mutate();
            }}
          >
            {cancelamento.isPending ? "Cancelando..." : "Cancelar assinatura"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Sem multa: o ambiente continua funcionando até o fim do período e depois fica disponível
            só para leitura. Na primeira contratação, cancelando em até {DIAS_DE_ARREPENDIMENTO}{" "}
            dias do pagamento, a MCB devolve o valor pago.
          </p>
        </div>
      ) : null}
    </section>
  );
}
