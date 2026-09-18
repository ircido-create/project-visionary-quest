import { describe, expect, it } from "vitest";

import {
  ambienteDaChave,
  emCentavos,
  lerEvento,
  mesesDoCiclo,
  primeiroVencimento,
  somenteDigitos,
} from "./asaas";

describe("ambiente pela chave", () => {
  it("reconhece sandbox pelo prefixo e trata o resto como produção", () => {
    expect(ambienteDaChave("$aact_hmlg_000Mzkw")).toBe("sandbox");
    expect(ambienteDaChave("$aact_prod_000Mzkw")).toBe("producao");
  });
});

describe("ciclos", () => {
  it("converte o ciclo em meses e cai no mensal quando não reconhece", () => {
    expect(mesesDoCiclo("MONTHLY")).toBe(1);
    expect(mesesDoCiclo("YEARLY")).toBe(12);
    expect(mesesDoCiclo("QUINZENAL")).toBe(1);
  });
});

describe("valores", () => {
  it("converte reais em centavos sem erro de ponto flutuante", () => {
    expect(emCentavos(97)).toBe(9700);
    expect(emCentavos(97.9)).toBe(9790);
    expect(emCentavos(0.07)).toBe(7);
    expect(emCentavos(null)).toBe(0);
  });
});

describe("leitura do webhook", () => {
  const pagamento = {
    id: "pay_123",
    customer: "cus_1",
    subscription: "sub_1",
    value: 97,
    billingType: "PIX",
  };

  it("registra pagamento recebido e confirmado", () => {
    for (const event of ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]) {
      expect(lerEvento({ event, payment: pagamento })).toEqual({
        tipo: "registrar",
        referencia: "pay_123",
        centavos: 9700,
        forma: "PIX",
        customer: "cus_1",
        subscription: "sub_1",
      });
    }
  });

  it("ignora eventos que não movimentam a assinatura, sem falhar", () => {
    expect(lerEvento({ event: "PAYMENT_CREATED", payment: pagamento })).toMatchObject({
      tipo: "ignorar",
    });
    expect(lerEvento({ event: "PAYMENT_OVERDUE", payment: pagamento })).toMatchObject({
      tipo: "ignorar",
    });
    expect(lerEvento(null)).toMatchObject({ tipo: "ignorar" });
  });

  it("ignora pagamento sem identificador ou sem valor", () => {
    expect(lerEvento({ event: "PAYMENT_RECEIVED", payment: { value: 97 } })).toMatchObject({
      tipo: "ignorar",
    });
    expect(
      lerEvento({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1", value: 0 } }),
    ).toMatchObject({ tipo: "ignorar" });
  });
});

describe("dados do cadastro", () => {
  it("limpa CPF e CNPJ", () => {
    expect(somenteDigitos("31.293.212/0001-38")).toBe("31293212000138");
    expect(somenteDigitos(null)).toBe("");
  });

  it("primeiro vencimento cai alguns dias à frente", () => {
    expect(primeiroVencimento(3, new Date("2026-09-18T12:00:00Z"))).toBe("2026-09-21");
  });
});
