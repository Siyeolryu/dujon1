/**
 * dashboard.js - 대시보드 홈 페이지
 */
const DashboardPage = (() => {
  let progressChart = null;
  let assignChart = null;

  function init() {
    const sites = DB.Sites.getAll();
    const staff = DB.Staff.getAll();
    const assigns = DB.Assignments.getAll();

    // 통계 카드
    const activeSites = sites.filter(s => s.status === '진행').length;
    const assignedSiteIds = new Set(assigns.map(a => a.siteId));
    const assignedCount = sites.filter(s => assignedSiteIds.has(s.id)).length;
    const unassignedCount = sites.filter(s => s.status !== '완료' && !assignedSiteIds.has(s.id)).length;
    const assignedStaffIds = new Set(assigns.map(a => a.staffId));
    const avgProgress = sites.length ? Math.round(sites.reduce((s, c) => s + (c.progress || 0), 0) / sites.length) : 0;

    document.getElementById('stat-sites').textContent = sites.length;
    document.getElementById('stat-sites-active').textContent = `진행 ${activeSites}`;
    document.getElementById('stat-staff').textContent = staff.length;
    document.getElementById('stat-staff-assigned').textContent = `배정 ${assignedStaffIds.size}명`;
    document.getElementById('stat-assigned').textContent = assignedCount;
    document.getElementById('stat-unassigned').textContent = `미배정 ${unassignedCount}`;
    document.getElementById('stat-progress').textContent = avgProgress + '%';
    document.getElementById('stat-ontime').textContent = `일정 준수`;

    renderCharts(sites, assignedCount, unassignedCount);
    renderTable(sites);
  }

  function renderCharts(sites, assignedCount, unassignedCount) {
    // 공정 차트 (바)
    const ctx1 = document.getElementById('progressChart');
    if (!ctx1) return;
    const labels = sites.slice(0, 6).map(s => s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name);
    const data = sites.slice(0, 6).map(s => s.progress || 0);
    const colors = data.map(v => v === 100 ? '#10b981' : v >= 70 ? '#4f46e5' : v >= 40 ? '#f59e0b' : '#ef4444');

    if (progressChart) { progressChart.destroy(); progressChart = null; }
    progressChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '공정률(%)',
          data,
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });

    // 배정 도넛 차트
    const ctx2 = document.getElementById('assignChart');
    if (!ctx2) return;
    if (assignChart) { assignChart.destroy(); assignChart = null; }
    assignChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['배정 완료', '미배정'],
        datasets: [{
          data: [assignedCount, Math.max(0, unassignedCount)],
          backgroundColor: ['#4f46e5', '#e2e8f0'],
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 } } }
        }
      }
    });
  }

  function renderTable(sites) {
    const assigns = DB.Assignments.getAll();
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;

    const display = sites.slice(0, 8);
    if (display.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🏗️</div><p>등록된 현장이 없습니다.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = display.map(s => {
      const siteAssigns = assigns.filter(a => a.siteId === s.id);
      const staffNames = siteAssigns.map(a => {
        const st = DB.Staff.getById(a.staffId);
        return st ? st.name : '';
      }).filter(Boolean).join(', ') || '<span style="color:var(--text-light)">미배정</span>';

      return `<tr>
        <td><strong>${s.name}</strong></td>
        <td style="color:var(--text-muted)">${s.location}</td>
        <td>${staffNames}</td>
        <td>
          <div class="progress-bar-wrap">
            <div class="progress-bar"><div class="progress-fill" style="width:${s.progress}%"></div></div>
            <span class="progress-text">${s.progress}%</span>
          </div>
        </td>
        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
        <td style="color:var(--text-muted)">${App.fmtDate(s.endDate)}</td>
      </tr>`;
    }).join('');
  }

  return { init };
})();
