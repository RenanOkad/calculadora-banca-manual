function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

export function parseDecimal(value) {
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return 0;

  return finiteOrZero(Number(normalized));
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateMegaSicBac(margin) {
  const availableMargin = Math.max(0, finiteOrZero(margin));
  const chipSize = 0.5;
  const availableChips = availableMargin / chipSize;
  const chipRoundingTolerance = Number.EPSILON * Math.max(1, Math.abs(availableChips)) * 2;
  const totalMargin = roundMoney(
    Math.floor(availableChips + chipRoundingTolerance) * chipSize,
  );
  const unusedMargin = roundMoney(Math.max(0, availableMargin - totalMargin));
  const marginSummary = {
    availableMargin: roundMoney(availableMargin),
    margin: totalMargin,
    unusedMargin,
  };

  if (availableMargin <= 0) {
    return { valid: false, reason: "positive-margin", ...marginSummary };
  }

  const firstTieUnits = totalMargin / 14.3;
  const lowerUnits = Math.floor(firstTieUnits);
  const fraction = firstTieUnits - lowerUnits;
  const roundingTolerance = Number.EPSILON * Math.max(1, Math.abs(firstTieUnits)) * 2;
  const roundedTieUnits = fraction <= 0.5 + roundingTolerance ? lowerUnits : lowerUnits + 1;
  const T1 = Math.max(chipSize, roundedTieUnits * chipSize);
  const S1 = roundMoney(6 * T1);
  const remaining = roundMoney(totalMargin - (7 * T1));

  if (remaining < 0) {
    return { valid: false, reason: "margin-too-small", ...marginSummary };
  }

  const targetTie2 = (2 * remaining) / 9;
  const targetTieUnits = targetTie2 / chipSize;
  const targetTolerance = Number.EPSILON * Math.max(1, Math.abs(targetTieUnits)) * 2;
  const lowerTie2 = Math.floor(targetTieUnits + targetTolerance) * chipSize;
  const upperTie2 = Math.ceil(targetTieUnits - targetTolerance) * chipSize;
  const candidates = [...new Set([lowerTie2, upperTie2])]
    .map((tie) => Math.min(remaining, Math.max(0, roundMoney(tie))))
    .map((T2) => {
      const S2 = roundMoney(remaining - T2);
      const profitSide2 = roundMoney((2 * S2) - totalMargin);
      const profitTie2 = roundMoney((7 * T2) - totalMargin);
      return { T2, S2, profitSide2, profitTie2, minimumProfit: Math.min(profitSide2, profitTie2) };
    });
  const bestGale = candidates.reduce((best, candidate) =>
    candidate.minimumProfit > best.minimumProfit ? candidate : best,
  );
  const total1 = roundMoney(S1 + T1);
  const total2 = roundMoney(bestGale.S2 + bestGale.T2);
  const total = roundMoney(total1 + total2);
  const profitSide1 = roundMoney(S1 - T1);
  const profitTie1 = roundMoney((6 * T1) - S1);

  return {
    valid: true,
    warning: bestGale.minimumProfit <= 0 ? "gale-no-positive-profit" : null,
    ...marginSummary,
    S1,
    T1,
    S2: bestGale.S2,
    T2: bestGale.T2,
    total1,
    total2,
    total,
    profitSide1,
    profitTie1,
    profitSide2: bestGale.profitSide2,
    profitTie2: bestGale.profitTie2,
    maxLoss: roundMoney(totalMargin),
  };
}

export function calculateBankroll({
  bancaInicial,
  saldoAtual,
  stopWinPercentual,
  stopLossPercentual,
  fichaMinima,
  corPercentual,
  tomouRed = false,
}) {
  const initialBankroll = finiteOrZero(bancaInicial);
  const currentBalance = finiteOrZero(saldoAtual);
  const minimumChip = finiteOrZero(fichaMinima);
  const colorPercentage = Math.min(100, Math.max(0, finiteOrZero(corPercentual)));
  const tiePercentage = 100 - colorPercentage;

  const margemOriginal = finiteOrZero(
    initialBankroll * (finiteOrZero(stopLossPercentual) / 100),
  );
  const lucroAcumulado = finiteOrZero(currentBalance - initialBankroll);
  const margemAtual = Math.max(0, finiteOrZero(margemOriginal + lucroAcumulado));
  const percentualDeRisco = tomouRed ? 1 : 0.5;
  const orcamentoDeRisco = finiteOrZero(margemAtual * percentualDeRisco);
  const totalEntradaBruto = finiteOrZero(orcamentoDeRisco * 0.3);
  const totalG1Bruto = finiteOrZero(orcamentoDeRisco * 0.7);

  const roundDownToChip = (amount) => {
    if (minimumChip <= 0) return amount;
    const units = amount / minimumChip;
    if (!Number.isFinite(units)) return amount;
    const roundingTolerance = Number.EPSILON * Math.max(1, Math.abs(units)) * 2;
    const rounded = Math.floor(units + roundingTolerance) * minimumChip;
    return finiteOrZero(Math.max(rounded, minimumChip));
  };

  const entradaCor = roundDownToChip(totalEntradaBruto * (colorPercentage / 100));
  const entradaEmpate = roundDownToChip(totalEntradaBruto * (tiePercentage / 100));
  const g1Cor = roundDownToChip(totalG1Bruto * (colorPercentage / 100));
  const g1Empate = roundDownToChip(totalG1Bruto * (tiePercentage / 100));
  const totalEntrada = finiteOrZero(entradaCor + entradaEmpate);
  const totalG1 = finiteOrZero(g1Cor + g1Empate);
  const riscoTotalReal = finiteOrZero(totalEntrada + totalG1);

  const ganhoEsperado = finiteOrZero(
    initialBankroll * (finiteOrZero(stopWinPercentual) / 100),
  );
  const valorFinalEsperado = finiteOrZero(initialBankroll + ganhoEsperado);
  const stopValor = finiteOrZero(initialBankroll - margemOriginal);
  const resultado = finiteOrZero(currentBalance - initialBankroll);
  const percentualResultado = initialBankroll === 0
    ? 0
    : finiteOrZero((resultado / initialBankroll) * 100);
  const faltaParaGanho = Math.max(0, finiteOrZero(ganhoEsperado - resultado));

  return {
    margemOriginal,
    margemAtual,
    percentualDeRisco,
    orcamentoDeRisco,
    totalEntradaBruto,
    totalG1Bruto,
    corPercentual: colorPercentage,
    empatePercentual: tiePercentage,
    entradaCor,
    entradaEmpate,
    g1Cor,
    g1Empate,
    totalEntrada,
    totalG1,
    riscoTotalReal,
    ganhoEsperado,
    valorFinalEsperado,
    stopValor,
    resultado,
    percentualResultado,
    faltaParaGanho,
  };
}
