import "./style.css";
import {
  calculateBankroll,
  calculateColorComparison,
  calculateGreensProgression,
  calculateMegaSicBac,
  calculateMegaSicBacGale2,
  parseDecimal,
  simulateGrowingGreens,
} from "./calculadora.js";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fields = {
  bancaInicial: document.querySelector("#bancaInicial"),
  saldoAtual: document.querySelector("#saldoAtual"),
  stopWin: document.querySelector("#stopWin"),
  stopLoss: document.querySelector("#stopLoss"),
  fichaMinima: document.querySelector("#fichaMinima"),
  corPercentual: document.querySelector("#corPercentual"),
};
const outputs = [
  "margemAtual",
  "margemOriginal",
  "entradaCor",
  "entradaEmpate",
  "g1Cor",
  "g1Empate",
  "orcamentoRisco",
  "totalEntrada",
  "totalG1",
  "riscoTotalReal",
  "ganhoEsperado",
  "faltaParaGanho",
  "valorFinalEsperado",
  "stopValor",
];
const game = document.querySelector("#game");
const redToggle = document.querySelector("#redToggle");
const megaModeControl = document.querySelector("#megaModeControl");
const megaModeToggle = document.querySelector("#megaModeToggle");
const megaResults = document.querySelector("#megaResults");
const standardResults = document.querySelector("#standardResults");
const gale1Option = document.querySelector("#gale1Option");
const gale2Option = document.querySelector("#gale2Option");
const megaTieRuleControl = document.querySelector("#megaTieRuleControl");
const megaTieRule = document.querySelector("#megaTieRule");
const adjustMarginSelect = document.querySelector("#adjustMargin");
let tomouRed = false;
let megaModeEnabled = false;
let megaProgression = "gale1";
let goalTolerance = 10;
const selectedQuickStops = new Map();
const GREEN_THRESHOLDS = { green: 4, amber: 8 };

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatSignedCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (safeValue > 0) return `+${formatCurrency(safeValue)}`;
  if (safeValue < 0) return `−${formatCurrency(Math.abs(safeValue))}`;
  return formatCurrency(0);
}

function formatSignedPercent(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue > 0 ? "+" : safeValue < 0 ? "−" : "";
  return `${sign}${percentFormatter.format(Math.abs(safeValue))}%`;
}

function renderMegaCalculation(margin) {
  const isGale2 = megaProgression === "gale2";
  const calculation = isGale2
    ? calculateMegaSicBacGale2(margin)
    : calculateMegaSicBac(margin, megaTieRule.value);
  document.querySelector("#megaMargin").textContent = formatCurrency(calculation.margin);
  document.querySelector("#megaUnusedMargin").textContent =
    formatCurrency(calculation.unusedMargin);
  document.querySelector("#mega-results-title").textContent =
    isGale2 ? "Jogada 1 + Gale 1 + Gale 2" : "Jogada 1 + Gale 1";

  const warning = document.querySelector("#megaWarning");
  const calculationContent = document.querySelector("#megaCalculation");
  const warningMessages = {
    "positive-margin": "Informe um orçamento de risco maior que zero para calcular as apostas.",
    "margin-too-small": "Margem muito pequena para reservar a jogada 1 e fechar o gale. Use pelo menos R$ 3,50.",
    "gale-no-positive-profit": "Margem pequena: o Gale 1 não fecha lucro positivo em ambos os resultados. A perda máxima permanece igual a M.",
    "gale2-no-positive-profit": "A margem é pequena demais para fechar o Gale 2 com lucro em todas as rodadas.",
  };

  warning.hidden = !calculation.reason && !calculation.warning;
  warning.textContent = warningMessages[calculation.reason ?? calculation.warning] ?? "";
  warning.classList.toggle("is-error", Boolean(calculation.reason));
  calculationContent.hidden = !calculation.valid;
  document.querySelector("#megaStage3").hidden = !isGale2;
  document.querySelector("#megaStages").classList.toggle("has-gale2", isGale2);
  document.querySelector("#megaTotalLabel").textContent = isGale2
    ? "Total das apostas (S1 + T1 + S2 + T2 + S3 + T3)"
    : "Total das apostas (S1 + T1 + S2 + T2)";
  document.querySelector("#megaMaxLossLabel").textContent = isGale2
    ? "Prejuízo máximo se perder também no Gale 2"
    : "Prejuízo máximo se perder também no gale";

  if (!calculation.valid) return calculation;

  const values = {
    megaS1: calculation.S1,
    megaT1: calculation.T1,
    megaS2: calculation.S2,
    megaT2: calculation.T2,
    megaTotal1: calculation.total1,
    megaTotal2: calculation.total2,
    megaTotal: calculation.total,
    megaMaxLoss: calculation.maxLoss,
    megaUnusedMargin: calculation.unusedMargin,
  };
  if (isGale2) {
    Object.assign(values, {
      megaS3: calculation.S3,
      megaT3: calculation.T3,
      megaTotal3: calculation.total3,
    });
  }
  Object.entries(values).forEach(([id, value]) => {
    document.getElementById(id).textContent = formatCurrency(value);
  });

  const profits = {
    megaProfitSide1: calculation.profitSide1,
    megaProfitTie1: calculation.profitTie1,
    megaProfitSide2: calculation.profitSide2,
    megaProfitTie2: calculation.profitTie2,
  };
  if (isGale2) {
    Object.assign(profits, {
      megaProfitSide3: calculation.profitSide3,
      megaProfitTie3: calculation.profitTie3,
    });
  }
  Object.entries(profits).forEach(([id, value]) => {
    const element = document.getElementById(id);
    element.textContent = formatSignedCurrency(value);
    element.classList.toggle("is-negative", value < 0);
    element.classList.toggle("is-positive", value > 0);
  });

  return calculation;
}

