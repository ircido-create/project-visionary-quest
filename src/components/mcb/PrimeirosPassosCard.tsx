/**
 * Fase 6 — Cartão "Primeiros passos" no painel, para a dona e a administradora de um
 * ambiente real. As regras estão em `primeirosPassos.ts`; os dados, em
 * `primeirosPassos.functions.ts`.
 *
 * Ocultar é uma preferência de quem está vendo, guardada no navegador: não é algo que o
 * resto da equipe precise saber, e o roteiro some sozinho quando fica completo.
 */

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  linkDeCandidatura,
  montarPassos,
  progresso,
  roteiroConcluido,
} from "@/lib/mcb/primeirosPassos";
import { obterPrimeirosPassos } from "@/lib/mcb/primeirosPassos.functions";

function copiar(texto: string) {
  navigator.clipboard.writeText(texto).then(
    () => toast.success("Link copiado."),
    () => toast.error("Não foi possível copiar. Selecione o link e copie."),
  );
}

export function PrimeirosPassosCard({ tenantId }: { tenantId: string }) {
  const buscar = useServerFn(obterPrimeirosPassos);
  const chaveOculto = `mcb.primeirosPassos.ocultos.${tenantId}`;
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    try {
      setOculto(window.localStorage.getItem(chaveOculto) === "1");
    } catch {
      setOculto(false);
    }
  }, [chaveOculto]);

  const consulta = useQuery({
    queryKey: ["mcb", "primeiros-passos", tenantId],
    queryFn: () => buscar({ data: { tenantId } }),
    // Os passos mudam em outras telas (Configurações, página pública): volta a conferir
    // sempre que o painel abre.
    staleTime: 0,
  });

  const dados = consulta.data;
  if (!dados || !dados.podeVer || oculto) return null;

  const passos = montarPassos(dados);
  if (roteiroConcluido(passos)) return null;

  const { feitos, total } = progresso(passos);
  const link = linkDeCandidatura(window.location.origin, dados.slug);

  return (
    <section className="glass rounded-xl border border-primary/40 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">Primeiros passos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {feitos} de {total} feitos. O roteiro some quando os três obrigatórios estiverem
            prontos.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            try {
              window.localStorage.setItem(chaveOculto, "1");
            } catch {
              // Sem acesso ao armazenamento do navegador: oculta só nesta visita.
            }
            setOculto(true);
          }}
        >
          Ocultar
        </Button>
      </div>

      <ol className="mt-4 grid gap-3 text-sm">
        {passos.map((passo) => (
          <li key={passo.chave} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                passo.feito
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {passo.feito ? "✓" : ""}
            </span>
            <div className="min-w-0">
              <p className={passo.feito ? "text-muted-foreground line-through" : "font-medium"}>
                {passo.titulo}
                {passo.opcional ? (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
                ) : null}
                <span className="sr-only">{passo.feito ? " — feito" : " — por fazer"}</span>
              </p>
              {passo.feito ? null : (
                <>
                  <p className="text-xs text-muted-foreground">{passo.descricao}</p>
                  {passo.chave === "primeiraCandidata" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="break-all rounded bg-muted px-2 py-1 text-xs">{link}</code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copiar(link)}
                      >
                        Copiar link
                      </Button>
                    </div>
                  ) : (
                    <Link
                      to="/configuracoes"
                      className="mt-1 inline-block text-xs underline underline-offset-4"
                    >
                      Ir para Configurações
                    </Link>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs text-muted-foreground">
        {dados.listadaNoMcb
          ? "Sua página aparece na lista de páginas de candidatura do MCB."
          : "Sua página está no ar para quem tem o link, mas não aparece na lista do MCB. Isso se muda em Configurações."}
      </p>
    </section>
  );
}
