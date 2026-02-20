/**
 * dashboard.js - 대시보드 홈 페이지
 */
const DashboardPage = (() => {
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

    document.getElementById('stat-sites').textContent = sites.length;
    document.getElementById('stat-sites-active').textContent = `진행 ${activeSites}`;
    document.getElementById('stat-staff').textContent = staff.length;
    document.getElementById('stat-staff-assigned').textContent = `배정 ${assignedStaffIds.size}명`;
    document.getElementById('stat-assigned').textContent = assignedCount;
    document.getElementById('stat-unassigned').textContent = `미배정 ${unassignedCount}`;

    renderCharts(assignedCount, unassignedCount);
    renderTable(sites);
  }

  function renderCharts(assignedCount, unassignedCount) {
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
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🏗️</div><p>등록된 현장이 없습니다.</p></div></td></tr>`;
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
        <td style="color:var(--text-muted)">${s.architect || '-'}</td>
        <td>${s.special ? `<span style="color:var(--warning)">⚠️ ${s.special}</span>` : `<span style="color:var(--text-light)">-</span>`}</td>
        <td>${staffNames}</td>
        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
        <td style="color:var(--text-muted)">${App.fmtDate(s.endDate)}</td>
      </tr>`;
    }).join('');
  }

  return { init };
})();
