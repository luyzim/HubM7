const MAX_RANGE_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHART_COLORS = ["#60a5fa", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const chartInstances = new Map();

const ENDPOINT_LABELS = {
  "POST /api/mkt": "Gera Script Mikrotik",
  "/api/mkt": "Gera Script Mikrotik",
  "POST /api/wiki": "Documentacao Wiki",
  "/api/wiki": "Documentacao Wiki",
  "POST /api/mkt/mensagem": "Gera Mensagem Mikrotik",
  "/api/mkt/mensagem": "Gera Mensagem Mikrotik",
  "POST /api/comandos-mkt/scan-super": "Descobre Gary Plankton",
  "/api/comandos-mkt/scan-super": "Descobre Gary Plankton",
  "POST /api/ccsFortgate": "Gera Config FW CCS",
  "/api/ccsFortgate": "Gera Config FW CCS",
  "POST /api/4g": "Reboot 4G RoyalFic",
  "/api/4g": "Reboot 4G RoyalFic",
  "POST /api/unimed": "Libera IP UNIMED",
  "/api/unimed": "Libera IP UNIMED",
  "POST /api/bkpMkt": "Boas Praticas MKT",
  "/api/bkpMkt": "Boas Praticas MKT",
  "POST /api/mkt/gerawiki": "Gera Documentacao",
  "/api/mkt/gerawiki": "Gera Documentacao",
  "POST /api/oxidized/generate": "Gera Backup",
  "/api/oxidized/generate": "Gera Backup",
  "POST /api/comandos-oxidized/run": "Backup Oxidized",
  "/api/comandos-oxidized/run": "Backup Oxidized",
  "DELETE /tickets/:id" : "Exclusões",
  "POST /tickets" : "Criações",
  "PUT /tickets/:id" : "Atualizações",
};

function getElement(id) {
  return document.getElementById(id);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const nextDate = startOfDay(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  if (!DATE_RE.test(String(value || ""))) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || formatIsoDate(parsed) !== value) {
    return null;
  }

  return startOfDay(parsed);
}

function diffDaysInclusive(fromDate, toDate) {
  return Math.floor((startOfDay(toDate) - startOfDay(fromDate)) / MS_PER_DAY) + 1;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumberFormat(value) {
  return toNumber(value).toLocaleString("pt-BR");
}

function endpointLabel(value) {
  const raw = String(value || "").trim();
  const pathOnly = raw.replace(/^(GET|POST|PUT|DELETE|PATCH|HEAD)\s+/i, "");
  return ENDPOINT_LABELS[raw] || ENDPOINT_LABELS[pathOnly] || raw || "Acao nao informada";
}

function normalizeUserKey(value) {
  return String(value || "").trim().toLowerCase();
}

function renderKpiCard(title, value, suffix = "") {
  return `
    <div class="kpi-card">
      <div class="label">${title}</div>
      <strong>${value}${suffix}</strong>
    </div>
  `;
}

function renderTopEndpointsForUser(topEndpoints, limit = 3) {
  const endpoints = Array.isArray(topEndpoints) ? topEndpoints.slice(0, limit) : [];
  if (!endpoints.length) {
    return '<div class="top-user-meta">Top acoes: sem dados</div>';
  }

  return endpoints
    .map((endpoint) => {
      const label = endpointLabel(endpoint.endpoint);
      const requests = toNumberFormat(endpoint.requests || endpoint.frequency || 0);
      return `<div class="top-user-meta">${label}: ${requests}</div>`;
    })
    .join("");
}

function destroyChart(chartId) {
  const currentChart = chartInstances.get(chartId);
  if (!currentChart) {
    return;
  }

  currentChart.destroy();
  chartInstances.delete(chartId);
}

function clearChartEmptyState(canvas) {
  const container = canvas?.parentElement;
  if (!container) {
    return;
  }

  const emptyState = container.querySelector("[data-chart-empty]");
  if (emptyState) {
    emptyState.remove();
  }
}

function showChartEmptyState(chartId, message) {
  const canvas = getElement(chartId);
  if (!canvas) {
    return;
  }

  destroyChart(chartId);
  clearChartEmptyState(canvas);
  canvas.style.display = "none";

  const emptyState = document.createElement("p");
  emptyState.className = "empty-state";
  emptyState.dataset.chartEmpty = "true";
  emptyState.textContent = message;
  canvas.parentElement.appendChild(emptyState);
}

function renderChart(chartId, config) {
  const canvas = getElement(chartId);
  if (!canvas) {
    return;
  }

  destroyChart(chartId);
  clearChartEmptyState(canvas);
  canvas.style.display = "";

  const chart = new Chart(canvas.getContext("2d"), config);
  chartInstances.set(chartId, chart);
}

function renderPieChart(chartId, labels, values) {
  if (!labels.length || !values.length) {
    showChartEmptyState(chartId, "Nao ha dados suficientes para exibir este grafico.");
    return;
  }

  renderChart(chartId, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: CHART_COLORS,
          borderColor: "rgba(15, 23, 42, 0.9)",
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#cbd5e1",
            padding: 16,
          },
        },
      },
    },
  });
}

