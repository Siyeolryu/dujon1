/**
 * sites.js - 현장 목록 페이지 (CRUD)
 */
const SitesPage = (() => {
  let editingId = null;

  function init() {
    renderTable();
    bindSearch();
  }

  function bindSearch() {
    const search = document.getElementById('siteSearch');
    const filter = document.getElementById('siteStatusFilter');
    if (search) search.oninput = renderTable;
    if (filter) filter.onchange = renderTable;
  }

  function renderTable() {
    const search = (document.getElementById('siteSearch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('siteStatusFilter')?.value || '';
    const assigns = DB.Assignments.getAll();

    let sites = DB.Sites.getAll();
    if (search) sites = sites.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.location.toLowerCase().includes(search) ||
      (s.client || '').toLowerCase().includes(search)
    );
    if (statusFilter) sites = sites.filter(s => s.status === statusFilter);

    const tbody = document.getElementById('sitesTableBody');
    if (!tbody) return;

    if (sites.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">🏗️</div><p>현장이 없습니다. '+ 현장 추가'를 눌러 등록하세요.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = sites.map(s => {
      const siteAssigns = assigns.filter(a => a.siteId === s.id);
      const staffNames = siteAssigns.map(a => {
        const st = DB.Staff.getById(a.staffId);
        return st ? `<span class="status-badge status-재직">${st.name}</span>` : '';
      }).filter(Boolean).join(' ') || `<span style="color:var(--text-light)">미배정</span>`;

      return `<tr>
        <td><strong>${s.name}</strong>${s.note ? `<br><small style="color:var(--text-muted)">${s.note}</small>` : ''}</td>
        <td style="color:var(--text-muted)">${s.location}</td>
        <td>${s.client || '-'}</td>
        <td>${staffNames}</td>
        <td>
          <div class="progress-bar-wrap">
            <div class="progress-bar"><div class="progress-fill" style="width:${s.progress}%"></div></div>
            <span class="progress-text">${s.progress}%</span>
          </div>
        </td>
        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
        <td style="color:var(--text-muted)">${App.fmtDate(s.startDate)}</td>
        <td style="color:var(--text-muted)">${App.fmtDate(s.endDate)}</td>
        <td>
          <button class="btn-icon" title="수정" onclick="SitesPage.openModal('${s.id}')">✏️</button>
          <button class="btn-icon" title="삭제" onclick="SitesPage.deleteSite('${s.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openModal(id = null) {
    editingId = id;
    const modal = document.getElementById('siteModal');
    document.getElementById('siteModalTitle').textContent = id ? '현장 수정' : '현장 추가';

    if (id) {
      const s = DB.Sites.getById(id);
      if (!s) return;
      document.getElementById('site-name').value = s.name || '';
      document.getElementById('site-location').value = s.location || '';
      document.getElementById('site-client').value = s.client || '';
      document.getElementById('site-amount').value = s.amount || '';
      document.getElementById('site-start').value = s.startDate || '';
      document.getElementById('site-end').value = s.endDate || '';
      document.getElementById('site-progress').value = s.progress || 0;
      document.getElementById('site-progress-val').textContent = (s.progress || 0) + '%';
      document.getElementById('site-status').value = s.status || '대기';
      document.getElementById('site-note').value = s.note || '';
    } else {
      document.getElementById('site-name').value = '';
      document.getElementById('site-location').value = '';
      document.getElementById('site-client').value = '';
      document.getElementById('site-amount').value = '';
      document.getElementById('site-start').value = '';
      document.getElementById('site-end').value = '';
      document.getElementById('site-progress').value = 0;
      document.getElementById('site-progress-val').textContent = '0%';
      document.getElementById('site-status').value = '대기';
      document.getElementById('site-note').value = '';
    }

    modal.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('siteModal').classList.add('hidden');
    editingId = null;
  }

  function saveSite() {
    const name = document.getElementById('site-name').value.trim();
    const location = document.getElementById('site-location').value.trim();
    if (!name) { App.showToast('현장명을 입력하세요.', 'warning'); return; }
    if (!location) { App.showToast('위치를 입력하세요.', 'warning'); return; }

    const data = {
      name,
      location,
      client: document.getElementById('site-client').value.trim(),
      amount: parseFloat(document.getElementById('site-amount').value) || 0,
      startDate: document.getElementById('site-start').value,
      endDate: document.getElementById('site-end').value,
      progress: parseInt(document.getElementById('site-progress').value) || 0,
      status: document.getElementById('site-status').value,
      note: document.getElementById('site-note').value.trim(),
    };

    if (editingId) {
      DB.Sites.update(editingId, data);
      App.showToast('현장 정보가 수정되었습니다.', 'success');
    } else {
      DB.Sites.add(data);
      App.showToast('현장이 추가되었습니다.', 'success');
    }

    closeModal();
    renderTable();
  }

  function deleteSite(id) {
    const s = DB.Sites.getById(id);
    if (!s) return;
    if (!confirm(`"${s.name}" 현장을 삭제하시겠습니까?\n관련 배정 및 일정도 함께 삭제됩니다.`)) return;
    DB.Sites.remove(id);
    App.showToast('현장이 삭제되었습니다.', 'info');
    renderTable();
  }

  return { init, openModal, closeModal, saveSite, deleteSite };
})();
