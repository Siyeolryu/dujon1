/**
 * staff.js - 소장/직원 목록 페이지 (CRUD)
 */
const StaffPage = (() => {
  let editingId = null;

  function init() {
    renderTable();
    bindSearch();
  }

  function bindSearch() {
    const search = document.getElementById('staffSearch');
    const filter = document.getElementById('staffRoleFilter');
    if (search) search.oninput = renderTable;
    if (filter) filter.onchange = renderTable;
  }

  function renderTable() {
    const search = (document.getElementById('staffSearch')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('staffRoleFilter')?.value || '';
    const assigns = DB.Assignments.getAll();

    let staff = DB.Staff.getAll();
    if (search) staff = staff.filter(s =>
      s.name.toLowerCase().includes(search) ||
      (s.cert || '').toLowerCase().includes(search) ||
      (s.phone || '').includes(search)
    );
    if (roleFilter) staff = staff.filter(s => s.role === roleFilter);

    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;

    if (staff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">👷</div><p>직원이 없습니다. '+ 직원 추가'를 눌러 등록하세요.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = staff.map(s => {
      const myAssigns = assigns.filter(a => a.staffId === s.id);
      const siteNames = myAssigns.map(a => {
        const site = DB.Sites.getById(a.siteId);
        return site ? `<span class="status-badge status-진행">${site.name}</span>` : '';
      }).filter(Boolean).join(' ') || `<span style="color:var(--text-light)">미배정</span>`;

      const initials = s.name.slice(0, 1);

      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="staff-avatar" style="width:32px;height:32px;font-size:12px">${initials}</div>
            <div>
              <div style="font-weight:600">${s.name}</div>
              <div style="font-size:11px;color:var(--text-muted)">${s.email || ''}</div>
            </div>
          </div>
        </td>
        <td><span class="status-badge status-재직">${s.role}</span></td>
        <td style="color:var(--text-muted)">${s.phone || '-'}</td>
        <td style="font-size:12px;color:var(--text-muted)">${s.cert || '-'}</td>
        <td>${siteNames}</td>
        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
        <td style="color:var(--text-muted)">${App.fmtDate(s.joinDate)}</td>
        <td>
          <button class="btn-icon" title="수정" onclick="StaffPage.openModal('${s.id}')">✏️</button>
          <button class="btn-icon" title="삭제" onclick="StaffPage.deleteStaff('${s.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openModal(id = null) {
    editingId = id;
    document.getElementById('staffModalTitle').textContent = id ? '직원 수정' : '직원 추가';

    if (id) {
      const s = DB.Staff.getById(id);
      if (!s) return;
      document.getElementById('staff-name').value = s.name || '';
      document.getElementById('staff-role').value = s.role || '직원';
      document.getElementById('staff-phone').value = s.phone || '';
      document.getElementById('staff-email').value = s.email || '';
      document.getElementById('staff-cert').value = s.cert || '';
      document.getElementById('staff-join').value = s.joinDate || '';
      document.getElementById('staff-status').value = s.status || '재직';
    } else {
      ['staff-name','staff-phone','staff-email','staff-cert'].forEach(id => {
        document.getElementById(id).value = '';
      });
      document.getElementById('staff-role').value = '소장';
      document.getElementById('staff-join').value = '';
      document.getElementById('staff-status').value = '재직';
    }

    document.getElementById('staffModal').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('staffModal').classList.add('hidden');
    editingId = null;
  }

  function saveStaff() {
    const name = document.getElementById('staff-name').value.trim();
    if (!name) { App.showToast('이름을 입력하세요.', 'warning'); return; }

    const data = {
      name,
      role: document.getElementById('staff-role').value,
      phone: document.getElementById('staff-phone').value.trim(),
      email: document.getElementById('staff-email').value.trim(),
      cert: document.getElementById('staff-cert').value.trim(),
      joinDate: document.getElementById('staff-join').value,
      status: document.getElementById('staff-status').value,
    };

    if (editingId) {
      DB.Staff.update(editingId, data);
      App.showToast('직원 정보가 수정되었습니다.', 'success');
    } else {
      DB.Staff.add(data);
      App.showToast('직원이 추가되었습니다.', 'success');
    }

    closeModal();
    renderTable();
  }

  function deleteStaff(id) {
    const s = DB.Staff.getById(id);
    if (!s) return;
    if (!confirm(`"${s.name}" 직원을 삭제하시겠습니까?\n관련 배정도 함께 해제됩니다.`)) return;
    DB.Staff.remove(id);
    App.showToast('직원이 삭제되었습니다.', 'info');
    renderTable();
  }

  return { init, openModal, closeModal, saveStaff, deleteStaff };
})();
