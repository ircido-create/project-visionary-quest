import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chaveDoTexto, lerPlanilhaDeRede, type LeituraDaPlanilha } from "@/lib/onbio/rede";
import { importarRedeOnbio, type ResultadoDaImportacao } from "@/lib/onbio/rede.functions";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const MODELO = [
  "nome;email;indicada por;vendas;pedidos;periodo inicio;periodo fim;meta 2026-09;meta 2026-10",
  "Maria Exemplo;maria@exemplo.com;;1.250,00;8;01/09/2026;31/10/2026;Bateu;Não bateu",
  "Joana Exemplo;;Maria Exemplo;320,50;2;01/09/2026;31/10/2026;Sem vendas;Bateu",
].join("\r\n");

function baixarModelo() {
  const blob = new Blob(["﻿" + MODELO], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-rede-onbio.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Importação da rede de indicações e das vendas a partir de uma planilha CSV.
 * A leitura e a conferência acontecem no navegador; a gravação é uma transação só.
 */
export function ImportarRedeSection({
  tenantId,
  readOnly,
}: {
  tenantId: string;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const importar = useServerFn(importarRedeOnbio);
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [origem, setOrigem] = useState("");
  const [leitura, setLeitura] = useState<LeituraDaPlanilha | null>(null);
  const [resultado, setResultado] = useState<ResultadoDaImportacao | null>(null);

  const resumo = useMemo(() => {
    if (!leitura) return null;
    const linhas = leitura.linhas;
    const meses = new Set(linhas.flatMap((l) => Object.keys(l.metas)));
    return {
      linhas: linhas.length,
      pessoas: new Set(linhas.map((l) => chaveDoTexto(l.nome))).size,
      comIndicadora: linhas.filter((l) => l.indicada_por).length,
      comEmail: linhas.filter((l) => l.email).length,
      vendas: linhas.reduce((s, l) => s + (l.vendas_centavos ?? 0), 0),
      meses: [...meses].sort().map((m) => m.slice(0, 7)),
    };
  }, [leitura]);

  const gravar = useMutation({
    mutationFn: () =>
      importar({
        data: { tenantId, origem: origem.trim() || "planilha", linhas: leitura!.linhas },
      }),
    onSuccess: async (r) => {
      setResultado(r);
      toast.success("Rede importada.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["onbio"] }),
        queryClient.invalidateQueries({ queryKey: ["mcb", "influencers", tenantId] }),
      ]);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const ler = async (file: File | undefined) => {
    setResultado(null);
    if (!file) {
      setArquivo(null);
      setLeitura(null);
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Arquivo grande demais (máximo 2 MB).");
      return;
    }
    const texto = await file.text();
    setArquivo(file.name);
    setOrigem(file.name.replace(/\.csv$/i, "").slice(0, 80));
    setLeitura(lerPlanilhaDeRede(texto));
  };

  if (readOnly) return null;

  return (
    <section className="glass mb-6 rounded-xl border border-border/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Importar rede e vendas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Planilha CSV com quem indicou cada afiliada, o total vendido no período e a situação de
            meta de cada mês. Quem já está cadastrada é reencontrada pelo e-mail ou pelo nome;
            importar a mesma planilha de novo atualiza sem duplicar.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setAberto((v) => !v)}>
          <FileUp aria-hidden="true" />
          {aberto ? "Fechar" : "Importar planilha"}
        </Button>
      </div>

      {aberto ? (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rede-arquivo">Arquivo CSV</Label>
              <Input
                id="rede-arquivo"
                type="file"
                accept=".csv,text/csv"
                className="max-w-sm"
                onChange={(e) => void ler(e.target.files?.[0])}
              />
            </div>
            <button
              type="button"
              className="pb-2 text-sm underline underline-offset-4"
              onClick={baixarModelo}
            >
              Baixar modelo
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Colunas: <strong>nome</strong> (obrigatória), email, indicada por, vendas, pedidos,
            periodo inicio, periodo fim e uma coluna <strong>meta AAAA-MM</strong> por mês (Bateu,
            Não bateu ou Sem vendas). Separador ponto e vírgula ou vírgula. Quem vier sem e-mail
            entra com e-mail provisório, para trocar depois na ficha.
          </p>

          {leitura && resumo ? (
            <div className="grid gap-3 rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-medium">{arquivo}</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                <li>
                  {resumo.pessoas} pessoas
                  {resumo.linhas !== resumo.pessoas ? ` em ${resumo.linhas} linhas` : ""}
                </li>
                <li>{resumo.comIndicadora} com indicadora</li>
                <li>{resumo.comEmail} com e-mail</li>
                <li>Vendas somadas: {money(resumo.vendas)}</li>
                <li className="sm:col-span-2">
                  Metas: {resumo.meses.length ? resumo.meses.join(", ") : "nenhum mês"}
                </li>
              </ul>
              {leitura.erros.length > 0 ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <p className="font-medium text-destructive">
                    Corrija a planilha antes de importar:
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {leitura.erros.slice(0, 20).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                  {leitura.erros.length > 20 ? (
                    <p className="mt-1">e mais {leitura.erros.length - 20}.</p>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="rede-origem">Nome desta carga</Label>
                    <Input
                      id="rede-origem"
                      className="w-72"
                      maxLength={80}
                      value={origem}
                      onChange={(e) => setOrigem(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={gravar.isPending || resumo.linhas === 0}
                    onClick={() => gravar.mutate()}
                  >
                    {gravar.isPending
                      ? "Importando…"
                      : `Importar ${resumo.linhas} linha${resumo.linhas === 1 ? "" : "s"}`}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O nome da carga identifica as vendas importadas. Importar de novo com o mesmo nome
                substitui os valores do mesmo período, em vez de somar.
              </p>
            </div>
          ) : null}

          {resultado ? (
            <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
              Pronto: {resultado.criadas} cadastros novos, {resultado.encontradas} já existentes,{" "}
              {resultado.ligacoes} indicações registradas, {resultado.resultados} resultados de
              vendas e {resultado.metas} metas mensais
              {resultado.emails_atualizados
                ? `, ${resultado.emails_atualizados} e-mails provisórios trocados pelo real`
                : ""}
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