function getGreensTone(greens) {
  if (greens === null) return "";
  if (greens <= GREEN_THRESHOLDS.green) return "tone-green";
  if (greens <= GREEN_THRESHOLDS.amber) return "tone-amber";
  return "tone-red";
}

function formatGreens(greens) {
  return greens === null ? "Não alcança" : `${greens} ${greens === 1 ? "green" : "greens"}`;
}

function renderQuickStops() {
  const initialBankroll = parseDecimal(fields.bancaInicial.value);
  document.querySelectorAll(".quick-stop-controls").forEach((control) => {
    const fieldName = control.dataset.field;
    const field = fields[fieldName];
    const percent = parseDecimal(field.value);
    control.querySelector(".quick-stop-value").textContent =
      `Valor: ${formatCurrency(initialBankroll * percent / 100)}`;
    control.querySelectorAll(".quick-stop-button").forEach((button) => {
      const selected = selectedQuickStops.get(fieldName) === Number(button.dataset.percent);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  });
}

function getRoundsForMargin(margin, isMegaSicBac, colorPercent) {
  if (!Number.isFinite(margin) || margin <= 0) return null;

  if (isMegaSicBac) {
    const calculation = megaProgression === "gale2"
      ? calculateMegaSicBacGale2(margin)
      : calculateMegaSicBac(margin, megaTieRule.value);
    if (!calculation.valid) return null;

    const rounds = [
      { name: "J1", color: calculation.S1, tie: calculation.T1 },
      { name: "G1", color: calculation.S2, tie: calculation.T2 },
    ];
    if (megaProgression === "gale2") {
      rounds.push({ name: "G2", color: calculation.S3, tie: calculation.T3 });
    }
    return rounds;
  }

  const calculation = calculateBankroll({
    bancaInicial: 0,
    saldoAtual: margin * (tomouRed ? 1 : 2),
    stopWinPercentual: 0,
    stopLossPercentual: 0,
    fichaMinima: 5,
    corPercentual: colorPercent,
    tomouRed,
  });
  return [
    { name: "J1", color: calculation.entradaCor, tie: calculation.entradaEmpate },
    { name: "G1", color: calculation.g1Cor, tie: calculation.g1Empate },
  ];
}

function renderComparisonTable(rounds, comparison) {
  const rows = document.querySelector("#comparisonRows");
  rows.replaceChildren();

  rounds.forEach((round, index) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.textContent = round.name;
    const totalCell = document.createElement("td");
    totalCell.textContent = formatCurrency(round.color + round.tie);
    row.append(nameCell, totalCell);
    [comparison.withTie[index], comparison.colorOnly[index]].forEach((outcome) => {
      const cell = document.createElement("td");
      appendProfitGreens(cell, outcome);
      row.append(cell);
    });
    rows.append(row);
  });

  const withTieWorst = document.querySelector("#comparisonWithTieWorst");
  const colorOnlyWorst = document.querySelector("#comparisonColorOnlyWorst");
  withTieWorst.replaceChildren();
  colorOnlyWorst.replaceChildren();
  appendProfitGreens(withTieWorst, comparison.worstWithTie);
  appendProfitGreens(colorOnlyWorst, comparison.worstColorOnly);

  const difference = comparison.worstWithTie.greens === null
    || comparison.worstColorOnly.greens === null
    ? null
    : comparison.worstWithTie.greens - comparison.worstColorOnly.greens;
  const differenceCell = document.querySelector("#comparisonDifference");
  differenceCell.textContent = difference === null
    ? "—"
    : difference > 0
      ? `${difference} ${difference === 1 ? "green" : "greens"} a menos`
      : difference < 0
        ? `${Math.abs(difference)} ${Math.abs(difference) === 1 ? "green" : "greens"} a mais`
        : "0 greens";
  differenceCell.className = difference > 0 ? "tone-green" : difference < 0 ? "tone-red" : "";
}

function appendProfitGreens(container, outcome) {
  const profit = document.createElement("span");
  profit.textContent = formatSignedCurrency(outcome.profit);
  const greens = document.createElement("strong");
  greens.textContent = formatGreens(outcome.greens);
  const tone = getGreensTone(outcome.greens);
  if (tone) greens.classList.add(tone);
  container.append(profit, document.createTextNode(" · "), greens);
}

function renderSimulationPath(strategy, simulation, { bankroll, stopWin, tolerance }) {
  const prefix = strategy === "withTie" ? "withTie" : "colorOnly";
  const toggle = document.querySelector(`#${prefix}PathToggle`);
  const path = document.querySelector(`#${prefix}Path`);
  const tableBody = document.querySelector(`#${prefix}PathRows`);
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  tableBody.replaceChildren();

  simulation.path.forEach((step) => {
    const row = document.createElement("tr");
    const goalReached = step.bankrollAfter >= bankroll + stopWin * (1 - tolerance);
    if (goalReached) row.classList.add("goal-reached");
    [
      String(step.green),
      formatCurrency(step.bankroll),
      formatCurrency(step.margin),
      formatSignedCurrency(step.profit),
    ].forEach((text) => {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    });
    const afterCell = document.createElement("td");
    afterCell.textContent = formatCurrency(step.bankrollAfter);
    if (goalReached) {
      const shortfall = Math.max(0, stopWin - (step.bankrollAfter - bankroll));
      const detail = document.createElement("small");
      detail.className = "goal-shortfall";
      detail.textContent = `Meta efetiva · faltam ${formatCurrency(shortfall)} para o stop win`;
      afterCell.append(document.createElement("br"), detail);
    }
    row.append(afterCell);
    tableBody.append(row);
  });

  toggle.hidden = simulation.path.length === 0;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.textContent = expanded ? "Ocultar caminho" : "Ver caminho";
  path.hidden = !expanded || simulation.path.length === 0;
}

function renderSimulationBlock({
  strategy,
  activeWorst,
  activeBest,
  fixedWorst,
  isAdjusting,
  bankroll,
  stopWin,
  tolerance,
}) {
  const prefix = strategy === "withTie" ? "withTie" : "colorOnly";
  const greens = document.querySelector(`#${prefix}SimulationGreens`);
  const label = document.querySelector(`#${prefix}SimulationLabel`);
  const details = document.querySelector(`#${prefix}SimulationDetails`);
  greens.textContent = formatGreens(activeWorst.greens);
  greens.className = `simulation-greens ${getGreensTone(activeWorst.greens)}`;
  label.textContent = `Pior caso ${isAdjusting ? "com" : "sem"} reajuste`;
  details.textContent = isAdjusting
    ? `melhor caso: ${formatGreens(activeBest.greens)} · sem reajuste: ${formatGreens(fixedWorst.greens)}`
    : `melhor caso: ${formatGreens(activeBest.greens)} · sem reajuste: ${formatGreens(activeWorst.greens)}`;
  renderSimulationPath(strategy, activeWorst, { bankroll, stopWin, tolerance });
}

function renderInsights(result, showMegaCalculation, megaCalculation) {
  const initialBankroll = parseDecimal(fields.bancaInicial.value);
  const stopWin = initialBankroll * parseDecimal(fields.stopWin.value) / 100;
  const effectiveStopWin = stopWin * (1 - goalTolerance / 100);
  const stopLoss = initialBankroll * parseDecimal(fields.stopLoss.value) / 100;
  const isMegaSicBac = game.value === "mega-sic-bac";
  const colorPercent = parseDecimal(fields.corPercentual.value);
  let margin = showMegaCalculation
    ? megaCalculation.margin
    : result.orcamentoDeRisco;
  if (isMegaSicBac && !showMegaCalculation) {
    const currentMega = megaProgression === "gale2"
      ? calculateMegaSicBacGale2(margin)
      : calculateMegaSicBac(margin, megaTieRule.value);
    margin = currentMega.margin;
  }
  const rounds = getRoundsForMargin(margin, isMegaSicBac, colorPercent) ?? [];
  const levels = isMegaSicBac && megaProgression === "gale2" ? 3 : 2;
  const progression = calculateGreensProgression({
    margin,
    stopWin,
    stopLoss,
    minimumChip: isMegaSicBac ? 0.5 : 5,
    levels,
  });
  const greensRequired = document.querySelector("#greensRequired");
  greensRequired.textContent = formatGreens(progression.greens);
  greensRequired.className = getGreensTone(progression.greens);
  document.querySelector("#greenProfit").textContent = formatCurrency(progression.profitPerGreen);
  document.querySelector("#greenStakes").textContent = progression.stakes
    .map(formatCurrency)
    .join(" / ");
  document.querySelector("#greenMargin").textContent = formatCurrency(progression.usedMargin);
  document.querySelector("#completeLosses").textContent =
    progression.completeLosses === null ? "—" : String(progression.completeLosses);
  document.querySelector("#lossWarning").hidden =
    progression.completeLosses !== 0 || progression.usedMargin <= 0;

  document.querySelector("#effectiveGoalAmount").textContent = formatCurrency(effectiveStopWin);
  document.querySelector("#effectiveGoalRate").textContent =
    `(${100 - goalTolerance}% de ${formatCurrency(stopWin)})`;
  const comparison = calculateColorComparison({ stopWin: effectiveStopWin, rounds });
  renderComparisonTable(rounds, comparison);
  const warning = !isMegaSicBac
    ? "Sem a aposta no empate, o empate devolve só 90% da cor (perda de 10%) e você perde o seguro do empate."
    : "Sem a aposta no empate, a cor perde no empate e a chance de perder o ciclo aumenta.";
  document.querySelector("#colorOnlyWarning").textContent = warning;

  const cache = new Map();
  const roundsForMargin = (nextMargin) => {
    const cacheKey = String(nextMargin);
    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, getRoundsForMargin(nextMargin, isMegaSicBac, colorPercent));
    }
    return cache.get(cacheKey);
  };
  const baseSimulation = {
    bankroll: initialBankroll,
    stopLoss,
    stopWin,
    tolerance: goalTolerance / 100,
    initialMargin: margin,
    minimumChip: isMegaSicBac ? 0.5 : 5,
    roundsForMargin,
  };
  const isAdjusting = adjustMarginSelect.value === "yes";
  ["withTie", "colorOnly"].forEach((strategy) => {
    const adjustedWorst = simulateGrowingGreens({
      ...baseSimulation,
      strategy,
      outcome: "worst",
      adjustMargin: true,
    });
    const adjustedBest = simulateGrowingGreens({
      ...baseSimulation,
      strategy,
      outcome: "best",
      adjustMargin: true,
    });
    const fixedWorst = simulateGrowingGreens({
      ...baseSimulation,
      strategy,
      outcome: "worst",
      adjustMargin: false,
    });
    const fixedBest = simulateGrowingGreens({
      ...baseSimulation,
      strategy,
      outcome: "best",
      adjustMargin: false,
    });
    renderSimulationBlock({
      strategy,
      activeWorst: isAdjusting ? adjustedWorst : fixedWorst,
      activeBest: isAdjusting ? adjustedBest : fixedBest,
      fixedWorst,
      isAdjusting,
      bankroll: initialBankroll,
      stopWin,
      tolerance: goalTolerance / 100,
    });
  });
}

