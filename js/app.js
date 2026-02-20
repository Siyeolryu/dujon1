/**
 * app.js - 앱 코어: 라우팅, 공통 유틸, 엑셀 내보내기
 */
const App = (() => {
  const pages = {
    dashboard: { title: '대시보드', breadcrumb: '홈 / 대시보드', init: () => DashboardPage.init() },
    sites:     { title: '현장 목록', breadcrumb: '홈 / 현장 목록', init: () => SitesPage.init() },
    staff:     { title: '소장/직원', breadcrumb: '홈 / 소장·직원', init: () => StaffPage.init() },
    assign:    { title: '빠른 배정', breadcrumb: '홈 / 빠른 배정', init: () => AssignPage.init() },

    export:    { title: '엑셀 관리', breadcrumb: '홈 / 엑셀 관리', init: () => ExportPage.init() },
  };
  let currentPage = 'dashboard';

  function navigate(pageId) {
    if (!pages[pageId]) return;
    currentPage = pageId;

    // 페이지 표시
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + pageId)?.classList.remove('hidden');

    // 네비 활성화
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.page === pageId);
    });

    // 제목
    document.getElementById('pageTitle').textContent = pages[pageId].title;
    document.getElementById('breadcrumb').textContent = pages[pageId].breadcrumb;

    // 페이지 초기화
    pages[pageId].init();

    // 배지 업데이트
    updateBadge();
  }

  function updateBadge() {
    const allSites = DB.Sites.getAll();
    const assigns = DB.Assignments.getAll();
    const assignedSiteIds = new Set(assigns.map(a => a.siteId));
    const unassigned = allSites.filter(s => s.status !== '완료' && !assignedSiteIds.has(s.id)).length;
    const badge = document.getElementById('unassignedBadge');
    badge.textContent = unassigned;
    badge.style.display = unassigned > 0 ? '' : 'none';
  }

  function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    el.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ---- 엑셀 내보내기 ----
  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      showToast('XLSX 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도하세요.', 'warning');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 현장 시트
    const sitesData = DB.Sites.getAll().map(s => {
      const assigns = DB.Assignments.getBySite(s.id);
      const staffNames = assigns.map(a => {
        const st = DB.Staff.getById(a.staffId);
        return st ? `${st.name}(${st.role})` : '';
      }).filter(Boolean).join(', ');
      return {
        '현장명': s.name, '위치': s.location, '발주처': s.client, '건축사': s.architect || '',
        '공사금액(억)': s.amount, '착공일': s.startDate, '준공예정일': s.endDate,
        '공정률(%)': s.progress, '상태': s.status, '배정소장': staffNames,
        '특이사항': s.special || '', '비고': s.note,
      };
    });
    if (sitesData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sitesData), '현장목록');

    // 직원 시트
    const staffData = DB.Staff.getAll().map(s => {
      const assigns = DB.Assignments.getByStaff(s.id);
      const siteNames = assigns.map(a => {
        const site = DB.Sites.getById(a.siteId);
        return site ? site.name : '';
      }).filter(Boolean).join(', ');
      return {
        '이름': s.name, '직급': s.role, '연락처': s.phone, '이메일': s.email,
        '자격증': s.cert, '입사일': s.joinDate, '상태': s.status, '배정현장': siteNames,
      };
    });
    if (staffData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffData), '소장직원');

    // 배정 시트
    const assignData = DB.Assignments.getAll().map(a => {
      const site = DB.Sites.getById(a.siteId);
      const staff = DB.Staff.getById(a.staffId);
      return {
        '현장명': site?.name || '', '위치': site?.location || '',
        '소장/직원': staff?.name || '', '직급': staff?.role || '',
        '배정일': a.assignedAt ? a.assignedAt.slice(0, 10) : '',
      };
    });
    if (assignData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignData), '배정현황');

    // 파일 저장
    const now = new Date();
    const fname = `현장관리_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.xlsx`;
    XLSX.writeFile(wb, fname);

    // 이력 기록
    DB.ExportHistory.add({
      filename: fname,
      savedAt: now.toISOString(),
      counts: `현장:${sitesData.length}, 직원:${staffData.length}, 배정:${assignData.length}`,
      operator: '관리자',
    });

    showToast(`📊 ${fname} 저장 완료!`, 'success');
    if (currentPage === 'export') ExportPage.init();
  }

  // ---- 엑셀 불러오기 ----
  function importFromExcel(file) {
    if (typeof XLSX === 'undefined') { showToast('XLSX 라이브러리 로드 중입니다.', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });

        // 현장 시트
        if (wb.SheetNames.includes('현장목록')) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets['현장목록']);
          localStorage.removeItem('cm_sites');
          rows.forEach(r => DB.Sites.add({
            name: r['현장명'] || '', location: r['위치'] || '', client: r['발주처'] || '',
            amount: r['공사금액(억)'] || 0, startDate: r['착공일'] || '', endDate: r['준공예정일'] || '',
            progress: r['공정률(%)'] || 0, status: r['상태'] || '대기', note: r['비고'] || '',
          }));
        }
        // 직원 시트
        if (wb.SheetNames.includes('소장직원')) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets['소장직원']);
          localStorage.removeItem('cm_staff');
          rows.forEach(r => DB.Staff.add({
            name: r['이름'] || '', role: r['직급'] || '직원', phone: r['연락처'] || '',
            email: r['이메일'] || '', cert: r['자격증'] || '',
            joinDate: r['입사일'] || '', status: r['상태'] || '재직',
          }));
        }

        showToast('엑셀 데이터를 불러왔습니다.', 'success');
        navigate(currentPage);
      } catch (err) {
        showToast('파일 형식을 확인해주세요. (' + err.message + ')', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function resetData() {
    if (confirm('샘플 데이터로 초기화하시겠습니까?\n현재 데이터가 모두 삭제됩니다.')) {
      DB.resetWithSampleData();
      navigate(currentPage);
      showToast('샘플 데이터로 초기화되었습니다.', 'info');
    }
  }

  // ---- 날짜 포맷 ----
  function fmtDate(iso) {
    if (!iso) return '-';
    return iso.slice(0, 10).replace(/-/g, '.');
  }

  function updateClock() {
    const el = document.getElementById('headerDate');
    if (!el) return;
    const now = new Date();
    const days = ['일','월','화','수','목','금','토'];
    el.textContent = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${days[now.getDay()]})`;
  }

  // ---- 초기화 ----
  function init() {
    DB.initIfEmpty();
    updateClock();
    setInterval(updateClock, 60000);

    // 사이드바 토글
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // 네비게이션
    document.querySelectorAll('.nav-item[data-page]').forEach(a => {
      a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.dataset.page); });
    });

    // 파일 인풋
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) importFromExcel(e.target.files[0]);
      });
    }

    // 업로드 영역 드래그
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.addEventListener('click', () => document.getElementById('fileInput').click());
      uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
      uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
      uploadArea.addEventListener('drop', e => {
        e.preventDefault(); uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) importFromExcel(file);
      });
    }

    navigate('dashboard');
  }

  return { init, navigate, showToast, exportToExcel, resetData, fmtDate, importFromExcel, updateBadge };
})();

window.addEventListener('DOMContentLoaded', () => App.init());
