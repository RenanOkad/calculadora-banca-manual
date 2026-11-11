import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBankroll,
  calculateColorComparison,
  calculateGreensProgression,
  calculateMegaSicBac,
  calculateMegaSicBacGale2,
  parseDecimal,
  simulateGrowingGreens,
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

test("calculates Mega Sic Bac with zero J1 tie profit for the supplied examples", () => {
  const expected = [
    { margin: 50, stakes: [9, 1.5, 31, 8.5] },
    { margin: 100, stakes: [21, 3.5, 58.5, 17] },
    { margin: 1000, stakes: [210, 35, 587, 168] },
  ];

  for (const example of expected) {
    const result = calculateMegaSicBac(example.margin, "zero");
    assert.equal(result.valid, true);
    assert.deepEqual([result.S1, result.T1, result.S2, result.T2], example.stakes);
    assert.equal(result.profitTie1, 0);
    assert.equal(result.total, example.margin);
    assert.equal(result.maxLoss, example.margin);
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

test("calculates Greens 1 para 1 examples with chip rounding and progression levels", () => {
  const examples = [
    { margin: 200, chip: 0.5, levels: 3, stakes: [28.5, 57, 114], used: 199.5, greens: 4 },
    { margin: 75, chip: 0.5, levels: 2, stakes: [25, 50], used: 75, greens: 4 },
    { margin: 200, chip: 0.5, levels: 2, stakes: [66.5, 133], used: 199.5, greens: 2 },
    { margin: 100, chip: 0.5, levels: 3, stakes: [14, 28, 56], used: 98, greens: 8 },
    { margin: 100, chip: 5, levels: 2, stakes: [30, 60], used: 90, greens: 4 },
    { margin: 150, chip: 5, levels: 2, stakes: [50, 100], used: 150, greens: 2 },
    { margin: 200, chip: 5, levels: 2, stakes: [65, 130], used: 195, greens: 2 },
  ];

  for (const example of examples) {
    const result = calculateGreensProgression({
      margin: example.margin,
      stopWin: 100,
      stopLoss: 150,
      minimumChip: example.chip,
      levels: example.levels,
    });
    assert.deepEqual(result.stakes, example.stakes);
    assert.equal(result.usedMargin, example.used);
    assert.equal(result.greens, example.greens);
  }
});

test("calculates color-and-tie versus color-only greens for Mega Sic Bac examples", () => {
  const megaGale1 = calculateColorComparison({
    stopWin: 100,
    rounds: [
      { color: 5, tie: 1 },
      { color: 14.5, tie: 4.5 },
    ],
  });
  assert.deepEqual(megaGale1.withTie, [
    { profit: 4, greens: 25 },
    { profit: 4, greens: 25 },
  ]);
  assert.deepEqual(megaGale1.colorOnly, [
    { profit: 6, greens: 17 },
    { profit: 13, greens: 8 },
  ]);
  assert.equal(megaGale1.worstWithTie.greens - megaGale1.worstColorOnly.greens, 8);

  const megaGale2 = calculateColorComparison({
    stopWin: 100,
    rounds: [
      { color: 6.5, tie: 1.5 },
      { color: 19, tie: 5.5 },
      { color: 52.5, tie: 15 },
    ],
  });
  assert.deepEqual(megaGale2.withTie, [
    { profit: 5, greens: 20 },
    { profit: 5.5, greens: 19 },
    { profit: 5, greens: 20 },
  ]);
  assert.deepEqual(megaGale2.colorOnly, [
    { profit: 8, greens: 13 },
    { profit: 16.5, greens: 7 },
    { profit: 35, greens: 3 },
  ]);
  assert.equal(megaGale2.worstWithTie.greens, 20);
  assert.equal(megaGale2.worstColorOnly.greens, 13);

  const firstJ1 = calculateColorComparison({
    stopWin: 100,
    rounds: [{ color: 20, tie: 5 }],
  });
  assert.deepEqual(firstJ1.withTie, [{ profit: 15, greens: 7 }]);
  assert.deepEqual(firstJ1.colorOnly, [{ profit: 25, greens: 4 }]);

  const multipleRounds = calculateColorComparison({
    stopWin: 100,
    rounds: [
      { color: 3, tie: 0.5 },
      { color: 8.5, tie: 2.5 },
    ],
  });
  assert.deepEqual(multipleRounds.withTie, [
    { profit: 2.5, greens: 40 },
    { profit: 2.5, greens: 40 },
  ]);
  assert.deepEqual(multipleRounds.colorOnly, [
    { profit: 3.5, greens: 29 },
    { profit: 7.5, greens: 14 },
  ]);
  assert.deepEqual(multipleRounds.worstWithTie, { profit: 2.5, greens: 40 });
  assert.deepEqual(multipleRounds.worstColorOnly, { profit: 3.5, greens: 29 });
});

test("calculates Bac Bo comparison greens and worst cases", () => {
  const firstMargin = calculateColorComparison({
    stopWin: 100,
    rounds: [
      { color: 20, tie: 5 },
      { color: 60, tie: 15 },
    ],
  });
  assert.deepEqual(firstMargin.withTie, [
    { profit: 15, greens: 7 },
    { profit: 20, greens: 5 },
  ]);
  assert.deepEqual(firstMargin.colorOnly, [
    { profit: 25, greens: 4 },
    { profit: 50, greens: 2 },
  ]);
  assert.deepEqual(firstMargin.worstWithTie, { profit: 15, greens: 7 });
  assert.deepEqual(firstMargin.worstColorOnly, { profit: 25, greens: 4 });

  const secondMargin = calculateColorComparison({
    stopWin: 100,
    rounds: [
      { color: 45, tie: 5 },
      { color: 120, tie: 30 },
    ],
  });
  assert.deepEqual(secondMargin.withTie, [
    { profit: 40, greens: 3 },
    { profit: 40, greens: 3 },
  ]);
  assert.deepEqual(secondMargin.colorOnly, [
    { profit: 50, greens: 2 },
    { profit: 100, greens: 1 },
  ]);
  assert.deepEqual(secondMargin.worstWithTie, { profit: 40, greens: 3 });
  assert.deepEqual(secondMargin.worstColorOnly, { profit: 50, greens: 2 });
});

test("simulates Mega Sic Bac G1 with growing and fixed margin", () => {
  const roundsForMargin = (margin) => {
    const calculation = calculateMegaSicBac(margin);
    if (!calculation.valid) return null;
    return [
      { color: calculation.S1, tie: calculation.T1 },
      { color: calculation.S2, tie: calculation.T2 },
    ];
  };
  const parameters = {
    bankroll: 1000,
    stopLoss: 150,
    stopWin: 100,
    initialMargin: 75,
    minimumChip: 0.5,
    roundsForMargin,
  };
  const withTieWorst = simulateGrowingGreens({
    ...parameters,
    strategy: "withTie",
    outcome: "worst",
  });
  const withTieBest = simulateGrowingGreens({
    ...parameters,
    strategy: "withTie",
    outcome: "best",
  });
  const withTieFixed = simulateGrowingGreens({
    ...parameters,
    strategy: "withTie",
    outcome: "worst",
    adjustMargin: false,
  });
  const colorOnlyWorst = simulateGrowingGreens({
    ...parameters,
    strategy: "colorOnly",
    outcome: "worst",
  });
  const colorOnlyBest = simulateGrowingGreens({
    ...parameters,
    strategy: "colorOnly",
    outcome: "best",
  });
  const colorOnlyFixed = simulateGrowingGreens({
    ...parameters,
    strategy: "colorOnly",
    outcome: "worst",
    adjustMargin: false,
  });

  assert.equal(withTieWorst.greens, 7);
  assert.equal(withTieBest.greens, 7);
  assert.equal(withTieFixed.greens, 8);
  assert.deepEqual(
    withTieWorst.path.map(({ bankroll, margin, profit }) => [bankroll, margin, profit]),
    [
      [1000, 75, 12.5],
      [1012.5, 81, 14],
      [1026.5, 88, 15],
      [1041.5, 95.5, 16.5],
      [1058, 104, 17.5],
      [1075.5, 112.5, 19.5],
      [1095, 122.5, 21],
    ],
  );
  assert.equal(colorOnlyWorst.greens, 5);
  assert.equal(colorOnlyBest.greens, 3);
  assert.equal(colorOnlyFixed.greens, 6);
  assert.deepEqual(
    colorOnlyWorst.path.map(({ bankroll, margin, profit }) => [bankroll, margin, profit]),
    [
      [1000, 75, 18.5],
      [1018.5, 84, 21],
      [1039.5, 94.5, 23],
      [1062.5, 106, 26],
      [1088.5, 119, 29.5],
    ],
  );
});

test("simulates Bac Bo greens using the existing bankroll calculation", () => {
  const roundsForMargin = (margin) => {
    const calculation = calculateBankroll({
      bancaInicial: 0,
      saldoAtual: margin * 2,
      stopWinPercentual: 0,
      stopLossPercentual: 0,
      fichaMinima: 5,
      corPercentual: 90,
    });
    return [
      { color: calculation.entradaCor, tie: calculation.entradaEmpate },
      { color: calculation.g1Cor, tie: calculation.g1Empate },
    ];
  };
  const result = simulateGrowingGreens({
    bankroll: 1000,
    stopLoss: 200,
    stopWin: 100,
    initialMargin: 100,
    minimumChip: 5,
    strategy: "withTie",
    roundsForMargin,
  });

  assert.equal(result.greens, 5);
  assert.deepEqual(
    result.path.map(({ bankroll, margin, profit }) => [bankroll, margin, profit]),
    [
      [1000, 100, 20],
      [1020, 110, 20],
      [1040, 120, 25],
      [1065, 130, 30],
      [1095, 145, 30],
    ],
  );
});

test("returns a dash result when a margin has no valid motor combination", () => {
  const result = simulateGrowingGreens({
    bankroll: 1000,
    stopLoss: 150,
    stopWin: 100,
    initialMargin: 3,
    minimumChip: 0.5,
    strategy: "withTie",
    roundsForMargin: () => null,
  });

  assert.equal(result.greens, null);
  assert.deepEqual(result.path, []);
  assert.equal(result.reason, "invalid-calculation");
});

test("uses proportional margin growth when stop loss is unavailable or below M0", () => {
  const marginsWithoutStopLoss = [];
  simulateGrowingGreens({
    bankroll: 1000,
    stopLoss: 0,
    stopWin: 10,
    initialMargin: 100,
    minimumChip: 5,
    strategy: "withTie",
    roundsForMargin: (margin) => {
      marginsWithoutStopLoss.push(margin);
      return [{ color: 5, tie: 0 }];
    },
  });
  assert.deepEqual(marginsWithoutStopLoss, [100, 100]);

  const marginsAboveStopLoss = [];
  simulateGrowingGreens({
    bankroll: 1000,
    stopLoss: 100,
    stopWin: 10,
    initialMargin: 200,
    minimumChip: 5,
    strategy: "withTie",
    roundsForMargin: (margin) => {
      marginsAboveStopLoss.push(margin);
      return [{ color: 5, tie: 0 }];
    },
  });
  assert.deepEqual(marginsAboveStopLoss, [200, 200]);
});

test("applies goal tolerance only to the green-counting target", () => {
  const roundsForMargin = (margin) => {
    const calculation = calculateMegaSicBac(margin);
    if (!calculation.valid) return null;
    return [
      { color: calculation.S1, tie: calculation.T1 },
      { color: calculation.S2, tie: calculation.T2 },
    ];
  };
  const parameters = {
    bankroll: 1000,
    stopLoss: 150,
    stopWin: 100,
    initialMargin: 75,
    minimumChip: 0.5,
    roundsForMargin,
  };
  const adjusted = simulateGrowingGreens({
    ...parameters,
    tolerance: 0.1,
    strategy: "withTie",
    outcome: "worst",
  });
  const fixed = simulateGrowingGreens({
    ...parameters,
    tolerance: 0.1,
    strategy: "withTie",
    outcome: "worst",
    adjustMargin: false,
  });
  const noTolerance = simulateGrowingGreens({
    ...parameters,
    tolerance: 0,
    strategy: "withTie",
    outcome: "worst",
  });

  assert.equal(adjusted.greens, 6);
  assert.equal(adjusted.path.at(-1).bankrollAfter, 1095);
  assert.equal(adjusted.effectiveStopWin, 90);
  assert.equal(adjusted.stopWin, 100);
  assert.equal(fixed.greens, 8);
  assert.equal(noTolerance.greens, 7);
});

test("tolerance zero preserves previous Mega and Bac Bo green counts", () => {
  const megaRounds = (margin) => {
    const calculation = calculateMegaSicBac(margin);
    return calculation.valid
      ? [
        { color: calculation.S1, tie: calculation.T1 },
        { color: calculation.S2, tie: calculation.T2 },
      ]
      : null;
  };
  const bacBoRounds = (margin) => {
    const calculation = calculateBankroll({
      bancaInicial: 0,
      saldoAtual: margin * 2,
      stopWinPercentual: 0,
      stopLossPercentual: 0,
      fichaMinima: 5,
      corPercentual: 90,
    });
    return [
      { color: calculation.entradaCor, tie: calculation.entradaEmpate },
      { color: calculation.g1Cor, tie: calculation.g1Empate },
    ];
  };
  const run = (roundsForMargin, strategy) => simulateGrowingGreens({
    bankroll: 1000,
    stopLoss: 200,
    stopWin: 100,
    initialMargin: roundsForMargin === megaRounds ? 75 : 100,
    minimumChip: roundsForMargin === megaRounds ? 0.5 : 5,
    tolerance: 0,
    strategy,
    roundsForMargin,
  }).greens;

  assert.equal(run(megaRounds, "withTie"), 7);
  assert.equal(run(megaRounds, "colorOnly"), 5);
  assert.equal(run(bacBoRounds, "withTie"), 5);
  assert.equal(run(bacBoRounds, "colorOnly"), 3);
});