function render() {
  const result = calculateBankroll({
    bancaInicial: parseDecimal(fields.bancaInicial.value),
    saldoAtual: parseDecimal(fields.saldoAtual.value),
    stopWinPercentual: parseDecimal(fields.stopWin.value),
    stopLossPercentual: parseDecimal(fields.stopLoss.value),
    fichaMinima: parseDecimal(fields.fichaMinima.value),
    corPercentual: parseDecimal(fields.corPercentual.value),
    tomouRed,
  });

  const isMegaSicBac = game.value === "mega-sic-bac";
  megaModeControl.hidden = !isMegaSicBac;
  megaModeToggle.setAttribute("aria-pressed", String(megaModeEnabled));
  megaModeToggle.setAttribute(
    "aria-label",
    `Cálculo Mega Sic Bac: ${megaModeEnabled ? "ligado" : "desligado"}`,
  );
  document.querySelector("#megaModeState").textContent = megaModeEnabled ? "Ligado" : "Desligado";
  const showMegaCalculation = isMegaSicBac && megaModeEnabled;
  standardResults.hidden = showMegaCalculation;
  megaResults.hidden = !showMegaCalculation;
  gale1Option.classList.toggle("is-selected", megaProgression === "gale1");
  gale2Option.classList.toggle("is-selected", megaProgression === "gale2");
  gale1Option.setAttribute("aria-pressed", String(megaProgression === "gale1"));
  gale2Option.setAttribute("aria-pressed", String(megaProgression === "gale2"));
  megaTieRuleControl.hidden = megaProgression !== "gale1";

  const megaCalculation = showMegaCalculation
    ? renderMegaCalculation(result.orcamentoDeRisco)
    : null;

  outputs.forEach((key) => {
    const element = document.getElementById(key);
    const resultKey = {
      orcamentoRisco: "orcamentoDeRisco",
      totalEntrada: "totalEntradaBruto",
      totalG1: "totalG1Bruto",
    }[key] ?? key;
    element.textContent = formatCurrency(result[resultKey]);
  });

  document.querySelector("#empatePercentual").textContent =
    `${percentFormatter.format(result.empatePercentual).replace(/,00$/, "")}%`;
  document.querySelector("#resultado").textContent = formatSignedCurrency(result.resultado);
  document.querySelector("#percentualResultado").textContent =
    formatSignedPercent(result.percentualResultado);
  document.querySelector("#resultadoContainer").classList.toggle("is-negative", result.resultado < 0);
  document.querySelector("#resultadoContainer").classList.toggle("is-positive", result.resultado > 0);
  renderQuickStops();
  renderInsights(result, showMegaCalculation, megaCalculation);
}

