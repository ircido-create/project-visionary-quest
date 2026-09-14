/**
 * Fase 7 — Aviso no painel: avaliação ou mês pago terminando (5 dias antes), vencida na
 * tolerância, ou cancelada. Suspenso, o aviso é o do topo da página (AppShell).
 */

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  estadoDaAssinatura,
  precisaDeAviso,
  precoBR,
  textoDaSituacao,
  type EstadoDaAssinatura,
} from "@/lib/mcb/assinatura";
import { resumoDaAssinatura } from "@/lib/mcb/assinatura.functions";
import { CONTROLADOR } from "@/lib/mcb/documentosLegais";

function titulo(estado: EstadoDaAssinatura): string {
  switch (estado.fase) {
    case "avaliacao":
      return "Sua avaliação está terminando";
    case "paga":
      return "Sua assinatura vence em breve";
    case "tolerancia":
      return "Sua assinatura venceu";
    default:
      return "Assinatura cancelada";
  }
}

export function AvisoAssinaturaCard({ tenantId }: { tenantId: string }) {
  const buscar = useServerFn(resumoDaAssinatura);
  const consulta = useQuery({
    queryKey: ["mcb", "assinatura", tenantId],
    queryFn: () => buscar({ data: { tenantId } }),
  });

  const resumo = consulta.data;
  if (!resumo) return null;
  const estado = estadoDaAssinatura(resumo.dados);
  const mostrar =
    estado.fase === "cancelada" || (estado.fase !== "suspensa" && precisaDeAviso(estado));
  if (!mostrar) return null;

  const valor =
    resumo.plano && resumo.plano.precoCentavos > 0
      ? ` no plano ${resumo.plano.nome} (${precoBR(resumo.plano.precoCentavos)} por mês)`
      : "";

  return (
    <section className="glass rounded-xl border border-destructive/40 p-6">
      <h2 className="font-serif text-xl">{titulo(estado)}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {textoDaSituacao(estado)} Para continuar{valor}, fale com a MCB pelo e-mail{" "}
        <a href={`mailto:${CONTROLADOR.email}`} className="underline underline-offset-4">
          {CONTROLADOR.email}
        </a>
        .
      </p>
      <Link to="/configuracoes" className="mt-3 inline-block text-sm underline underline-offset-4">
        Ver a assinatura
      </Link>
    </section>
  );
}
