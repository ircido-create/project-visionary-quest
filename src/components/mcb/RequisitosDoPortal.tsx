/**
 * Fase 8 — No portal da afiliada: cada requisito do programa, quanto falta e o que ela
 * pode fazer. O cálculo vem do servidor, com o mesmo motor da página da gestora.
 */

import {
  resumoDosRequisitos,
  type RequisitoDoPortal,
  type SituacaoDoRequisito,
} from "@/lib/mcb/portalRequisitos";
import { dataBR } from "@/lib/mcb/relatorio";

const ROTULO: Record<SituacaoDoRequisito, string> = {
  cumprido: "Cumprido",
  falta: "Falta",
  a_confirmar: "A confirmar",
};

const TOM: Record<SituacaoDoRequisito, string> = {
  cumprido: "border-primary/40 text-primary",
  falta: "border-destructive/40 text-destructive",
  a_confirmar: "border-border text-muted-foreground",
};

export function RequisitosDoPortal({
  itens,
  atualizadoEm,
}: {
  itens: RequisitoDoPortal[];
  atualizadoEm: string | null;
}) {
  if (itens.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Requisitos do programa
      </h3>
      <p className="mt-2 text-sm">{resumoDosRequisitos(itens)}</p>
      <ul className="mt-3 grid gap-2">
        {itens.map((item) => (
          <li key={item.chave} className="rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{item.titulo}</p>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${TOM[item.situacao]}`}>
                {ROTULO[item.situacao]}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Hoje: {item.atual ?? "não informado"} · Meta: {item.meta}
            </p>
            {item.proximoPasso ? <p className="mt-2 text-sm">{item.proximoPasso}</p> : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {atualizadoEm ? `Números da última atualização, em ${dataBR(atualizadoEm)}. ` : ""}
        Atender aos requisitos não garante aprovação em programas de terceiros.
      </p>
    </div>
  );
}