function renderLineChart(chartId, labels, values) {
  if (!labels.length || !values.length) {
    showChartEmptyState(chartId, "Nao ha atividade diaria para exibir.");
    return;
  }

  renderChart(chartId, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Requisicoes",
          data: values,
          borderColor: "#60a5fa",
          backgroundColor: "rgba(59, 130, 246, 0.18)",
          fill: true,
          tension: 0.25,
          pointRadius: 3,
          pointBackgroundColor: "#93c5fd",
        },
      ],
    },
    options: {
      scales: {
        x: {
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  if (document.referrer) {
    try {
      const previousUrl = new URL(document.referrer);
      if (previousUrl.origin === window.location.origin) {
        window.location.href = previousUrl.pathname + previousUrl.search + previousUrl.hash;
        return;
      }
    } catch (_error) {
      // Ignore invalid referrer and use the fallback below.
    }
  }

  window.location.href = "/homeAdmin";
}

function sortDescendingBy(items, selector) {
  return [...items].sort((left, right) => toNumber(selector(right)) - toNumber(selector(left)));
}

function getTotalEconomyHours(kpis, summary) {
  const hours = toNumber(kpis.totalEconomyHours || summary.totalEconomyHours);
  if (hours > 0) {
    return hours;
  }

  return toNumber(kpis.totalEconomyMin || summary.totalEconomyMin) / 60;
}

function getTopUsers(reportData) {
  const mergedUsers = new Map();
  const userProductivity = Array.isArray(reportData.userProductivity) ? reportData.userProductivity : [];
  const userActivityEndpoints = Array.isArray(reportData.userActivityEndpoints) ? reportData.userActivityEndpoints : [];

  userProductivity.forEach((user) => {
    const key = normalizeUserKey(user.user);
    mergedUsers.set(key, {
      user: user.user || "N/A",
      productiveActions: toNumber(user.productiveActions),
      economyMin: toNumber(user.economyMin),
      economyHours: toNumber(user.economyHours),
      totalRequests: 0,
      topEndpoints: [],
    });
  });

  userActivityEndpoints.forEach((user) => {
    const key = normalizeUserKey(user.user);
    const current = mergedUsers.get(key) || {
      user: user.user || "N/A",
      productiveActions: 0,
      economyMin: 0,
      economyHours: 0,
      totalRequests: 0,
      topEndpoints: [],
    };

    mergedUsers.set(key, {
      ...current,
      user: user.user || current.user,
      totalRequests: toNumber(user.totalRequests || current.totalRequests),
      economyHours: toNumber(user.economyHours || current.economyHours),
      topEndpoints: Array.isArray(user.topEndpoints) ? user.topEndpoints : current.topEndpoints,
    });
  });

  return sortDescendingBy(
    Array.from(mergedUsers.values()).filter((user) => toNumber(user.productiveActions) > 0),
    (user) => user.productiveActions,
  ).slice(0, 5);
}

function getTopEndpoints(reportData) {
  const endpoints =
    reportData.endpointEconomy ||
    reportData.productiveEndpoints ||
    reportData.endpoints ||
    [];

  return [...(Array.isArray(endpoints) ? endpoints : [])].sort((left, right) => {
    const hoursDiff = toNumber(right.economyHours || (toNumber(right.economyMin) / 60))
      - toNumber(left.economyHours || (toNumber(left.economyMin) / 60));
    if (hoursDiff !== 0) {
      return hoursDiff;
    }

    const frequencyDiff = toNumber(right.frequency) - toNumber(left.frequency);
    if (frequencyDiff !== 0) {
      return frequencyDiff;
    }

    return endpointLabel(left.endpoint).localeCompare(endpointLabel(right.endpoint), "pt-BR");
  });
}

function buildTopUsers(topUsers) {
  if (!topUsers.length) {
    return '<div class="empty-state">Nenhum usuario para exibir.</div>';
  }

  return topUsers
    .map((user, index) => {
      const actions = toNumber(user.productiveActions);
      const economyHours = toNumber(user.economyHours).toFixed(2);

      return `
        <div class="top-user-card">
          <div class="top-user-rank">#${index + 1}</div>
          <div class="top-user-name">${String(user.user || "N/A").split("@")[0]}</div>
          <div class="top-user-meta">Acoes produtivas: ${toNumberFormat(actions)}</div>
          <div class="top-user-meta">Economia: ${economyHours}h</div>
          ${renderTopEndpointsForUser(user.topEndpoints, 3)}
        </div>
      `;
    })
    .join("");
}

function buildEndpointUsersSummary(endpoint) {
  const users = Array.isArray(endpoint.users) ? endpoint.users : [];

  if (!users.length) {
    return '<div class="top-user-meta">Sem usuarios produtivos</div>';
  }

  return users
    .slice(0, 5)
    .map((item) => {
      const userLabel = String(item.user || "N/A").split("@")[0];
      return `<div class="top-user-meta">${userLabel}: ${toNumberFormat(item.requests)}</div>`;
    })
    .join("");
}

function buildEndpointsTable(endpoints) {
  if (!endpoints.length) {
    return '<tr><td colspan="5" class="text-center">Nenhuma acao para exibir.</td></tr>';
  }

  return endpoints
    .slice(0, 10)
    .map(
      (endpoint, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${endpointLabel(endpoint.endpoint)}</td>
          <td>${toNumberFormat(endpoint.frequency)}</td>
          <td>${buildEndpointUsersSummary(endpoint)}</td>
          <td>${toNumber(endpoint.economyHours).toFixed(2)}h</td>
        </tr>
      `,
    )
    .join("");
}

function buildSummaryMetrics(summary, kpis, totalEconomyHours) {
  return `
    <tr><td>Total Requisicoes</td><td>${toNumberFormat(summary.totalRequests || kpis.totalRequests)}</td></tr>
    <tr><td>Usuarios Unicos</td><td>${toNumberFormat(summary.totalUsers || kpis.distinctUsers)}</td></tr>
    <tr><td>Acoes Produtivas</td><td>${toNumberFormat(summary.productiveActions || kpis.productiveActions)}</td></tr>
    <tr><td>Acoes de Navegacao</td><td>${toNumberFormat(summary.navigationActions || kpis.navigationActions)}</td></tr>
    <tr><td>Economia Total (min)</td><td>${toNumberFormat(summary.totalEconomyMin || kpis.totalEconomyMin)}</td></tr>
    <tr><td>Economia Total (h)</td><td>${totalEconomyHours.toFixed(2)}h</td></tr>
  `;
}

function relatorioActionLabel(action) {
  const labels = {
    create: "Criacoes",
    update: "Atualizacoes",
    delete: "Exclusoes",
    unknown: "Outros",
  };

  return labels[action] || action || "Outros";
}

function getRelatorioActions(reportData) {
  if (Array.isArray(reportData.relatorioActions)) {
    return reportData.relatorioActions;
  }

  return Object.entries(reportData.relatorioSummary?.actions || {}).map(([action, count]) => ({
    action,
    count,
  }));
}

function getRelatorioRoutes(reportData) {
  if (Array.isArray(reportData.relatorioRoutes)) {
    return reportData.relatorioRoutes;
  }

  return Object.entries(reportData.relatorioSummary?.routes || {}).map(([route, count]) => ({
    route,
    count,
  }));
}

function buildRelatorioKpis(summary) {
  const actions = summary.actions || {};

  return `
    ${renderKpiCard("Eventos do relatorio", toNumberFormat(summary.totalEvents))}
    ${renderKpiCard("Usuarios no relatorio", toNumberFormat(summary.distinctUsers))}
    ${renderKpiCard("Criacoes", toNumberFormat(actions.create))}
    ${renderKpiCard("Atualizacoes", toNumberFormat(actions.update))}
    ${renderKpiCard("Exclusoes", toNumberFormat(actions.delete))}
    ${renderKpiCard("Maior sync", toNumberFormat(summary.maxSyncVersion))}
  `;
}

function buildRelatorioRoutesTable(routes) {
  if (!routes.length) {
    return '<tr><td colspan="2" class="text-center">Nenhuma rota do relatorio para exibir.</td></tr>';
  }

  return routes
    .slice(0, 10)
    .map(
      (route) => `
        <tr>
          <td>${endpointLabel(route.route || "Rota nao informada")}</td>
          <td>${toNumberFormat(route.count)}</td>
        </tr>
      `,
    )
    .join("");
}

function buildRelatorioUsersTable(users) {
  if (!users.length) {
    return '<tr><td colspan="7" class="text-center">Nenhum usuario do relatorio para exibir.</td></tr>';
  }

  return users
    .map(
      (user) => `
        <tr>
          <td>${user.user || "Usuario nao informado"}</td>
          <td>${toNumberFormat(user.events)}</td>
          <td>${toNumberFormat(user.creates)}</td>
          <td>${toNumberFormat(user.updates)}</td>
          <td>${toNumberFormat(user.deletes)}</td>
          <td>${toNumberFormat(user.maxTickets)}</td>
          <td>${user.lastSyncVersion ? toNumberFormat(user.lastSyncVersion) : "-"}</td>
        </tr>
      `,
    )
    .join("");
}

function formatDisplayDate(value) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(parsed);
}

function formatDisplayDateTime(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function formatRangeLabel(from, to) {
  if (!from || !to) {
    return "Periodo nao informado";
  }

  return `${formatDisplayDate(from)} ate ${formatDisplayDate(to)}`;
}

function getTodayRangeValue() {
  return formatIsoDate(startOfDay(new Date()));
}

function getPreviousMonthRange(referenceDate = startOfDay(new Date())) {
  const currentMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const previousMonthEnd = addDays(currentMonthStart, -1);
  const previousMonthStart = new Date(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), 1);

  return {
    from: formatIsoDate(previousMonthStart),
    to: formatIsoDate(previousMonthEnd),
  };
}

function getCurrentMonthRange(referenceDate = startOfDay(new Date())) {
  return {
    from: formatIsoDate(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)),
    to: formatIsoDate(referenceDate),
  };
}

function getPresetRange(presetName, referenceDate = startOfDay(new Date())) {
  switch (presetName) {
    case "today":
      return { from: formatIsoDate(referenceDate), to: formatIsoDate(referenceDate) };
    case "last7":
      return { from: formatIsoDate(addDays(referenceDate, -6)), to: formatIsoDate(referenceDate) };
    case "last30":
      return { from: formatIsoDate(addDays(referenceDate, -29)), to: formatIsoDate(referenceDate) };
    case "currentMonth":
      return getCurrentMonthRange(referenceDate);
    case "previousMonth":
      return getPreviousMonthRange(referenceDate);
    case "max90":
      return { from: formatIsoDate(addDays(referenceDate, -89)), to: formatIsoDate(referenceDate) };
    default:
      return null;
  }
}

function rangesMatch(leftRange, rightRange) {
  return leftRange?.from === rightRange?.from && leftRange?.to === rightRange?.to;
}

function detectMatchingPreset(range) {
  const presetNames = ["today", "last7", "last30", "currentMonth", "previousMonth", "max90"];
  return presetNames.find((presetName) => rangesMatch(range, getPresetRange(presetName))) || "";
}

function validateRange(range) {
  const fromDate = parseIsoDate(range?.from);
  const toDate = parseIsoDate(range?.to);
  const today = startOfDay(new Date());

  if (!fromDate || !toDate) {
    return { error: "Informe datas validas no formato YYYY-MM-DD." };
  }

  if (fromDate > toDate) {
    return { error: "A data inicial nao pode ser maior que a data final." };
  }

  if (fromDate > today || toDate > today) {
    return { error: "Nao e permitido solicitar datas futuras." };
  }

  const days = diffDaysInclusive(fromDate, toDate);
  if (days > MAX_RANGE_DAYS) {
    return { error: `O intervalo maximo permitido e de ${MAX_RANGE_DAYS} dias.` };
  }

  return {
    from: formatIsoDate(fromDate),
    to: formatIsoDate(toDate),
    days,
  };
}

function getInitialRange() {
  const params = new URLSearchParams(window.location.search);
  const urlRange = {
    from: params.get("from") || "",
    to: params.get("to") || "",
  };

  const validatedUrlRange = validateRange(urlRange);
  if (!validatedUrlRange.error) {
    return {
      from: validatedUrlRange.from,
      to: validatedUrlRange.to,
    };
  }

  const metaRange = {
    from: window.reportData?.meta?.from || "",
    to: window.reportData?.meta?.to || "",
  };
  const validatedMetaRange = validateRange(metaRange);
  if (!validatedMetaRange.error) {
    return {
      from: validatedMetaRange.from,
      to: validatedMetaRange.to,
    };
  }

  return getPreviousMonthRange();
}

function applyRangeToInputs(range) {
  const today = getTodayRangeValue();
  const fromInput = getElement("from-date");
  const toInput = getElement("to-date");

  if (fromInput) {
    fromInput.max = today;
    fromInput.value = range.from;
  }

  if (toInput) {
    toInput.max = today;
    toInput.value = range.to;
  }
}

function getRangeFromInputs() {
  return {
    from: getElement("from-date")?.value || "",
    to: getElement("to-date")?.value || "",
  };
}

function updateUrlRange(range) {
  const url = new URL(window.location.href);
  url.searchParams.set("from", range.from);
  url.searchParams.set("to", range.to);
  window.history.replaceState({}, "", url);
}

function setActivePreset(presetName) {
  document.querySelectorAll(".preset-button").forEach((button) => {
    button.classList.toggle("is-active", presetName && button.dataset.preset === presetName);
  });
}

function setRangeFeedback(message, state = "idle") {
  const feedback = getElement("range-feedback");
  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.dataset.state = state;
}

function setPeriodLabel(reportData) {
  const label = getElement("period-label");
  if (!label) {
    return;
  }

  const meta = reportData?.meta || {};
  const days = meta.days ? ` (${meta.days} dias)` : "";
  label.textContent = `Periodo carregado: ${formatRangeLabel(meta.from, meta.to)}${days}`;
}

function setLoading(isLoading) {
  const applyButton = getElement("apply-range-button");
  const fromInput = getElement("from-date");
  const toInput = getElement("to-date");

  if (applyButton) {
    applyButton.disabled = isLoading;
    applyButton.textContent = isLoading ? "Atualizando..." : "Aplicar periodo";
  }

  if (fromInput) {
    fromInput.disabled = isLoading;
  }

  if (toInput) {
    toInput.disabled = isLoading;
  }

  document.querySelectorAll(".preset-button").forEach((button) => {
    button.disabled = isLoading;
  });
}

async function fetchInsights(range) {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  const response = await fetch(`/api/admin/hub-insights?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorMessage = "Falha ao carregar os insights do HUB.";

    try {
      const payload = await response.json();
      if (payload?.error) {
        errorMessage = payload.error;
      }
    } catch (_error) {
      // Ignore non-JSON errors and use the fallback message.
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

function buildSuccessFeedback(reportData) {
  const meta = reportData?.meta || {};
  const feedbackParts = [];

  if (meta.generatedAt) {
    feedbackParts.push(`Gerado em ${formatDisplayDateTime(meta.generatedAt)}.`);
  }

  if (Number.isFinite(meta.cacheHits) && Number.isFinite(meta.cacheMisses)) {
    feedbackParts.push(`Cache diario: ${meta.cacheHits} hit(s) / ${meta.cacheMisses} miss(es).`);
  }

  return feedbackParts.join(" ") || "Insights atualizados com sucesso.";
}

function renderDashboard(reportData) {
  const kpis = reportData.kpis || reportData.summary || {};
  const summary = reportData.summary || kpis || {};
  const topUsers = getTopUsers(reportData);
  const endpoints = getTopEndpoints(reportData);
  const dailyData = Array.isArray(reportData.dailyActivity) ? reportData.dailyActivity : [];
  const totalEconomyHours = getTotalEconomyHours(kpis, summary);
  const totalUsers = toNumber(kpis.distinctUsers || summary.totalUsers);
  const productiveActions = toNumber(kpis.productiveActions || summary.productiveActions);
  const relatorioSummary = reportData.relatorioSummary || {};
  const relatorioUsers = Array.isArray(reportData.relatorioUsers) ? reportData.relatorioUsers : [];
  const relatorioActions = getRelatorioActions(reportData);
  const relatorioRoutes = getRelatorioRoutes(reportData);

  getElement("kpi-target").innerHTML = `
    ${renderKpiCard("Requisicoes", toNumberFormat(kpis.totalRequests))}
    ${renderKpiCard("Usuarios unicos", toNumberFormat(totalUsers))}
    ${renderKpiCard("Acoes produtivas", toNumberFormat(productiveActions))}
    ${renderKpiCard("Acoes de navegacao", toNumberFormat(kpis.navigationActions))}
    ${renderKpiCard("Minutos economizados", toNumberFormat(kpis.totalEconomyMin))}
    ${renderKpiCard("Horas economizadas", totalEconomyHours.toFixed(2), "h")}
  `;

  getElement("economy-min").textContent = toNumberFormat(kpis.totalEconomyMin);
  getElement("economy-hours").textContent = `${totalEconomyHours.toFixed(2)}h`;
  getElement("productive-actions").textContent = toNumberFormat(productiveActions);
  getElement("unique-users").textContent = toNumberFormat(totalUsers);

  renderPieChart(
    "userPieChart",
    topUsers.map((user) => String(user.user || "N/A").split("@")[0]),
    topUsers.map((user) => toNumber(user.productiveActions)),
  );

  const topEndpoints = endpoints.slice(0, 6);
  renderPieChart(
    "endpointPieChart",
    topEndpoints.map((endpoint) => endpointLabel(endpoint.endpoint)),
    topEndpoints.map((endpoint) => toNumber(endpoint.frequency)),
  );

  renderPieChart(
    "relatorioActionsChart",
    relatorioActions.map((item) => relatorioActionLabel(item.action)),
    relatorioActions.map((item) => toNumber(item.count)),
  );

  renderLineChart(
    "dailyChart",
    dailyData.map((item) => item.date),
    dailyData.map((item) => toNumber(item.requests)),
  );

  getElement("top-users").innerHTML = buildTopUsers(topUsers);
  getElement("endpoints-table").innerHTML = buildEndpointsTable(endpoints);
  getElement("summary-metrics").innerHTML = buildSummaryMetrics(summary, kpis, totalEconomyHours);
  getElement("relatorio-kpi-target").innerHTML = buildRelatorioKpis(relatorioSummary);
  getElement("relatorio-routes-table").innerHTML = buildRelatorioRoutesTable(relatorioRoutes);
  getElement("relatorio-users-table").innerHTML = buildRelatorioUsersTable(relatorioUsers);

  setPeriodLabel(reportData);
}

async function loadDashboard(range, presetName = "") {
  const validatedRange = validateRange(range);
  if (validatedRange.error) {
    setRangeFeedback(validatedRange.error, "error");
    return;
  }

  setLoading(true);
  if (presetName) {
    setActivePreset(presetName);
  }
  setRangeFeedback("Atualizando insights do HUB...", "idle");

  try {
    const reportData = await fetchInsights(validatedRange);
    window.reportData = reportData;
    renderDashboard(reportData);
    updateUrlRange({
      from: validatedRange.from,
      to: validatedRange.to,
    });
    setRangeFeedback(buildSuccessFeedback(reportData), "success");
    setActivePreset(presetName || detectMatchingPreset(validatedRange));
  } catch (error) {
    if (window.reportData) {
      renderDashboard(window.reportData);
      setRangeFeedback(`Falha ao atualizar agora. Exibindo os ultimos dados disponiveis. ${error.message}`, "error");
    } else {
      setRangeFeedback(error.message, "error");
      const root = getElement("root");
      if (root) {
        root.insertAdjacentHTML(
          "afterbegin",
          '<div class="content-box mb-4"><p class="text-red-300">Nao foi possivel carregar os insights do HUB.</p></div>',
        );
      }
    }
  } finally {
    setLoading(false);
  }
}

function handlePresetClick(event) {
  const presetName = event.currentTarget.dataset.preset || "";
  const range = getPresetRange(presetName);
  if (!range) {
    return;
  }

  applyRangeToInputs(range);
  loadDashboard(range, presetName);
}

function handleApplyRange() {
  setActivePreset("");
  loadDashboard(getRangeFromInputs());
}

window.addEventListener("DOMContentLoaded", () => {
  const backButton = getElement("back-button");
  if (backButton) {
    backButton.addEventListener("click", goBack);
  }

  document.querySelectorAll(".preset-button").forEach((button) => {
    button.addEventListener("click", handlePresetClick);
  });

  const applyButton = getElement("apply-range-button");
  if (applyButton) {
    applyButton.addEventListener("click", handleApplyRange);
  }

  const fromInput = getElement("from-date");
  const toInput = getElement("to-date");
  [fromInput, toInput].forEach((input) => {
    if (input) {
      input.addEventListener("input", () => setActivePreset(""));
    }
  });

  const initialRange = getInitialRange();
  applyRangeToInputs(initialRange);

  if (window.reportData) {
    renderDashboard(window.reportData);
    setRangeFeedback("Carregando dados administrativos atualizados...", "idle");
  }

  loadDashboard(initialRange, detectMatchingPreset(initialRange));
});
