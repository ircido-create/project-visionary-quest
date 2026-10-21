import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { calcularComissoes, COMISSAO_PADRAO, montarRede } from "@/lib/onbio/rede";
import { getRedeOnbio } from "@/lib/onbio/rede.functions";

export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function useRedeOnbio(tenantId: string) {
  const buscar = useServerFn(getRedeOnbio);
  const consulta = useQuery({
    queryKey: ["onbio", "rede", tenantId],
    queryFn: () => buscar({ data: { tenantId } }),
  });
  const rede = useMemo(
    () =>
      consulta.data
        ? montarRede(consulta.data.pessoas, consulta.data.resultados, consulta.data.metas)
        : null,
    [consulta.data],
  );
  const percentuais = consulta.data?.percentuais ?? [...COMISSAO_PADRAO];
  const comissoes = useMemo(
    () => (rede ? calcularComissoes(rede, percentuais) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rede, percentuais.join(",")],
  );
  return { consulta, rede, comissoes, percentuais };
}
