import { describe, expect, it } from "vitest";

import {
  caminhosDeEvidencia,
  confirmacaoConfere,
  escaparIlike,
  motivoParaManterConta,
  resumoExclusao,
} from "./exclusao";

describe("confirmação da exclusão", () => {
  it("aceita o e-mail digitado de novo, sem ligar para maiúsculas e espaços", () => {
    expect(confirmacaoConfere("  Ana.Souza@Exemplo.com ", "ana.souza@exemplo.com")).toBe(true);
  });

  it("recusa vazio e e-mail diferente", () => {
    expect(confirmacaoConfere("", "")).toBe(false);
    expect(confirmacaoConfere("   ", "ana@exemplo.com")).toBe(false);
    expect(confirmacaoConfere("ana@exemplo.co", "ana@exemplo.com")).toBe(false);
  });
});

describe("busca por e-mail", () => {
  it("trata _ e % como texto, não como curinga", () => {
    expect(escaparIlike("ana_b%x@exemplo.com")).toBe("ana\\_b\\%x@exemplo.com");
    expect(escaparIlike("a\\b")).toBe("a\\\\b");
    expect(escaparIlike("ana@exemplo.com")).toBe("ana@exemplo.com");
  });
});

describe("conta de acesso ao portal", () => {
  const base = {
    temConta: true,
    outrasCandidaturas: 0,
    membroDeAmbiente: false,
    papelNaPlataforma: false,
  };

  it("pode ser apagada quando só serve a esta inscrição", () => {
    expect(motivoParaManterConta(base)).toBeNull();
  });

  it("não há o que apagar sem conta", () => {
    expect(motivoParaManterConta({ ...base, temConta: false })).toMatch(/não criou conta/);
  });

  it("fica quando a pessoa também é gestora ou administra a plataforma", () => {
    expect(motivoParaManterConta({ ...base, membroDeAmbiente: true })).toMatch(/gestora/);
    expect(motivoParaManterConta({ ...base, papelNaPlataforma: true })).toMatch(/administração/);
  });

  it("fica quando há inscrição em outro ambiente", () => {
    expect(motivoParaManterConta({ ...base, outrasCandidaturas: 1 })).toMatch(/outra inscrição/);
    expect(motivoParaManterConta({ ...base, outrasCandidaturas: 2 })).toMatch(/outras 2/);
  });
});

describe("resumo do que foi apagado", () => {
  it("lista só o que tinha, no singular e no plural", () => {
    expect(
      resumoExclusao({ inscricoes: 1, tarefas: 3, notas: 0, registros_de_numeros: 5, arquivos: 1 }),
    ).toBe("1 inscrição, 3 tarefas, 5 registros de números, 1 arquivo");
  });

  it("sem nada ligado, diz que era só o cadastro", () => {
    expect(resumoExclusao({})).toBe("só o cadastro");
  });
});

describe("arquivos no armazenamento", () => {
  it("monta o caminho completo e ignora entradas vazias e subpastas", () => {
    expect(caminhosDeEvidencia("t1", "c1", ["a.png", "", "sub/b.png", "c.pdf"])).toEqual([
      "t1/c1/a.png",
      "t1/c1/c.pdf",
    ]);
  });
});
