/**
 * schedule.js - 공정/일정 관리 페이지
 */
const SchedulePage = (() => {
  let editingId = null;

  function init() {
    populateSiteFilter();
    renderTable();
    renderGantt();
    bindFilter();
  }

  function populateSiteFilter() {
    const sel = document.getElementById('scheduleSiteFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">전체 현장</option>';
    DB.Sites.getAll().forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      if (s.id === current) opt.selected = true;
      sel.appendChild(opt);
    });
    // 모달용 셀렉트도 갱신
    const modalSel = document.getElementById('sched-site');
    if (modalSel) {
      modalSel.innerHTML = '';
      DB.Sites.getAll().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        modalSel.appendChild(opt);
      });
    }
  }

  function bindFilter() {
    const sel = document.getElementById('scheduleSiteFilter');
    if (sel) sel.onchange = () => { renderTable(); renderGantt(); };
  }

  function getFilteredSchedules() {
    const siteId = document.getElementById('scheduleSiteFilter')?.value || '';
    let scheds = DB.Schedules.getAll();
    if (siteId) scheds = scheds.filter(s => s.siteId === siteId);
    return scheds;
  }

  function renderTable() {
    const scheds = getFilteredSchedules();
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    if (scheds.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📅</div><p>등록된 일정이 없습니다.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = scheds.map(s => {
      const site = DB.Sites.getById(s.siteId);
      return `<tr>
        <td><strong>${site?.name || '-'}</strong></td>
        <td>${s.name}</td>
        <td style="color:var(--text-muted)">${App.fmtDate(s.startDate)}</td>
        <td style="color:var(--text-muted)">${App.fmtDate(s.endDate)}</td>
        <td>
          <div class="progress-bar-wrap">
            <div class="progress-bar"><div class="progress-fill" style="width:${s.progress}%"></div></div>
            <span class="progress-text">${s.progress}%</span>
          </div>
        </td>
        <td>${s.manager || '-'}</td>
        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
        <td>
          <button class="btn-icon" onclick="SchedulePage.openModal('${s.id}')">✏️</button>
          <button class="btn-icon" onclick="SchedulePage.deleteSchedule('${s.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  function renderGantt() {
    const scheds = getFilteredSchedules();
    const container = document.getElementById('ganttChart');
    if (!container) return;

    if (scheds.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><p>표시할 일정이 없습니다.</p></div>`;
      return;
    }

    // 전체 기간 계산
    const dates = scheds.flatMap(s => [new Date(s.startDate), new Date(s.endDate)]).filter(d => !isNaN(d));
    if (dates.length === 0) { container.innerHTML = ''; return; }
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalDays = Math.max(1, (maxDate - minDate) / 86400000);

    // 헤더 날짜 행
    let headerHtml = '<div class="gantt-row" style="border-bottom:2px solid var(--border)">';
    headerHtml += '<div class="gantt-label" style="font-weight:700;font-size:11px;color:var(--text-muted)">공정명</div>';
    headerHtml += '<div style="flex:1;font-size:10px;color:var(--text-muted);display:flex;justify-content:space-between;padding:0 4px">';
    headerHtml += `<span>${minDate.toISOString().slice(0,10)}</span>`;
    headerHtml += `<span>${new Date((minDate.getTime() + maxDate.getTime()) / 2).toISOString().slice(0,10)}</span>`;
    headerHtml += `<span>${maxDate.toISOString().slice(0,10)}</span>`;
    headerHtml += '</div></div>';

    const rowsHtml = scheds.map(s => {
      const site = DB.Sites.getById(s.siteId);
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      if (isNaN(start) || isNaN(end)) return '';

      const startOffset = Math.max(0, (start - minDate) / 86400000);
      const duration = Math.max(1, (end - start) / 86400000);
      const leftPct = (startOffset / totalDays * 100).toFixed(1);
      const widthPct = Math.min(100 - parseFloat(leftPct), (duration / totalDays * 100)).toFixed(1);

      let barClass = 'gantt-bar';
      if (s.status === '완료') barClass += ' completed';
      else if (s.status === '지연') barClass += ' delayed';

      const label = site ? `${site.name.slice(0,6)} / ${s.name}` : s.name;

      return `<div class="gantt-row">
        <div class="gantt-label" title="${label}">${label.length > 16 ? label.slice(0,16) + '…' : label}</div>
        <div class="gantt-track">
          <div class="${barClass}" style="left:${leftPct}%;width:${widthPct}%" title="${s.name}: ${s.progress}%">
            ${parseFloat(widthPct) > 12 ? s.progress + '%' : ''}
          </div>
        </div>
      </div>`;
    }).filter(Boolean).join('');

    container.innerHTML = headerHtml + rowsHtml;
  }

  function openModal(id = null) {
    editingId = id;
    populateSiteFilter();
    document.getElementById('scheduleModalTitle').textContent = id ? '일정 수정' : '일정 추가';

    if (id) {
      const s = DB.Schedules.getAll().find(s => s.id === id);
      if (!s) return;
      document.getElementById('sched-site').value = s.siteId || '';
      document.getElementById('sched-name').value = s.name || '';
      document.getElementById('sched-start').value = s.startDate || '';
      document.getElementById('sched-end').value = s.endDate || '';
      document.getElementById('sched-manager').value = s.manager || '';
      document.getElementById('sched-progress').value = s.progress || 0;
      document.getElementById('sched-progress-val').textContent = (s.progress || 0) + '%';
      document.getElementById('sched-status').value = s.status || '예정';
    } else {
      document.getElementById('sched-name').value = '';
      document.getElementById('sched-start').value = '';
      document.getElementById('sched-end').value = '';
      document.getElementById('sched-manager').value = '';
      document.getElementById('sched-progress').value = 0;
      document.getElementById('sched-progress-val').textContent = '0%';
      document.getElementById('sched-status').value = '예정';
    }

    document.getElementById('scheduleModal').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('scheduleModal').classList.add('hidden');
    editingId = null;
  }

  function saveSchedule() {
    const siteId = document.getElementById('sched-site').value;
    const name = document.getElementById('sched-name').value.trim();
    const startDate = document.getElementById('sched-start').value;
    const endDate = document.getElementById('sched-end').value;

    if (!siteId) { App.showToast('현장을 선택하세요.', 'warning'); return; }
    if (!name) { App.showToast('공정명을 입력하세요.', 'warning'); return; }
    if (!startDate || !endDate) { App.showToast('시작일과 완료예정일을 입력하세요.', 'warning'); return; }
    if (new Date(endDate) < new Date(startDate)) { App.showToast('완료예정일은 시작일 이후여야 합니다.', 'warning'); return; }

    const data = {
      siteId,
      name,
      startDate,
      endDate,
      manager: document.getElementById('sched-manager').value.trim(),
      progress: parseInt(document.getElementById('sched-progress').value) || 0,
      status: document.getElementById('sched-status').value,
    };

    if (editingId) {
      DB.Schedules.update(editingId, data);
      App.showToast('일정이 수정되었습니다.', 'success');
    } else {
      DB.Schedules.add(data);
      App.showToast('일정이 추가되었습니다.', 'success');
    }

    closeModal();
    renderTable();
    renderGantt();
  }

  function deleteSchedule(id) {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    DB.Schedules.remove(id);
    App.showToast('일정이 삭제되었습니다.', 'info');
    renderTable();
    renderGantt();
  }

  return { init, openModal, closeModal, saveSchedule, deleteSchedule };
})();
