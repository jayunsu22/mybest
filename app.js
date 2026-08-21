document.addEventListener('DOMContentLoaded', async () => {
    const n8nBase = "https://primary-production-a6fa.up.railway.app";
    const API_GET_URL = `${n8nBase}/webhook/taste-get`;
    const API_ITEM_SAVE_URL = `${n8nBase}/webhook/taste-item-save`;

    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('errorMessage');
    const emptyEl = document.getElementById('emptyState');
    const categoriesEl = document.getElementById('categories');
    const toastEl = document.getElementById('toast');
    const refreshBtn = document.getElementById('refreshBtn');

    let categoriesData = [];
    let activeCategory = null;

    function showToast(message, type = 'success') {
        toastEl.textContent = message;
        toastEl.className = `toast show ${type}`;
        setTimeout(() => { toastEl.className = 'toast'; }, 3000);
    }

    function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { ...options, signal: controller.signal })
            .catch(err => {
                if (err.name === 'AbortError') {
                    throw new Error('네트워크 응답이 없습니다. 잠시 후 다시 시도해 주세요.');
                }
                throw err;
            })
            .finally(() => clearTimeout(timer));
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function rankClass(rank) {
        if (rank === 1) return ' item-rank--gold';
        if (rank === 2) return ' item-rank--silver';
        if (rank === 3) return ' item-rank--bronze';
        return '';
    }

    function findListById(listId) {
        for (const category of categoriesData) {
            const found = category.소분류목록.find(l => l.id === listId);
            if (found) return found;
        }
        return null;
    }

    function renderItemMedia(item) {
        const url = item['이미지/링크'];
        const type = window.TasteUtils.detectMediaType(url);
        if (type === 'youtube') {
            const thumb = window.TasteUtils.getYoutubeThumbnail(url);
            return `<a class="item-media" href="${escapeHtml(url)}" target="_blank" rel="noopener">
                        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.제목)} 유튜브 썸네일">
                    </a>`;
        }
        if (type === 'image') {
            return `<a class="item-media" href="${escapeHtml(url)}" target="_blank" rel="noopener">
                        <img src="${escapeHtml(url)}" alt="${escapeHtml(item.제목)} 이미지">
                    </a>`;
        }
        if (type === 'link') {
            return `<a class="item-media item-media-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">🔗 링크 열기</a>`;
        }
        return '';
    }

    function renderItem(item) {
        const media = renderItemMedia(item);
        const hasDetail = Boolean(item.코멘트) || Boolean(media);
        const rankCls = rankClass(item.순위);
        return `
            <li class="item-card${rankCls ? ' item-card--top' : ''}" data-id="${item.id}">
                <span class="drag-handle" title="드래그해서 순서 변경">⠿</span>
                <span class="item-rank${rankCls}">${escapeHtml(item.순위)}위</span>
                <div class="item-body">
                    ${hasDetail
                        ? `<button type="button" class="item-title item-title--expandable" aria-expanded="false">${escapeHtml(item.제목)}<span class="item-title-chevron">▾</span></button>
                           <div class="item-detail" hidden>
                               ${item.코멘트 ? `<div class="item-comment">${escapeHtml(item.코멘트)}</div>` : ''}
                               ${media}
                           </div>`
                        : `<div class="item-title">${escapeHtml(item.제목)}</div>`
                    }
                </div>
            </li>`;
    }

    function renderList(list) {
        const items = list.항목 && list.항목.length
            ? list.항목.map(renderItem).join('')
            : '<li class="item-empty">아직 등록된 항목이 없어요.</li>';
        return `
            <div class="list-card">
                <div class="list-title-row">
                    <h3 class="list-title list-title--collapsed" data-list-id="${list.id}">
                        <span class="list-title-chevron">▾</span>${escapeHtml(list.소분류명)}
                    </h3>
                    <button type="button" class="btn-quick-add" data-list-id="${list.id}">+ 추가</button>
                </div>
                <div class="list-body" hidden>
                    <div class="quick-add-panel" data-list-id="${list.id}" hidden>
                        <input type="text" class="quick-add-title" placeholder="제목을 입력하세요">
                        <div class="quick-add-actions">
                            <button type="button" class="quick-add-save" data-list-id="${list.id}">저장</button>
                            <button type="button" class="quick-add-cancel">취소</button>
                        </div>
                    </div>
                    <ol class="item-list" data-list-id="${list.id}">${items}</ol>
                </div>
            </div>`;
    }

    function render(categories) {
        if (!categories || categories.length === 0) {
            emptyEl.style.display = 'block';
            categoriesEl.innerHTML = '';
            return;
        }
        emptyEl.style.display = 'none';

        const names = categories.map(c => c.대분류);
        if (!activeCategory || !names.includes(activeCategory)) {
            activeCategory = names[0];
        }

        const tabs = `<div class="category-tabs">${names.map(name => `
            <button type="button" class="category-tab${name === activeCategory ? ' category-tab--active' : ''}" data-category="${escapeHtml(name)}">${escapeHtml(name)}</button>
        `).join('')}</div>`;

        const sections = categories.map(category => `
            <section class="category-section" data-category="${escapeHtml(category.대분류)}"${category.대분류 === activeCategory ? '' : ' hidden'}>
                <div class="list-grid">${category.소분류목록.map(renderList).join('')}</div>
            </section>`).join('');

        categoriesEl.innerHTML = tabs + sections;
        categoriesEl.querySelectorAll('.item-list').forEach(ol => {
            setupDragReorder(ol, ol.dataset.listId);
        });
    }

    // 항목을 손가락(또는 마우스)으로 드래그해서 순서를 바꾸는 기능.
    // 드래그가 끝나면 그 소분류 안의 항목 순위를 1..N으로 다시 매겨서 바뀐 것만 저장한다.
    function setupDragReorder(olEl, listId) {
        olEl.querySelectorAll('.item-card').forEach(row => {
            const handle = row.querySelector('.drag-handle');
            if (!handle) return;

            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const dragEl = row;
                dragEl.classList.add('dragging');
                try { handle.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저는 미지원 */ }

                const onMove = (ev) => {
                    ev.preventDefault();
                    const rows = [...olEl.querySelectorAll('.item-card:not(.dragging)')];
                    const y = ev.clientY;
                    const next = rows.find(r => {
                        const rect = r.getBoundingClientRect();
                        return y < rect.top + rect.height / 2;
                    });
                    if (next) {
                        olEl.insertBefore(dragEl, next);
                    } else {
                        olEl.appendChild(dragEl);
                    }
                };

                const onUp = async (ev) => {
                    dragEl.classList.remove('dragging');
                    try { handle.releasePointerCapture(ev.pointerId); } catch (err) { /* noop */ }
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    await persistNewOrder(olEl, listId);
                };

                document.addEventListener('pointermove', onMove, { passive: false });
                document.addEventListener('pointerup', onUp);
            });
        });
    }

    async function persistNewOrder(olEl, listId) {
        const list = findListById(listId);
        if (!list) return;
        const rows = [...olEl.querySelectorAll('.item-card')];
        const updates = [];
        rows.forEach((row, idx) => {
            const itemId = row.dataset.id;
            const item = list.항목.find(i => i.id === itemId);
            const newRank = idx + 1;
            if (item && item.순위 !== newRank) {
                updates.push({ ...item, 순위: newRank });
            }
        });
        if (updates.length === 0) return;
        try {
            for (const item of updates) {
                const payload = window.AdminUtils.buildItemPayload({
                    제목: item.제목,
                    순위: item.순위,
                    코멘트: item.코멘트,
                    '이미지/링크': item['이미지/링크'],
                    소속목록: listId
                }, item.id);
                const response = await fetchWithTimeout(API_ITEM_SAVE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error('순위 저장 실패');
            }
            showToast('순위가 변경되었습니다.');
            await load();
        } catch (err) {
            showToast(err.message || '순위 저장 중 오류가 발생했습니다.', 'danger');
            await load();
        }
    }

    // 대분류 탭 전환
    categoriesEl.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.category-tab');
        if (!tabBtn) return;
        activeCategory = tabBtn.dataset.category;
        render(categoriesData);
    });

    // 소분류 제목을 탭하면 그 소분류 전체(항목 목록)를 접었다 펼쳤다 함
    categoriesEl.addEventListener('click', (e) => {
        const listTitle = e.target.closest('.list-title');
        if (!listTitle) return;
        const body = listTitle.closest('.list-card').querySelector('.list-body');
        if (!body) return;
        const isHidden = body.hasAttribute('hidden');
        if (isHidden) {
            body.removeAttribute('hidden');
            listTitle.classList.remove('list-title--collapsed');
        } else {
            body.setAttribute('hidden', '');
            listTitle.classList.add('list-title--collapsed');
        }
    });

    // 제목을 탭하면 코멘트/이미지·링크가 펼쳐지는 아코디언, 소분류별 빠른 추가 — 이벤트 위임으로 한 번만 등록
    categoriesEl.addEventListener('click', async (e) => {
        const expandBtn = e.target.closest('.item-title--expandable');
        if (expandBtn) {
            const detail = expandBtn.nextElementSibling;
            if (!detail) return;
            const isHidden = detail.hasAttribute('hidden');
            if (isHidden) {
                detail.removeAttribute('hidden');
                expandBtn.classList.add('item-title--open');
                expandBtn.setAttribute('aria-expanded', 'true');
            } else {
                detail.setAttribute('hidden', '');
                expandBtn.classList.remove('item-title--open');
                expandBtn.setAttribute('aria-expanded', 'false');
            }
            return;
        }

        const quickAddBtn = e.target.closest('.btn-quick-add');
        if (quickAddBtn) {
            const panel = categoriesEl.querySelector(`.quick-add-panel[data-list-id="${quickAddBtn.dataset.listId}"]`);
            if (!panel) return;
            panel.hidden = !panel.hidden;
            if (!panel.hidden) panel.querySelector('.quick-add-title').focus();
            return;
        }

        const cancelBtn = e.target.closest('.quick-add-cancel');
        if (cancelBtn) {
            const panel = cancelBtn.closest('.quick-add-panel');
            panel.hidden = true;
            panel.querySelector('.quick-add-title').value = '';
            return;
        }

        const saveBtn = e.target.closest('.quick-add-save');
        if (saveBtn) {
            const panel = saveBtn.closest('.quick-add-panel');
            const input = panel.querySelector('.quick-add-title');
            const title = input.value.trim();
            if (!title) { input.focus(); return; }
            const listId = saveBtn.dataset.listId;
            const list = findListById(listId);
            const nextRank = (list && list.항목 ? list.항목.length : 0) + 1;
            const payload = window.AdminUtils.buildItemPayload(
                { 제목: title, 순위: nextRank, 코멘트: '', '이미지/링크': '', 소속목록: listId },
                null
            );
            saveBtn.disabled = true;
            try {
                const response = await fetchWithTimeout(API_ITEM_SAVE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error('저장 실패');
                showToast('항목이 추가되었습니다.');
                await load();
            } catch (err) {
                showToast(err.message || '저장 중 오류가 발생했습니다.', 'danger');
            } finally {
                saveBtn.disabled = false;
            }
        }
    });

    async function load() {
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';
        try {
            const response = await fetchWithTimeout(`${API_GET_URL}?_t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('서버 연동 실패');
            const result = await response.json();
            const data = Array.isArray(result) ? result[0] : result;
            categoriesData = (data && data.categories) ? data.categories : [];
            render(categoriesData);
        } catch (error) {
            console.error(error);
            errorEl.textContent = error.message || '데이터를 불러오는 도중 오류가 발생했습니다.';
            errorEl.style.display = 'block';
        } finally {
            loadingEl.style.display = 'none';
        }
    }

    refreshBtn.addEventListener('click', load);

    await load();
});
