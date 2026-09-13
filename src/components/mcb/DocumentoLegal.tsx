/**
 * Fase 6 — Página de documento legal (Política de Privacidade, Termos de Uso). O texto
 * vem de `documentosLegais.ts`; aqui é só a apresentação.
 */

import { Link } from "@tanstack/react-router";

import {
  CONTROLADOR,
  dataPorExtenso,
  nomeDoControlador,
  type Secao,
} from "@/lib/mcb/documentosLegais";

export function DocumentoLegal({
  titulo,
  versao,
  introducao,
  secoes,
  outro,
}: {
  titulo: string;
  versao: string;
  introducao: string;
  secoes: Secao[];
  outro: { to: "/privacidade" | "/termos"; rotulo: string };
}) {
  return (
    <div className="grain-overlay min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-serif text-2xl tracking-tight">
          MCB
        </Link>
        <Link to={outro.to} className="text-sm text-muted-foreground underline underline-offset-4">
          {outro.rotulo}
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="font-serif text-4xl">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Versão de {dataPorExtenso(versao)} · {nomeDoControlador()} · CNPJ {CONTROLADOR.cnpj} ·{" "}
          <a href={`mailto:${CONTROLADOR.email}`} className="underline underline-offset-4">
            {CONTROLADOR.email}
          </a>
        </p>
        <p className="mt-6 text-base">{introducao}</p>

        <nav aria-label="Seções" className="mt-8 rounded-xl border border-border/60 p-4 text-sm">
          <ol className="grid gap-1 sm:grid-cols-2">
            {secoes.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline-offset-4 hover:underline">
                  {i + 1}. {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {secoes.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-10 scroll-mt-6">
            <h2 className="font-serif text-2xl">
              {i + 1}. {s.titulo}
            </h2>
            {s.blocos.map((b, j) =>
              b.tipo === "p" ? (
                <p key={j} className="mt-3 leading-relaxed">
                  {b.texto}
                </p>
              ) : (
                <ul key={j} className="mt-3 grid list-disc gap-2 pl-6 leading-relaxed">
                  {b.itens.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