Object.entries(fields).forEach(([name, field]) => {
  field.addEventListener("input", () => {
    if (name === "stopWin" || name === "stopLoss") selectedQuickStops.delete(name);
    render();
  });
});

Object.entries({ stopWin: fields.stopWin, stopLoss: fields.stopLoss }).forEach(([name, field]) => {
  document.querySelector(`.quick-stop-controls[data-field="${name}"]`)
    .addEventListener("click", (event) => {
      const button = event.target.closest(".quick-stop-button");
      if (!button) return;
      const percent = Number(button.dataset.percent);
      field.value = String(percent);
      selectedQuickStops.set(name, percent);
      render();
    });
});

fields.corPercentual.addEventListener("change", () => {
  const parsed = parseDecimal(fields.corPercentual.value);
  fields.corPercentual.value = String(Math.min(100, Math.max(0, parsed)));
  render();
});

game.addEventListener("change", () => {
  const selected = game.selectedOptions[0];
  fields.fichaMinima.value = selected.dataset.chip;
  fields.corPercentual.value = selected.dataset.color;
  megaModeEnabled = game.value === "mega-sic-bac";
  render();
});

megaModeToggle.addEventListener("click", () => {
  megaModeEnabled = !megaModeEnabled;
  render();
});

gale1Option.addEventListener("click", () => {
  megaProgression = "gale1";
  render();
});

