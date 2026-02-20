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

    // RAG 검색 이벤트 바인딩
    const searchInput = document.getElementById('ragSearchInput');
    const clearBtn = document.getElementById('ragClearBtn');

    if (searchInput) {
      // 기존 리스너 제거 후 재등록 (페이지 재진입 시 중복 방지)
      const newInput = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(newInput, searchInput);

      let debounceTimer;
      newInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => renderSearchResults(e.target.value), 200);
      });
    }

    if (clearBtn) {
      const newBtn = clearBtn.cloneNode(true);
      clearBtn.parentNode.replaceChild(newBtn, clearBtn);

      newBtn.addEventListener('click', () => {
        const inp = document.getElementById('ragSearchInput');
        if (inp) inp.value = '';
        renderSearchResults('');
      });
    }
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

  // ---- RAG 퍼지 검색 ----
  function buildSearchIndex() {
    const sites = DB.Sites.getAll();
    const staff = DB.Staff.getAll();
    const assigns = DB.Assignments.getAll();

    // 현장 인덱스: 모든 텍스트 필드 + 배정 소장명 병합
    const siteIndex = sites.map(s => {
      const siteAssigns = assigns.filter(a => a.siteId === s.id);
      const staffNames = siteAssigns.map(a => {
        const st = DB.Staff.getById(a.staffId);
        return st ? `${st.name} ${st.role}` : '';
      }).filter(Boolean).join(' ');
      const fullText = [
        s.name, s.location, s.client, s.architect,
        s.special, s.note, s.status, staffNames
      ].filter(Boolean).join(' ').toLowerCase();
      return { type: 'site', data: s, fullText, staffNames };
    });

    // 직원 인덱스
    const staffIndex = staff.map(st => {
      const myAssigns = assigns.filter(a => a.staffId === st.id);
      const siteNames = myAssigns.map(a => {
        const site = DB.Sites.getById(a.siteId);
        return site ? site.name : '';
      }).filter(Boolean).join(' ');
      const fullText = [
        st.name, st.role, st.phone, st.cert, st.status, siteNames
      ].filter(Boolean).join(' ').toLowerCase();
      return { type: 'staff', data: st, fullText, siteNames };
    });

    return [...siteIndex, ...staffIndex];
  }

  function fuzzySearch(query) {
    if (!query.trim()) return [];
    const tokens = query.trim().toLowerCase().split(/\s+/);
    const index = buildSearchIndex();

    return index
      .map(item => {
        // 모든 토큰이 fullText에 포함되어야 매칭
        const matched = tokens.every(t => item.fullText.includes(t));
        if (!matched) return null;

        // 점수 계산 (현장명/이름 직접 매칭 시 가중치)
        let score = 0;
        const nameField = item.data.name.toLowerCase();
        tokens.forEach(t => {
          if (nameField.includes(t)) score += 10;
          if (item.fullText.includes(t)) score += 1;
        });
        return { ...item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  function highlight(text, tokens) {
    if (!text) return '-';
    let result = String(text);
    tokens.forEach(t => {
      if (!t) return;
      const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(re, '<mark class="rag-highlight">$1</mark>');
    });
    return result;
  }

  function renderSearchResults(query) {
    const resultsEl = document.getElementById('ragResults');
    const listEl = document.getElementById('ragResultsList');
    const countEl = document.getElementById('ragResultCount');
    const queryEl = document.getElementById('ragResultsQuery');
    const clearBtn = document.getElementById('ragClearBtn');

    if (!resultsEl || !listEl) return;

    if (!query.trim()) {
      resultsEl.classList.add('hidden');
      if (clearBtn) clearBtn.classList.add('hidden');
      return;
    }

    if (clearBtn) clearBtn.classList.remove('hidden');
    const tokens = query.trim().toLowerCase().split(/\s+/);
    const results = fuzzySearch(query);

    if (countEl) countEl.textContent = `${results.length}건`;
    if (queryEl) queryEl.textContent = `"${query}"`;
    resultsEl.classList.remove('hidden');

    if (results.length === 0) {
      listEl.innerHTML = `<div class="rag-no-result">
        <div class="rag-no-result-icon">🔍</div>
        <p>"${query}"에 해당하는 결과가 없습니다.</p>
        <p style="margin-top:4px;font-size:11px">다른 키워드로 검색해보세요.</p>
      </div>`;
      return;
    }

    listEl.innerHTML = results.map(item => {
      if (item.type === 'site') {
        const s = item.data;
        return `<div class="rag-result-item" onclick="App.navigate('sites')">
          <div class="rag-result-icon site">🏗️</div>
          <div class="rag-result-body">
            <div class="rag-result-title">${highlight(s.name, tokens)}</div>
            <div class="rag-result-meta">
              <span>📍 ${highlight(s.location, tokens)}</span>
              ${s.client ? `<span>🏢 ${highlight(s.client, tokens)}</span>` : ''}
              ${s.architect ? `<span>📐 ${highlight(s.architect, tokens)}</span>` : ''}
              ${item.staffNames ? `<span>👷 ${highlight(item.staffNames, tokens)}</span>` : ''}
              ${s.special ? `<span style="color:var(--warning)">⚠️ ${highlight(s.special, tokens)}</span>` : ''}
            </div>
          </div>
          <div class="rag-result-badge">
            <span class="status-badge status-${s.status}">${s.status}</span>
          </div>
        </div>`;
      } else {
        const st = item.data;
        return `<div class="rag-result-item" onclick="App.navigate('staff')">
          <div class="rag-result-icon staff">👷</div>
          <div class="rag-result-body">
            <div class="rag-result-title">${highlight(st.name, tokens)} <small style="font-weight:400;color:var(--text-muted)">${st.role}</small></div>
            <div class="rag-result-meta">
              ${st.phone ? `<span>📞 ${highlight(st.phone, tokens)}</span>` : ''}
              ${st.cert ? `<span>🏅 ${highlight(st.cert, tokens)}</span>` : ''}
              ${item.siteNames ? `<span>🏗️ ${highlight(item.siteNames, tokens)}</span>` : ''}
            </div>
          </div>
          <div class="rag-result-badge">
            <span class="status-badge status-${st.status}">${st.status}</span>
          </div>
        </div>`;
      }
    }).join('');
  }

  return { init };
})();
