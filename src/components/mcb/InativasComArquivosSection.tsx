/**
 * Fase 6 — Na administração: candidatas que passaram dos 90 dias sem atividade mas que a
 * limpeza diária não exclui, porque têm arquivos de evidência. Os arquivos só saem pela
 * "Exclusão de dados a pedido", que também apaga o Storage.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { DIAS_PARA_EXCLUSAO } from "@/lib/mcb/inatividade";
import { candidatasInativasComArquivos } from "@/lib/mcb/inatividade.functions";

export function InativasComArquivosSection() {
  const buscar = useServerFn(candidatasInativasComArquivos);
  const consulta = useQuery({
    queryKey: ["mcb", "admin", "inativas-com-arquivos"],
    queryFn: () => buscar(),
  });
  const lista = consulta.data ?? [];

  return (
    <section className="glass rounded-xl border border-border/60 p-6">
      <h2 className="font-serif text-xl">
        Sem atividade há mais de {DIAS_PARA_EXCLUSAO} dias, com arquivos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A limpeza diária exclui sozinha as candidatas sem atividade há {DIAS_PARA_EXCLUSAO} dias. As
        que têm arquivos de evidência ficam aqui, porque os arquivos só saem pela exclusão da
        administração: busque o e-mail em “Exclusão de dados a pedido”.
      </p>
      {consulta.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhuma pendente.</p>
      ) : (
        <ul className="mt-4 grid gap-2 text-sm">
          {lista.map((c) => (
            <li key={c.id} className="rounded-lg border border-border/60 p-3">
              <p className="font-medium">{c.nome}</p>
              <p className="text-xs text-muted-foreground">
                {c.email} · {c.ambiente} · sem atividade há {c.diasSemAtividade} dias · {c.arquivos}{" "}
                arquivo(s)
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
