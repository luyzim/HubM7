function toNumberFormat(num) {
  return Number(num).toLocaleString("pt-BR");
}

function renderKpiCard(title, value, suffix = "") {
  return `
    <div class="kpi-card">
      <div class="label">${title}</div>
      <strong>${value}${suffix}</strong>
    </div>
  `;
}

function createPieChart(ctx, labels, values, colors) {
  new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
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

function createLineChart(ctx, labels, values) {
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Requisições",
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
      // Ignora referrer inválido e cai no fallback.
    }
  }

  window.location.href = "/home";
}

function build() {
  const data = window.reportData || {};
  const kpis = data.kpis || data.summary || {};
  const reportData = data;

  const topUsers = (reportData.userProductivity?.length
    ? reportData.userProductivity
    : reportData.userActivityEndpoints || []).slice(0, 5);
  const statusDistribution = reportData.statusDistribution || {};
  const endpoints =
    reportData.endpointEconomy ||
    reportData.productiveEndpoints ||
    reportData.endpoints ||
    [];
  const dailyData = reportData.dailyActivity || [];

  document.getElementById("kpi-target").innerHTML = `
    ${renderKpiCard("Requisições", toNumberFormat(kpis.totalRequests || 0))}
    ${renderKpiCard("Usuários únicos", toNumberFormat(kpis.distinctUsers || kpis.totalUsers || 0))}
    ${renderKpiCard("Ações produtivas", toNumberFormat(kpis.productiveActions || 0))}
    ${renderKpiCard("Ações de navegação", toNumberFormat(kpis.navigationActions || 0))}
    ${renderKpiCard("Minutos economizados", toNumberFormat(kpis.totalEconomyMin || 0))}
    ${renderKpiCard(
      "Horas economizadas",
      (kpis.totalEconomyHours || (kpis.totalEconomyMin ? kpis.totalEconomyMin / 60 : 0)).toFixed(2),
      "h"
    )}
  `;

  document.getElementById("economy-min").textContent = toNumberFormat(kpis.totalEconomyMin || 0);
  document.getElementById("economy-hours").textContent = `${(kpis.totalEconomyHours || 0).toFixed(2)}h`;
  document.getElementById("productive-actions").textContent = toNumberFormat(kpis.productiveActions || 0);
  document.getElementById("unique-users").textContent = toNumberFormat(kpis.distinctUsers || kpis.totalUsers || 0);

  const userLabels = topUsers.map((u) => (u.user || "N/A").split("@")[0]);
  const userValues = topUsers.map((u) => Number(u.economyHours || 0));
  const colors = ["#60a5fa", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  const pieCanvas = document.getElementById("userPieChart");
  if (pieCanvas && topUsers.length) {
    const pieCtx = pieCanvas.getContext("2d");
    createPieChart(pieCtx, userLabels, userValues, colors);
  } else if (pieCanvas) {
    pieCanvas.parentElement.innerHTML = '<p class="empty-state">Nenhum usuário disponível para gráfico.</p>';
  }

  const endpointPieCanvas = document.getElementById("endpointPieChart");
  const topEndpoints = endpoints.slice(0, 6);
  const endpointLabels = topEndpoints.map((ep) => ep.endpoint);
  const endpointValues = topEndpoints.map((ep) => Number(ep.economyHours || 0));
  if (endpointPieCanvas && endpointLabels.length) {
    const endpointCtx = endpointPieCanvas.getContext("2d");
    createPieChart(endpointCtx, endpointLabels, endpointValues, colors);
  } else if (endpointPieCanvas) {
    endpointPieCanvas.parentElement.innerHTML = '<p class="empty-state">Nenhum endpoint disponível para gráfico.</p>';
  }

  document.getElementById("top-users").innerHTML = topUsers.length
    ? topUsers
        .map(
          (u, index) => `
      <div class="top-user-card">
        <div class="top-user-rank">#${index + 1}</div>
        <div class="top-user-name">${(u.user || "N/A").split("@")[0]}</div>
        <div class="top-user-meta">Economia: ${Number(u.economyHours || 0).toFixed(2)}h</div>
        <div class="top-user-meta">Ações: ${toNumberFormat(u.productiveActions || u.totalRequests || 0)}</div>
      </div>
    `
        )
        .join("")
    : '<div class="empty-state">Nenhum usuário para exibir.</div>';

  document.getElementById("endpoints-table").innerHTML = endpoints.length
    ? endpoints
        .slice(0, 10)
        .map(
          (ep, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${ep.endpoint}</td>
        <td>${toNumberFormat(ep.frequency || 0)}</td>
        <td>${toNumberFormat(ep.economyMin || 0)}</td>
        <td>${Number(ep.economyHours || 0).toFixed(2)}h</td>
      </tr>
    `
        )
        .join("")
    : '<tr><td colspan="5" class="text-center">Nenhum endpoint para exibir.</td></tr>';

  const summary = reportData.summary || kpis || {};
  document.getElementById("summary-metrics").innerHTML = `
    <tr><td>Total Requisições</td><td>${toNumberFormat(summary.totalRequests || kpis.totalRequests || 0)}</td></tr>
    <tr><td>Usuários Únicos</td><td>${toNumberFormat(summary.totalUsers || kpis.distinctUsers || 0)}</td></tr>
    <tr><td>Ações Produtivas</td><td>${toNumberFormat(summary.productiveActions || kpis.productiveActions || 0)}</td></tr>
    <tr><td>Ações Navegação</td><td>${toNumberFormat(summary.navigationActions || kpis.navigationActions || 0)}</td></tr>
    <tr><td>Economia Total (min)</td><td>${toNumberFormat(summary.totalEconomyMin || kpis.totalEconomyMin || 0)}</td></tr>
    <tr><td>Economia Total (h)</td><td>${(summary.totalEconomyHours || kpis.totalEconomyHours || 0).toFixed(2)}h</td></tr>
  `;

  const dailyLabels = dailyData.length ? dailyData.map((item) => item.date) : [];
  const dailyValues = dailyData.length ? dailyData.map((item) => item.requests) : [];

  const dailyCanvas = document.getElementById("dailyChart");
  if (dailyCanvas && dailyData.length) {
    const dailyCtx = dailyCanvas.getContext("2d");
    createLineChart(dailyCtx, dailyLabels, dailyValues);
  } else if (dailyCanvas) {
    dailyCanvas.parentElement.innerHTML = '<p class="empty-state">Não há atividade diária para exibir.</p>';
  }

  if (document.getElementById("status-target")) {
    document.getElementById("status-target").innerHTML = Object.entries(statusDistribution)
      .map(([code, count]) => `<tr><td>${code}</td><td>${toNumberFormat(count)}</td></tr>`)
      .join("");
  }
}

window.addEventListener("DOMContentLoaded", function () {
  const backButton = document.getElementById("back-button");
  if (backButton) {
    backButton.addEventListener("click", goBack);
  }

  if (!window.reportData) {
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = '<div class="content-box"><p class="text-red-400">Falha ao carregar reportData.js. Verifique se reportData.js foi gerado.</p></div>';
    }
    return;
  }

  build();
});
