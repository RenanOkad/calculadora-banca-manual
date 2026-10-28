import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBankroll,
  calculateMegaSicBac,
  calculateMegaSicBacGale2,
  parseDecimal,
} from "./calculadora.js";

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
    {
      margin: 17,
      first: [3, 0.5],
      gale: [10.5, 3],
      firstProfits: [2.5, 0],
      galeProfits: [4, 4],
    },
    {
      margin: 20,
      first: [4, 1],
      gale: [11.5, 3.5],
      firstProfits: [3, 2],
      galeProfits: [3, 4.5],
    },
    {
      margin: 25,
      first: [5, 1],
      gale: [14.5, 4.5],
      firstProfits: [4, 1],
      galeProfits: [4, 6.5],
    },
    {
      margin: 30,
      first: [6, 1],
      gale: [18, 5],
      firstProfits: [5, 0],
      galeProfits: [6, 5],
    },
    {
      margin: 40,
      first: [8, 1.5],
      gale: [23.5, 7],
      firstProfits: [6.5, 1],
      galeProfits: [7, 9],
    },
  ];

  for (const example of expected) {
    const result = calculateMegaSicBac(example.margin);
    assert.equal(result.valid, true);
    assert.deepEqual([result.S1, result.T1], example.first);
    assert.deepEqual([result.S2, result.T2], example.gale);
    assert.deepEqual([result.profitSide1, result.profitTie1], example.firstProfits);
    assert.deepEqual([result.profitSide2, result.profitTie2], example.galeProfits);
    assert.equal(result.total, example.margin);
    assert.equal(result.maxLoss, example.margin);
    assert.equal(result.unusedMargin, 0);
  }
});

test("keeps large Mega Sic Bac margins performant and rounds them down to a chip", () => {
  const result = calculateMegaSicBac(1000);

  assert.equal(result.valid, true);
  assert.equal(result.margin, 1000);
  assert.equal(result.total, 1000);
  assert.equal(result.unusedMargin, 0);
  for (const amount of [result.S1, result.T1, result.S2, result.T2]) {
    assert.equal(amount * 2, Math.round(amount * 2));
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

test("calculates Mega Sic Bac through Gale 2 for the supplied examples", () => {
  const expected = [
    {
      margin: 40,
      stakes: [2.5, 0.5, 7, 2, 22, 6],
      profits: [2, 2, 2, 4, 2],
      firstTieProfit: 0.5,
    },
    {
      margin: 100,
      stakes: [6.5, 1.5, 19, 5.5, 52.5, 15],
      profits: [5, 5.5, 6, 5, 5],
      firstTieProfit: 2.5,
    },
    {
      margin: 200,
      stakes: [13, 2.5, 37.5, 11, 105.5, 30.5],
      profits: [10.5, 11, 13, 11, 13.5],
      firstTieProfit: 2,
    },
    {
      margin: 1000,
      stakes: [67, 11.5, 188.5, 54, 528, 151],
      profits: [55.5, 56, 57, 56, 57],
      firstTieProfit: 2,
    },
  ];

  for (const example of expected) {
    const result = calculateMegaSicBacGale2(example.margin);
    assert.equal(result.valid, true);
    assert.deepEqual(
      [result.S1, result.T1, result.S2, result.T2, result.S3, result.T3],
      example.stakes,
    );
    assert.deepEqual(
      [
        result.profitSide1,
        result.profitSide2,
        result.profitTie2,
        result.profitSide3,
        result.profitTie3,
      ],
      example.profits,
    );
    assert.equal(result.profitTie1, example.firstTieProfit);
    assert.equal(result.total, example.margin);
    assert.equal(result.maxLoss, example.margin);
    assert.equal(result.unusedMargin, 0);
  }
});

test("rounds Gale 2 margin down and warns when its minimum profit is not positive", () => {
  const rounded = calculateMegaSicBacGale2(40.49);
  assert.equal(rounded.margin, 40);
  assert.equal(rounded.unusedMargin, 0.49);
  assert.equal(rounded.total, 40);

  const tooSmall = calculateMegaSicBacGale2(5);
  assert.equal(tooSmall.valid, true);
  assert.equal(tooSmall.warning, "gale2-no-positive-profit");
});