gale2Option.addEventListener("click", () => {
  megaProgression = "gale2";
  render();
});

megaTieRule.addEventListener("change", render);
adjustMarginSelect.addEventListener("change", render);

document.querySelectorAll(".goal-tolerance-button").forEach((button) => {
  button.addEventListener("click", () => {
    goalTolerance = Number(button.dataset.tolerance);
    document.querySelectorAll(".goal-tolerance-button").forEach((option) => {
      const selected = Number(option.dataset.tolerance) === goalTolerance;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    render();
  });
});

["withTie", "colorOnly"].forEach((prefix) => {
  const toggle = document.querySelector(`#${prefix}PathToggle`);
  const path = document.querySelector(`#${prefix}Path`);
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Ocultar caminho" : "Ver caminho";
    path.hidden = !expanded;
  });
});

redToggle.addEventListener("click", () => {
  tomouRed = !tomouRed;
  redToggle.setAttribute("aria-pressed", String(tomouRed));
  redToggle.setAttribute("aria-label", `Tomei red: ${tomouRed ? "ligado" : "desligado"}`);
  document.querySelector("#toggleState").textContent = tomouRed ? "Ligado" : "Desligado";
  document.querySelector("#risk-mode-description").textContent =
    `Orçamento de risco em ${tomouRed ? "100%" : "50%"} da margem`;
  render();
});

render();
