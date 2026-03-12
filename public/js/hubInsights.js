function toNumberFormat(num) {
  return Number(num).toLocaleString('pt-BR');
}

function renderKpiCard(title, value, suffix = '') {
  return `
    <div class="kpi-card">
      <div class="text-sm font-semibold">${title}</div>
      <strong>${value}${suffix}</strong>
    </div>
  `;
}

function renderActivityUser(userData) {
  return `
    <div class="card">
      <div class="font-semibold mb-1">${userData.user}</div>
      <div class="text-xs text-slate-600 mb-2">Requisições: ${toNumberFormat(userData.totalRequests)}</div>
      <div class="text-lg font-bold text-slate-900">${userData.economyHours.toFixed(2)}h</div>
      <div class="text-xs text-slate-500 mt-2">Top endpoints:</div>
      <ul class="text-xs text-slate-700 list-disc pl-5">
        ${userData.topEndpoints.slice(0, 5).map(e => `<li>${e.endpoint} (${e.requests})</li>`).join('')}
      </ul>
    </div>
  `;
}

function createPieChart(ctx, labels, values, colors) {
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#fff',
        borderWidth: 1,
      }],
    },
    options: {
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function createLineChart(ctx, labels, values) {
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Requisições',
        data: values,
        borderColor: '#1d4ed8',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.25,
        pointRadius: 3,
      }],
    },
    options: {
      scales: {
        x: { ticks: { color: '#334155' } },
        y: { ticks: { color: '#334155', beginAtZero: true } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function build() {
  const data = window.reportData || {};
  console.debug('hubInsights.build() reportData', data);

  const kpis = data.kpis || data.summary || {};
  const reportData = data;

  const topUsers = (reportData.userProductivity?.length ? reportData.userProductivity : reportData.userActivityEndpoints || []).slice(0, 5);
  const statusDistribution = reportData.statusDistribution || {};
  const endpoints = reportData.endpointEconomy || reportData.productiveEndpoints || reportData.endpoints || [];
  const dailyData = reportData.dailyActivity || [];
  const activityUsers = reportData.userActivityEndpoints || reportData.userProductivity || [];

  document.getElementById('kpi-target').innerHTML = `
    ${renderKpiCard('Requisições', toNumberFormat(kpis.totalRequests || 0))}
    ${renderKpiCard('Usuários únicos', toNumberFormat(kpis.distinctUsers || kpis.totalUsers || 0))}
    ${renderKpiCard('Ações produtivas', toNumberFormat(kpis.productiveActions || 0))}
    ${renderKpiCard('Ações de navegação', toNumberFormat(kpis.navigationActions || 0))}
    ${renderKpiCard('Minutos economizados', toNumberFormat(kpis.totalEconomyMin || kpis.totalEconomyHours || 0))}
    ${renderKpiCard('Horas economizadas', (kpis.totalEconomyHours || (kpis.totalEconomyMin ? (kpis.totalEconomyMin/60) : 0)).toFixed(2), 'h')}
  `;

  document.getElementById('economy-min').textContent = toNumberFormat(kpis.totalEconomyMin || 0);
  document.getElementById('economy-hours').textContent = (kpis.totalEconomyHours || 0).toFixed(2) + 'h';

  const userLabels = topUsers.map(u => (u.user || 'N/A').split('@')[0]);
  const userValues = topUsers.map(u => Number(u.economyHours || 0));
  const colors = ['#10b981', '#059669', '#047857', '#065f46', '#064e3b'];

  const pieCanvas = document.getElementById('userPieChart');
  if (pieCanvas && topUsers.length) {
    const pieCtx = pieCanvas.getContext('2d');
    createPieChart(pieCtx, userLabels, userValues, colors);
  } else if (pieCanvas) {
    pieCanvas.parentElement.innerHTML = '<p class="text-slate-500">Nenhum usuário disponível para gráfico</p>';
  }

  const endpointPieCanvas = document.getElementById('endpointPieChart');
  const topEndpoints = endpoints.slice(0, 6); // display top 6 endpoints in pie
  const endpointLabels = topEndpoints.map(ep => ep.endpoint);
  const endpointValues = topEndpoints.map(ep => Number(ep.economyHours || 0));
  if (endpointPieCanvas && endpointLabels.length) {
    const endpointCtx = endpointPieCanvas.getContext('2d');
    createPieChart(endpointCtx, endpointLabels, endpointValues, colors);
  } else if (endpointPieCanvas) {
    endpointPieCanvas.parentElement.innerHTML = '<p class="text-slate-500">Nenhum endpoint disponível para gráfico</p>';
  }

  const activityUsersContainer = document.getElementById('activity-users');
  if (activityUsersContainer) {
    activityUsersContainer.innerHTML = activityUsers.length ? activityUsers.map(u => renderActivityUser(u)).join('') : '<div class="text-slate-500">Nenhum usuário na atividade.</div>';
  }

  document.getElementById('top-users').innerHTML = topUsers.length ? topUsers.map((u, index) => `
    <div class="card">
      <div class="font-semibold">${index + 1}. ${(u.user || 'N/A').split('@')[0]}</div>
      <div class="text-xs text-slate-600">Economia: ${Number(u.economyHours || 0).toFixed(2)}h</div>
      <div class="text-xs text-slate-600">Ações: ${toNumberFormat(u.productiveActions || u.totalRequests || 0)}</div>
    </div>
  `).join('') : '<div class="text-slate-500">Nenhum usuário para exibir</div>';

  document.getElementById('endpoints-table').innerHTML = endpoints.length ? endpoints.slice(0, 10).map((ep, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${ep.endpoint}</td>
      <td>${toNumberFormat(ep.frequency || 0)}</td>
      <td>${toNumberFormat(ep.economyMin || 0)}</td>
      <td>${Number(ep.economyHours || 0).toFixed(2)}h</td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="text-center">Nenhum endpoint para exibir</td></tr>';

  const summary = reportData.summary || kpis || {};
  document.getElementById('summary-metrics').innerHTML = `
    <tr><td>Total Requisições</td><td>${toNumberFormat(summary.totalRequests || kpis.totalRequests || 0)}</td></tr>
    <tr><td>Usuários Únicos</td><td>${toNumberFormat(summary.totalUsers || kpis.distinctUsers || 0)}</td></tr>
    <tr><td>Ações Produtivas</td><td>${toNumberFormat(summary.productiveActions || kpis.productiveActions || 0)}</td></tr>
    <tr><td>Ações Navegação</td><td>${toNumberFormat(summary.navigationActions || kpis.navigationActions || 0)}</td></tr>
    <tr><td>Economia Total (min)</td><td>${toNumberFormat(summary.totalEconomyMin || kpis.totalEconomyMin || 0)}</td></tr>
    <tr><td>Economia Total (h)</td><td>${(summary.totalEconomyHours || kpis.totalEconomyHours || 0).toFixed(2)}h</td></tr>
  `;

  const dailyLabels = dailyData.length ? dailyData.map(item => item.date) : [];
  const dailyValues = dailyData.length ? dailyData.map(item => item.requests) : [];

  const dailyCanvas = document.getElementById('dailyChart');
  if (dailyCanvas && dailyData.length) {
    const dailyCtx = dailyCanvas.getContext('2d');
    createLineChart(dailyCtx, dailyLabels, dailyValues);
  } else if (dailyCanvas) {
    dailyCanvas.parentElement.innerHTML = '<p class="text-slate-500">Não há atividade diária para exibir</p>';
  }

  // Chart por status (não está no layout principal, mas mantemos para controle)
  if (document.getElementById('status-target')) {
    document.getElementById('status-target').innerHTML = Object.entries(statusDistribution).map(([code, count]) => `
      <tr><td>${code}</td><td>${toNumberFormat(count)}</td></tr>
    `).join('');
  }
}

window.addEventListener('DOMContentLoaded', function () {
  if (!window.reportData) {
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = '<p class="text-red-400">Falha ao carregar reportData.js. Verifique se reportData.js foi gerado.</p>';
    }
    return;
  }
  build();
});