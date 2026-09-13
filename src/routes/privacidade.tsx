import { createFileRoute } from "@tanstack/react-router";

import { DocumentoLegal } from "@/components/mcb/DocumentoLegal";
import { VERSAO_POLITICA, politicaDePrivacidade } from "@/lib/mcb/documentosLegais";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — MCB" },
      {
        name: "description",
        content:
          "Quais dados a plataforma MCB trata, para quê, com quem compartilha e como exercer seus direitos pela LGPD.",
      },
    ],
  }),
  component: () => (
    <DocumentoLegal
      titulo="Política de Privacidade"
      versao={VERSAO_POLITICA}
      introducao="Esta política explica quais dados a plataforma MCB — Método Criadora Blessing trata, para quê, com quem compartilha e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)."
      secoes={politicaDePrivacidade()}
      outro={{ to: "/termos", rotulo: "Termos de Uso" }}
    />
  ),
});
