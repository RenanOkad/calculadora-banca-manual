import test from "node:test";
import assert from "node:assert/strict";
import { calculateBankroll, calculateMegaSicBac, parseDecimal } from "./calculadora.js";

const baseInput = {
  bancaInicial: 1000,
  saldoAtual: 1000,
  stopWinPercentual: 10,
  stopLossPercentual: 20,
  fichaMinima: 5,
  corPercentual: 90,
};

test("calculates the initial entry and G1 with red mode off", () => {
  const result = calculateBankroll(baseInput);

  assert.equal(result.margemOriginal, 200);
  assert.equal(result.margemAtual, 200);
  assert.equal(result.orcamentoDeRisco, 100);
  assert.equal(result.totalEntradaBruto, 30);
  assert.equal(result.totalG1Bruto, 70);
  assert.equal(result.entradaCor, 25);
  assert.equal(result.entradaEmpate, 5);
  assert.equal(result.g1Cor, 60);
  assert.equal(result.g1Empate, 5);
  assert.equal(result.riscoTotalReal, 95);
});

test("calculates the initial entry and G1 with red mode on", () => {
  const result = calculateBankroll({ ...baseInput, tomouRed: true });

  assert.equal(result.orcamentoDeRisco, 200);
  assert.equal(result.entradaCor, 50);
  assert.equal(result.entradaEmpate, 5);
  assert.equal(result.g1Cor, 125);
  assert.equal(result.g1Empate, 10);
  assert.equal(result.riscoTotalReal, 190);
});

test("includes session profit when calculating margin and targets", () => {
  const result = calculateBankroll({ ...baseInput, saldoAtual: 1100 });

  assert.equal(result.margemAtual, 300);
  assert.equal(result.ganhoEsperado, 100);
  assert.equal(result.valorFinalEsperado, 1100);
  assert.equal(result.stopValor, 800);
  assert.equal(result.resultado, 100);
  assert.equal(result.percentualResultado, 10);
  assert.equal(result.faltaParaGanho, 0);
});

test("supports zero chip minimum and zero starting bankroll", () => {
  const result = calculateBankroll({
    ...baseInput,
    bancaInicial: 0,
    saldoAtual: 20,
    fichaMinima: 0,
  });

  assert.equal(result.percentualResultado, 0);
  assert.equal(result.margemAtual, 20);
  assert.equal(result.entradaCor, 2.7);
  assert.ok(Number.isFinite(result.riscoTotalReal));
});

test("rounds exact decimal chip multiples down without floating-point loss", () => {
  const result = calculateBankroll({
    bancaInicial: 10,
    saldoAtual: 10,
    stopWinPercentual: 10,
    stopLossPercentual: 20,
    fichaMinima: 0.1,
    corPercentual: 100,
  });

  assert.equal(result.totalEntradaBruto, 0.3);
  assert.ok(Math.abs(result.entradaCor - 0.3) < Number.EPSILON);
});

test("clamps color share and parses decimal commas safely", () => {
  const result = calculateBankroll({ ...baseInput, corPercentual: 150 });

  assert.equal(result.corPercentual, 100);
  assert.equal(result.empatePercentual, 0);
  assert.equal(parseDecimal("12,50"), 12.5);
  assert.equal(parseDecimal(""), 0);
  assert.equal(parseDecimal("invalido"), 0);
});

test("calculates Mega Sic Bac progression for the supplied margin examples", () => {
  const expected = [
    { margin: 25, first: [6, 1], gale: [14, 4], galeProfits: [3, 3] },
    { margin: 27, first: [6, 1], gale: [15.5, 4.5], galeProfits: [4, 4.5] },
    { margin: 35, first: [6, 1], gale: [21.5, 6.5], galeProfits: [8, 10.5] },
    { margin: 1000, first: [210, 35], gale: [587, 168], galeProfits: [174, 176] },
  ];

  for (const example of expected) {
    const result = calculateMegaSicBac(example.margin);
    assert.equal(result.valid, true);
    assert.deepEqual([result.S1, result.T1], example.first);
    assert.deepEqual([result.S2, result.T2], example.gale);
    assert.deepEqual([result.profitSide2, result.profitTie2], example.galeProfits);
    assert.equal(result.total, example.margin);
    assert.equal(result.maxLoss, example.margin);
    assert.equal(result.profitTie1, 0);
  }
});

test("rounds Mega Sic Bac margin down to the nearest chip and reports the unused amount", () => {
  const result = calculateMegaSicBac(17.49);

  assert.equal(result.valid, true);
  assert.equal(result.availableMargin, 17.49);
  assert.equal(result.margin, 17);
  assert.equal(result.unusedMargin, 0.49);
  assert.equal(result.total, 17);
  assert.equal(result.maxLoss, 17);
});

test("validates a non-positive Mega Sic Bac margin and warns when the gale cannot be profitable", () => {
  const zeroMargin = calculateMegaSicBac(0);
  assert.equal(zeroMargin.valid, false);
  assert.equal(zeroMargin.reason, "positive-margin");
  const smallMargin = calculateMegaSicBac(3);
  assert.equal(smallMargin.valid, false);
  assert.equal(smallMargin.reason, "margin-too-small");
  assert.equal(calculateMegaSicBac(3.5).warning, "gale-no-positive-profit");
});
