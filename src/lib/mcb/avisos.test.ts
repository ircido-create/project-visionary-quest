import { describe, expect, it } from "vitest";

import { avisoDaCandidata, contagemNoSino, haQuanto } from "./avisos";

const agora = new Date("2026-09-14T12:00:00Z");

describe("avisos", () => {
  it("diz há quanto tempo, do mais recente ao mais antigo", () => {
    expect(haQuanto("2026-09-14T11:59:40Z", agora)).toBe("agora");
    expect(haQuanto("2026-09-14T11:55:00Z", agora)).toBe("há 5 min");
    expect(haQuanto("2026-09-14T09:00:00Z", agora)).toBe("há 3 h");
    expect(haQuanto("2026-09-13T10:00:00Z", agora)).toBe("ontem");
    expect(haQuanto("2026-09-10T12:00:00Z", agora)).toBe("há 4 dias");
    expect(haQuanto("2026-08-30T15:00:00Z", agora)).toBe("30/08/2026");
  });

  it("o sino mostra até 9 e depois 9+; sem não lidos, nada", () => {
    expect(contagemNoSino(0)).toBeNull();
    expect(contagemNoSino(3)).toBe("3");
    expect(contagemNoSino(12)).toBe("9+");
  });

  it("tarefa e feedback novos são da afiliada; o resto é da gestora", () => {
    expect(avisoDaCandidata("tarefa_nova")).toBe(true);
    expect(avisoDaCandidata("feedback_novo")).toBe(true);
    expect(avisoDaCandidata("nova_candidatura")).toBe(false);
    expect(avisoDaCandidata("tarefa_concluida")).toBe(false);
    expect(avisoDaCandidata("pronta_auditoria")).toBe(false);
  });
});
