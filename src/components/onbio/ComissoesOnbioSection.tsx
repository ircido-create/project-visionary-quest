import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, useRedeOnbio } from "@/components/onbio/useRedeOnbio";
import {
  chaveDoTexto,
  NIVEIS_DE_COMISSAO,
  percentuaisValidos,
  rotuloDoNivel,
} from "@/lib/onbio/rede";
import { definirComissoesOnbio } from "@/lib/onbio/rede.functions";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const ROTULOS_REGRA = [
  "Venda própria",
  ...Array.from({ length: NIVEIS_DE_COMISSAO }, (_, i) => `${rotuloDoNivel(i + 1)} abaixo`),
];

function EditorDeRegras({
  tenantId,
  percentuais,
  fechar,
}: {
  tenantId: string;
  percentuais: number[];
  fechar: () => void;
}) {
  const queryClient = useQueryClient();
  const definir = useServerFn(definirComissoesOnbio);
  const [valores, setValores] = useState(percentuais.map((v) => String(v).replace(".", ",")));
  const numeros = valores.map((v) => Number(v.replace(",", ".")));
  const validos = valores.every((v) => v.trim() !== "") && percentuaisValidos(numeros);

  const salvar = useMutation({
    mutationFn: () => definir({ data: { tenantId, percentuais: numeros } }),
    onSuccess: async () => {
      toast.success("Comissões atualizadas.");
      await queryClient.invalidateQueries({ queryKey: ["onbio", "rede", tenantId] });
      fechar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <form
      className="mt-4 grid gap-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (validos) salvar.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ROTULOS_REGRA.map((rotulo, i) => (
          <label key={rotulo} className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{rotulo}</span>
            <div className="flex items-center gap-1">
              <Input
                inputMode="decimal"
                value={valores[i]}
                onChange={(e) =>
                  setValores((atual) => atual.map((v, j) => (j === i ? e.target.value : v)))
                }
              />
              <span aria-hidden="true">%</span>
            </div>
          </label>
        ))}
      </div>
      {!validos ? (
        <p className="text-sm text-destructive">
          Use números de 0 a 100, com soma de no máximo 100%.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={!validos || salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar regras"}
        </Button>
        <Button type="button" variant="outline" onClick={fechar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Comissões da rede: regras por nível e quanto cada pessoa recebe. */
export function ComissoesOnbioSection({
  tenantId,
  podeEditar,
}: {
  tenantId: string;
  podeEditar: boolean;
}) {
  const { rede, comissoes, percentuais } = useRedeOnbio(tenantId);
  const [editando, setEditando] = useState(false);
  const [filtro, setFiltro] = useState("");

  const linhas = useMemo(() => {
    if (!rede || !comissoes) return [];
    const termo = chaveDoTexto(filtro);
    return [...comissoes.porPessoa.entries()]
      .map(([id, c]) => ({ id, nome: rede.nos.get(id)?.nome ?? "—", c }))
      .filter((l) => l.c.totalCentavos > 0)
      .filter((l) => termo === "" || chaveDoTexto(l.nome).includes(termo))
      .sort(
        (a, b) => b.c.totalCentavos - a.c.totalCentavos || a.nome.localeCompare(b.nome, "pt-BR"),
      );
  }, [rede, comissoes, filtro]);

  if (!rede || !comissoes) return null;
  if (![...rede.nos.values()].some((n) => n.indicadaPor !== null)) return null;

  const daRede = [...comissoes.porPessoa.values()].reduce((s, c) => s + c.redeCentavos, 0);
  const propria = comissoes.totalCentavos - daRede;
  // Colunas de nível só aparecem se alguém recebeu naquele nível.
  const niveisUsados = Array.from({ length: NIVEIS_DE_COMISSAO }, (_, i) => i).filter((i) =>
    [...comissoes.porPessoa.values()].some((c) => (c.porNivelCentavos[i] ?? 0) > 0),
  );

  return (
    <section className="glass rounded-xl border border-border/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Comissões da rede</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cada venda paga quem vendeu e até {NIVEIS_DE_COMISSAO} pessoas acima dela na rede.
            Calculado sobre as vendas importadas.
          </p>
        </div>
        {podeEditar && !editando ? (
          <Button type="button" variant="outline" onClick={() => setEditando(true)}>
            Editar regras
          </Button>
        ) : null}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2 text-sm">
        {ROTULOS_REGRA.map((rotulo, i) => (
          <li key={rotulo} className="rounded-full border border-border px-3 py-1">
            {rotulo}: <strong>{pct(percentuais[i] ?? 0)}</strong>
          </li>
        ))}
      </ul>
      {editando ? (
        <EditorDeRegras
          tenantId={tenantId}
          percentuais={percentuais}
          fechar={() => setEditando(false)}
        />
      ) : null}

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Total de comissões
          </dt>
          <dd className="mt-1 font-serif text-2xl text-primary">
            {money(comissoes.totalCentavos)}
          </dd>
        </div>
        <div className="rounded-lg border border-border p-4">
          <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Sobre venda própria
          </dt>
          <dd className="mt-1 font-serif text-2xl">{money(propria)}</dd>
        </div>
        <div className="rounded-lg border border-border p-4">
          <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Sobre a rede
          </dt>
          <dd className="mt-1 font-serif text-2xl">{money(daRede)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {linhas.length} pessoa{linhas.length === 1 ? "" : "s"} com comissão
        </p>
        <Input
          aria-label="Buscar comissão por nome"
          placeholder="Buscar pelo nome"
          className="w-56"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2 pr-4">Pessoa</th>
              <th className="py-2 pr-4 text-right">Própria</th>
              {niveisUsados.map((i) => (
                <th key={i} className="py-2 pr-4 text-right">
                  {rotuloDoNivel(i + 1)}
                </th>
              ))}
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ id, nome, c }) => (
              <tr key={id} className="border-t border-border/60">
                <td className="py-2 pr-4">
                  <Link
                    to="/candidatas/$id"
                    params={{ id }}
                    className="font-medium hover:underline"
                  >
                    {nome}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {c.propriaCentavos ? money(c.propriaCentavos) : "—"}
                </td>
                {niveisUsados.map((i) => (
                  <td key={i} className="py-2 pr-4 text-right tabular-nums">
                    {c.porNivelCentavos[i] ? money(c.porNivelCentavos[i]!) : "—"}
                  </td>
                ))}
                <td className="py-2 text-right font-medium tabular-nums">
                  {money(c.totalCentavos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
