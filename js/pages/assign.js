/**
 * assign.js - 빠른 배정 페이지 (드래그 앤 드롭)
 */
const AssignPage = (() => {
  let dragStaffId = null;   // 현재 드래그 중인 직원 ID
  let dragStaffName = '';

  function init() {
    renderStaffPool();
    renderSiteCards();
    renderAssignTable();
    bindSearchFilter();
  }

  function bindSearchFilter() {
    const search = document.getElementById('assignStaffSearch');
    const siteFilter = document.getElementById('assignSiteFilter');
    if (search) search.oninput = renderStaffPool;
    if (siteFilter) siteFilter.onchange = renderSiteCards;
  }

  // ---- 소장/직원 풀 렌더 ----
  function renderStaffPool() {
    const search = (document.getElementById('assignStaffSearch')?.value || '').toLowerCase();
    const assigns = DB.Assignments.getAll();
    const assignedStaffIds = new Set(assigns.map(a => a.staffId));

    let staff = DB.Staff.getAll().filter(s => s.status === '재직');
    if (search) staff = staff.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.role.toLowerCase().includes(search)
    );

    const pool = document.getElementById('staffPool');
    if (!pool) return;

    const available = staff.filter(s => !assignedStaffIds.has(s.id)).length;
    const countEl = document.getElementById('availableCount');
    if (countEl) countEl.textContent = `${available}명 가용`;

    if (staff.length === 0) {
      pool.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👷</div><p>검색 결과 없음</p></div>`;
      return;
    }

    pool.innerHTML = staff.map(s => {
      const isAssigned = assignedStaffIds.has(s.id);
      const myAssigns = assigns.filter(a => a.staffId === s.id);
      const siteInfo = myAssigns.map(a => {
        const site = DB.Sites.getById(a.siteId);
        return site ? site.name : '';
      }).filter(Boolean).join(', ');

      return `<div class="staff-card ${isAssigned ? 'assigned' : ''}"
          draggable="true"
          data-staff-id="${s.id}"
          data-staff-name="${s.name}"
          id="staff-card-${s.id}"
          ondragstart="AssignPage.onStaffDragStart(event, '${s.id}', '${s.name}')"
          ondragend="AssignPage.onStaffDragEnd(event)">
        <div class="staff-avatar">${s.name.slice(0,1)}</div>
        <div class="staff-info-small">
          <div class="staff-name-sm">${s.name}</div>
          <div class="staff-role-sm">${s.role}</div>
          ${siteInfo ? `<div class="staff-site-sm">📍 ${siteInfo}</div>` : ''}
        </div>
        ${isAssigned ? '<span style="font-size:12px">✅</span>' : '<span style="font-size:12px;color:var(--text-light)">⬤</span>'}
      </div>`;
    }).join('');
  }

  // ---- 현장 카드 렌더 ----
  function renderSiteCards() {
    const filterVal = document.getElementById('assignSiteFilter')?.value || '';
    const assigns = DB.Assignments.getAll();
    const assignedSiteIds = new Set(assigns.map(a => a.siteId));

    let sites = DB.Sites.getAll();
    if (filterVal === '미배정') sites = sites.filter(s => !assignedSiteIds.has(s.id) && s.status !== '완료');
    else if (filterVal === '진행') sites = sites.filter(s => s.status === '진행');

    const container = document.getElementById('siteCards');
    if (!container) return;

    if (sites.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏗️</div><p>현장 없음</p></div>`;
      return;
    }

    container.innerHTML = sites.map(s => {
      const siteAssigns = assigns.filter(a => a.siteId === s.id);
      const hasStaff = siteAssigns.length > 0;

      const chipsHtml = siteAssigns.map(a => {
        const st = DB.Staff.getById(a.staffId);
        if (!st) return '';
        return `<span class="assigned-chip">
          ${st.name}
          <button class="chip-remove" onclick="AssignPage.removeAssignment('${a.id}')" title="배정 해제">✕</button>
        </span>`;
      }).filter(Boolean).join('');

      return `<div class="site-drop-card ${hasStaff ? 'has-staff' : ''}"
          data-site-id="${s.id}"
          ondragover="AssignPage.onDragOver(event)"
          ondragleave="AssignPage.onDragLeave(event)"
          ondrop="AssignPage.onDrop(event, '${s.id}')">
        <div class="site-card-header">
          <span class="site-card-name">${s.name}</span>
          <span class="status-badge status-${s.status} site-card-status">${s.status}</span>
        </div>
        <div class="site-card-info">📍 ${s.location} · 공정 ${s.progress}%</div>
        <div class="site-assigned-staff">
          ${chipsHtml || `<span class="site-drop-hint">👆 소장/직원을 여기에 드래그하세요</span>`}
        </div>
      </div>`;
    }).join('');
  }

  // ---- 배정 테이블 렌더 ----
  function renderAssignTable() {
    const assigns = DB.Assignments.getAll();
    const tbody = document.getElementById('assignTableBody');
    if (!tbody) return;

    if (assigns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🔀</div><p>배정된 내용이 없습니다.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = assigns.map(a => {
      const site = DB.Sites.getById(a.siteId);
      const staff = DB.Staff.getById(a.staffId);
      if (!site || !staff) return '';
      return `<tr>
        <td><strong>${site.name}</strong></td>
        <td style="color:var(--text-muted)">${site.location}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="staff-avatar" style="width:28px;height:28px;font-size:11px">${staff.name.slice(0,1)}</div>
            ${staff.name}
          </div>
        </td>
        <td><span class="status-badge status-재직">${staff.role}</span></td>
        <td style="color:var(--text-muted)">${App.fmtDate(a.assignedAt)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="AssignPage.removeAssignment('${a.id}')">해제</button>
        </td>
      </tr>`;
    }).filter(Boolean).join('');
  }

  // ---- 드래그 이벤트 ----
  function onStaffDragStart(event, staffId, staffName) {
    dragStaffId = staffId;
    dragStaffName = staffName;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', staffId);

    const card = event.currentTarget;
    setTimeout(() => card.classList.add('dragging'), 0);
  }

  function onStaffDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
  }

  function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    event.currentTarget.classList.add('drag-over');
  }

  function onDragLeave(event) {
    // 자식 요소로 이동하는 경우 무시
    if (event.currentTarget.contains(event.relatedTarget)) return;
    event.currentTarget.classList.remove('drag-over');
  }

  function onDrop(event, siteId) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const staffId = event.dataTransfer.getData('text/plain') || dragStaffId;
    if (!staffId) return;

    // 중복 배정 체크
    const existing = DB.Assignments.getAll().find(a => a.siteId === siteId && a.staffId === staffId);
    if (existing) {
      App.showToast('이미 배정된 직원입니다.', 'warning');
      return;
    }

    const staff = DB.Staff.getById(staffId);
    const site = DB.Sites.getById(siteId);
    if (!staff || !site) return;

    DB.Assignments.add({ siteId, staffId, assignedAt: new Date().toISOString() });
    App.showToast(`✅ ${staff.name}님이 "${site.name}"에 배정되었습니다.`, 'success');

    dragStaffId = null;
    dragStaffName = '';

    // 화면 갱신
    renderStaffPool();
    renderSiteCards();
    renderAssignTable();
    App.updateBadge ? App.updateBadge() : null;
  }

  // ---- 배정 해제 ----
  function removeAssignment(assignId) {
    const assign = DB.Assignments.getAll().find(a => a.id === assignId);
    if (!assign) return;
    const staff = DB.Staff.getById(assign.staffId);
    const site = DB.Sites.getById(assign.siteId);
    if (!confirm(`"${staff?.name}" 배정을 해제하시겠습니까?`)) return;
    DB.Assignments.remove(assignId);
    App.showToast(`${staff?.name}님의 배정이 해제되었습니다.`, 'info');
    renderStaffPool();
    renderSiteCards();
    renderAssignTable();
  }

  function clearAll() {
    if (!confirm('모든 배정을 초기화하시겠습니까?')) return;
    DB.Assignments.clearAll();
    App.showToast('배정이 초기화되었습니다.', 'info');
    renderStaffPool();
    renderSiteCards();
    renderAssignTable();
  }

  return { init, onStaffDragStart, onStaffDragEnd, onDragOver, onDragLeave, onDrop, removeAssignment, clearAll };
})();
