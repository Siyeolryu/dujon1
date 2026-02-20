/**
 * data.js - 로컬 스토리지 기반 데이터 레이어
 * 저장: localStorage → 엑셀 내보내기/불러오기 지원
 */
const DB = (() => {
  const KEYS = {
    sites: 'cm_sites',
    staff: 'cm_staff',
    assignments: 'cm_assignments',
    schedules: 'cm_schedules',
    exportHistory: 'cm_export_history',
  };

  // UUID 생성
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---- 범용 CRUD ----
  function getAll(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function saveAll(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  }
  function getById(key, id) {
    return getAll(key).find(r => r.id === id) || null;
  }
  function insert(key, data) {
    const arr = getAll(key);
    const record = { id: uid(), createdAt: new Date().toISOString(), ...data };
    arr.push(record);
    saveAll(key, arr);
    return record;
  }
  function update(key, id, data) {
    const arr = getAll(key);
    const idx = arr.findIndex(r => r.id === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...data, updatedAt: new Date().toISOString() };
    saveAll(key, arr);
    return arr[idx];
  }
  function remove(key, id) {
    const arr = getAll(key).filter(r => r.id !== id);
    saveAll(key, arr);
  }

  // ---- 현장 ----
  const Sites = {
    getAll: () => getAll(KEYS.sites),
    getById: id => getById(KEYS.sites, id),
    add: data => insert(KEYS.sites, data),
    update: (id, data) => update(KEYS.sites, id, data),
    remove: id => {
      remove(KEYS.sites, id);
      // 관련 배정 삭제
      const assigns = Assignments.getAll().filter(a => a.siteId !== id);
      saveAll(KEYS.assignments, assigns);
      // 관련 일정 삭제
      const scheds = Schedules.getAll().filter(s => s.siteId !== id);
      saveAll(KEYS.schedules, scheds);
    },
  };

  // ---- 직원/소장 ----
  const Staff = {
    getAll: () => getAll(KEYS.staff),
    getById: id => getById(KEYS.staff, id),
    add: data => insert(KEYS.staff, data),
    update: (id, data) => update(KEYS.staff, id, data),
    remove: id => {
      remove(KEYS.staff, id);
      const assigns = Assignments.getAll().filter(a => a.staffId !== id);
      saveAll(KEYS.assignments, assigns);
    },
  };

  // ---- 배정 ----
  const Assignments = {
    getAll: () => getAll(KEYS.assignments),
    getBySite: siteId => getAll(KEYS.assignments).filter(a => a.siteId === siteId),
    getByStaff: staffId => getAll(KEYS.assignments).filter(a => a.staffId === staffId),
    add: data => insert(KEYS.assignments, { assignedAt: new Date().toISOString(), ...data }),
    remove: id => remove(KEYS.assignments, id),
    removeBySiteStaff: (siteId, staffId) => {
      const arr = getAll(KEYS.assignments).filter(a => !(a.siteId === siteId && a.staffId === staffId));
      saveAll(KEYS.assignments, arr);
    },
    clearAll: () => saveAll(KEYS.assignments, []),
  };

  // ---- 일정 ----
  const Schedules = {
    getAll: () => getAll(KEYS.schedules),
    getBySite: siteId => getAll(KEYS.schedules).filter(s => s.siteId === siteId),
    add: data => insert(KEYS.schedules, data),
    update: (id, data) => update(KEYS.schedules, id, data),
    remove: id => remove(KEYS.schedules, id),
  };

  // ---- 내보내기 이력 ----
  const ExportHistory = {
    getAll: () => getAll(KEYS.exportHistory),
    add: data => insert(KEYS.exportHistory, data),
    clear: () => saveAll(KEYS.exportHistory, []),
  };

  // ---- 샘플 데이터 초기화 ----
  function resetWithSampleData() {
    // 초기화
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));

    // 현장 샘플
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

    const siteData = [
      { name: '강남 오피스텔 신축', location: '서울 강남구 역삼동', client: '(주)강남개발', amount: 85, startDate: fmt(addDays(today, -180)), endDate: fmt(addDays(today, 90)), progress: 67, status: '진행', note: '지하 3층 지상 15층' },
      { name: '판교 물류센터 증축', location: '경기 성남시 판교동', client: '판교로지스', amount: 42, startDate: fmt(addDays(today, -90)), endDate: fmt(addDays(today, 120)), progress: 35, status: '진행', note: '' },
      { name: '인천 공장 리모델링', location: '인천시 남동구 논현동', client: '인천제조(주)', amount: 28, startDate: fmt(addDays(today, -240)), endDate: fmt(addDays(today, 30)), progress: 88, status: '진행', note: '전기 설비 교체 포함' },
      { name: '수원 아파트 단지', location: '경기 수원시 영통구', client: '수원주택공사', amount: 220, startDate: fmt(addDays(today, -30)), endDate: fmt(addDays(today, 540)), progress: 12, status: '진행', note: '5개동 400세대' },
      { name: '부산 해운대 상가', location: '부산 해운대구 우동', client: '해운대부동산', amount: 55, startDate: fmt(addDays(today, 14)), endDate: fmt(addDays(today, 300)), progress: 0, status: '대기', note: '착공 준비 중' },
      { name: '대전 역사 리모델링', location: '대전시 동구 중앙로', client: '코레일', amount: 38, startDate: fmt(addDays(today, -365)), endDate: fmt(addDays(today, -10)), progress: 100, status: '완료', note: '준공 완료' },
    ];
    const sites = siteData.map(s => {
      const r = insert(KEYS.sites, s);
      return r;
    });

    // 직원 샘플
    const staffData = [
      { name: '김현수', role: '소장', phone: '010-1234-5678', email: 'kim@example.com', cert: '건축사, 건설안전기사', joinDate: '2018-03-01', status: '재직' },
      { name: '이민준', role: '소장', phone: '010-2345-6789', email: 'lee@example.com', cert: '토목기사, 품질관리기사', joinDate: '2019-07-15', status: '재직' },
      { name: '박서연', role: '부소장', phone: '010-3456-7890', email: 'park@example.com', cert: '건축기사', joinDate: '2020-02-01', status: '재직' },
      { name: '최지훈', role: '현장대리인', phone: '010-4567-8901', email: 'choi@example.com', cert: '건축산업기사', joinDate: '2021-05-10', status: '재직' },
      { name: '정수아', role: '안전관리자', phone: '010-5678-9012', email: 'jung@example.com', cert: '산업안전기사', joinDate: '2022-01-03', status: '재직' },
      { name: '한동훈', role: '소장', phone: '010-6789-0123', email: 'han@example.com', cert: '토목기사', joinDate: '2017-09-01', status: '재직' },
      { name: '윤지영', role: '직원', phone: '010-7890-1234', email: 'yoon@example.com', cert: '', joinDate: '2023-03-15', status: '재직' },
      { name: '강민호', role: '현장대리인', phone: '010-8901-2345', email: 'kang@example.com', cert: '건설기계기사', joinDate: '2020-11-01', status: '재직' },
    ];
    const staffList = staffData.map(s => insert(KEYS.staff, s));

    // 배정 샘플 (현장0→소장0, 현장1→소장1, 현장2→소장5)
    insert(KEYS.assignments, { siteId: sites[0].id, staffId: staffList[0].id, assignedAt: new Date().toISOString() });
    insert(KEYS.assignments, { siteId: sites[0].id, staffId: staffList[2].id, assignedAt: new Date().toISOString() });
    insert(KEYS.assignments, { siteId: sites[1].id, staffId: staffList[1].id, assignedAt: new Date().toISOString() });
    insert(KEYS.assignments, { siteId: sites[2].id, staffId: staffList[5].id, assignedAt: new Date().toISOString() });
    insert(KEYS.assignments, { siteId: sites[3].id, staffId: staffList[7].id, assignedAt: new Date().toISOString() });

    // 일정 샘플
    const schedData = [
      { siteId: sites[0].id, name: '기초 공사', startDate: fmt(addDays(today, -180)), endDate: fmt(addDays(today, -120)), progress: 100, manager: '김현수', status: '완료' },
      { siteId: sites[0].id, name: '골조 공사', startDate: fmt(addDays(today, -120)), endDate: fmt(addDays(today, -30)), progress: 100, manager: '김현수', status: '완료' },
      { siteId: sites[0].id, name: '외장 공사', startDate: fmt(addDays(today, -30)), endDate: fmt(addDays(today, 45)), progress: 55, manager: '박서연', status: '진행' },
      { siteId: sites[0].id, name: '내장 공사', startDate: fmt(addDays(today, 20)), endDate: fmt(addDays(today, 80)), progress: 0, manager: '박서연', status: '예정' },
      { siteId: sites[1].id, name: '터파기', startDate: fmt(addDays(today, -90)), endDate: fmt(addDays(today, -60)), progress: 100, manager: '이민준', status: '완료' },
      { siteId: sites[1].id, name: '골조 증축', startDate: fmt(addDays(today, -60)), endDate: fmt(addDays(today, 60)), progress: 45, manager: '이민준', status: '진행' },
      { siteId: sites[2].id, name: '철거 작업', startDate: fmt(addDays(today, -240)), endDate: fmt(addDays(today, -200)), progress: 100, manager: '한동훈', status: '완료' },
      { siteId: sites[2].id, name: '전기 설비', startDate: fmt(addDays(today, -200)), endDate: fmt(addDays(today, -60)), progress: 100, manager: '한동훈', status: '완료' },
      { siteId: sites[2].id, name: '마감 공사', startDate: fmt(addDays(today, -60)), endDate: fmt(addDays(today, 30)), progress: 75, manager: '한동훈', status: '지연' },
    ];
    schedData.forEach(s => insert(KEYS.schedules, s));
  }

  // 데이터 존재 여부 확인 (최초 방문시 샘플 로드)
  function initIfEmpty() {
    if (getAll(KEYS.sites).length === 0) {
      resetWithSampleData();
    }
  }

  return { Sites, Staff, Assignments, Schedules, ExportHistory, resetWithSampleData, initIfEmpty, uid };
})();
