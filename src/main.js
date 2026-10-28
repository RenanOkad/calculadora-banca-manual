import "./style.css";
import {
  calculateBankroll,
  calculateMegaSicBac,
  calculateMegaSicBacGale2,
  parseDecimal,
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
let tomouRed = false;
let megaModeEnabled = false;
let megaProgression = "gale1";

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
    : calculateMegaSicBac(margin);
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

  if (!calculation.valid) return;

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

  if (showMegaCalculation) {
    renderMegaCalculation(result.orcamentoDeRisco);
  }

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
}

Object.values(fields).forEach((field) => field.addEventListener("input", render));

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
