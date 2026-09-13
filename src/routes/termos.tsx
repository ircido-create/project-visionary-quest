import { createFileRoute } from "@tanstack/react-router";

import { DocumentoLegal } from "@/components/mcb/DocumentoLegal";
import { VERSAO_TERMOS, termosDeUso } from "@/lib/mcb/documentosLegais";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — MCB" },
      {
        name: "description",
        content: "As regras de uso da plataforma MCB para gestoras, equipes e candidatas.",
      },
    ],
  }),
  component: () => (
    <DocumentoLegal
      titulo="Termos de Uso"
      versao={VERSAO_TERMOS}
      introducao="Estes termos regem o uso da plataforma MCB — Método Criadora Blessing. Ao criar uma conta ou se inscrever por uma página de candidatura, você concorda com eles e com a Política de Privacidade."
      secoes={termosDeUso()}
      outro={{ to: "/privacidade", rotulo: "Política de Privacidade" }}
    />
  ),
});
