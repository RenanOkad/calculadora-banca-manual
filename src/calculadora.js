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
  const marginUnits = Math.floor(availableChips + chipRoundingTolerance);
  const totalMargin = roundMoney(marginUnits * chipSize);
  const unusedMargin = roundMoney(Math.max(0, availableMargin - totalMargin));
  const marginSummary = {
    availableMargin: roundMoney(availableMargin),
    margin: totalMargin,
    unusedMargin,
  };

  if (availableMargin <= 0) {
    return { valid: false, reason: "positive-margin", ...marginSummary };
  }

  let best = null;
  const maxT1Units = Math.floor(marginUnits / 7);

  for (let t1Units = 1; t1Units <= maxT1Units; t1Units += 1) {
    for (let s1Units = 1; s1Units <= 6 * t1Units; s1Units += 1) {
      const remainingUnits = marginUnits - t1Units - s1Units;
      if (remainingUnits < 2) continue;

      const idealT2Units = (2 * remainingUnits) / 9;
      const minimumT2Units = Math.max(1, Math.floor(idealT2Units) - 3);
      const maximumT2Units = Math.min(
        remainingUnits - 1,
        Math.ceil(idealT2Units) + 3,
      );

      for (let t2Units = minimumT2Units; t2Units <= maximumT2Units; t2Units += 1) {
        const s2Units = remainingUnits - t2Units;
        if (s2Units < 1) continue;

        const profits = [
          s1Units - t1Units,
          (2 * s2Units) - marginUnits,
          (7 * t2Units) - marginUnits,
        ];
        const minimumProfit = Math.min(...profits);
        const profitSpread = Math.max(...profits) - minimumProfit;
        const candidate = {
          t1Units,
          s1Units,
          t2Units,
          s2Units,
          minimumProfit,
          profitSpread,
        };

        if (
          best === null
          || candidate.minimumProfit > best.minimumProfit
          || (
            candidate.minimumProfit === best.minimumProfit
            && (
              candidate.profitSpread < best.profitSpread
              || (
                candidate.profitSpread === best.profitSpread
                && (
                  candidate.s1Units > best.s1Units
                  || (
                    candidate.s1Units === best.s1Units
                    && (
                      candidate.t1Units > best.t1Units
                      || (
                        candidate.t1Units === best.t1Units
                        && (
                          candidate.s2Units > best.s2Units
                          || (
                            candidate.s2Units === best.s2Units
                            && candidate.t2Units > best.t2Units
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        ) {
          best = candidate;
        }
      }
    }
  }

  if (best === null) {
    return { valid: false, reason: "margin-too-small", ...marginSummary };
  }

  const S1 = roundMoney(best.s1Units * chipSize);
  const T1 = roundMoney(best.t1Units * chipSize);
  const S2 = roundMoney(best.s2Units * chipSize);
  const T2 = roundMoney(best.t2Units * chipSize);
  const total1 = roundMoney(S1 + T1);
  const total2 = roundMoney(S2 + T2);
  const total = roundMoney(total1 + total2);
  const profitSide1 = roundMoney(S1 - T1);
  const profitTie1 = roundMoney((6 * T1) - S1);
  const profitSide2 = roundMoney((2 * S2) - totalMargin);
  const profitTie2 = roundMoney((7 * T2) - totalMargin);

  return {
    valid: true,
    warning: best.minimumProfit <= 0 ? "gale-no-positive-profit" : null,
    ...marginSummary,
    S1,
    T1,
    S2,
    T2,
    total1,
    total2,
    total,
    profitSide1,
    profitTie1,
    profitSide2,
    profitTie2,
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
