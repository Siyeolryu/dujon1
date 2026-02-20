/**
 * export.js - 엑셀 관리 페이지
 */
const ExportPage = (() => {
  function init() {
    renderHistory();
  }

  function renderHistory() {
    const history = DB.ExportHistory.getAll().reverse();
    const tbody = document.getElementById('exportHistoryBody');
    if (!tbody) return;

    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">📋</div><p>저장 이력이 없습니다.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = history.map(h => `<tr>
      <td style="color:var(--text-muted)">${h.savedAt ? h.savedAt.replace('T', ' ').slice(0, 16) : '-'}</td>
      <td><strong>${h.filename}</strong></td>
      <td style="font-size:12px;color:var(--text-muted)">${h.counts || ''}</td>
      <td>${h.operator || '관리자'}</td>
    </tr>`).join('');
  }

  return { init };
})();
