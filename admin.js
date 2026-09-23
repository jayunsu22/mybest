document.addEventListener('DOMContentLoaded', async () => {
    const n8nBase = "https://primary-production-a6fa.up.railway.app";
    const API_GET_URL = `${n8nBase}/webhook/taste-get`;
    const API_LIST_SAVE_URL = `${n8nBase}/webhook/taste-list-save`;
    const API_ITEM_SAVE_URL = `${n8nBase}/webhook/taste-item-save`;
    const API_DELETE_URL = `${n8nBase}/webhook/taste-delete`;

    const U = window.AdminUtils;
    const BEST_CHOICES = [3, 5, 10];

    let categories = [];
    // 대분류는 소분류(리스트)에 붙은 이름이라, 리스트를 하나 만들기 전까지는 화면에만 존재한다.
    let pendingCategories = [];
    let editingItemId = null;
    let busy = false;

    const toast = document.getElementById('toast');
    const view = document.getElementById('view');
    const viewTitle = document.getElementById('viewTitle');
    const crumb = document.getElementById('crumb');
    const backBtn = document.getElementById('backBtn');
    const backLabel = document.getElementById('backLabel');
    const loadingEl = document.getElementById('loading');
    const refreshBtn = document.getElementById('refreshBtn');

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
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

    async function post(url, payload, failMessage) {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(failMessage);
    }

    async function loadData() {
        const response = await fetchWithTimeout(`${API_GET_URL}?_t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('데이터를 불러오지 못했습니다.');
        const result = await response.json();
        const data = Array.isArray(result) ? result[0] : result;
        categories = (data && data.categories) || [];
        categories.forEach(category => {
            category.소분류목록.sort((a, b) => (Number(a.표시순서) || 0) - (Number(b.표시순서) || 0));
            category.소분류목록.forEach(list => {
                list.항목.sort((a, b) => (Number(a.순위) || 0) - (Number(b.순위) || 0));
            });
        });
        const names = categories.map(c => c.대분류);
        pendingCategories = pendingCategories.filter(n => !names.includes(n));
    }

    function findListById(listId) {
        for (const category of categories) {
            const found = category.소분류목록.find(l => l.id === listId);
            if (found) return { category, list: found };
        }
        return null;
    }

    function listsOf(categoryName) {
        const category = categories.find(c => c.대분류 === categoryName);
        return category ? category.소분류목록 : [];
    }

    function allCategoryNames() {
        return [...categories.map(c => c.대분류), ...pendingCategories];
    }

    function itemPayload(item, listId, overrides = {}) {
        return U.buildItemPayload({
            제목: item.제목,
            순위: item.순위,
            코멘트: item.코멘트,
            '이미지/링크': item['이미지/링크'],
            소속목록: listId,
            ...overrides
        }, item.id);
    }

    function rankBadge(idx) {
        const tier = idx < 3 ? ` rank--${idx + 1}` : '';
        return `<span class="rank${tier}">${idx + 1}</span>`;
    }

    // ---------- 화면 이동: 주소 # 으로 관리해서 휴대폰 뒤로가기도 동작 ----------
    // #/            대분류 목록
    // #/c/<대분류>  그 대분류의 리스트
    // #/l/<리스트id> 순위 편집
    function parseRoute() {
        const parts = location.hash.replace(/^#\/?/, '').split('/');
        if (parts[0] === 'c' && parts[1]) return { level: 1, category: decodeURIComponent(parts[1]) };
        if (parts[0] === 'l' && parts[1]) return { level: 2, listId: decodeURIComponent(parts[1]) };
        return { level: 0 };
    }

    function go(hash) {
        editingItemId = null;
        if (location.hash !== hash) history.pushState(null, '', hash);
        render();
        window.scrollTo(0, 0);
    }

    function render() {
        const route = parseRoute();
        if (route.level === 2) {
            const found = findListById(route.listId);
            if (found) return renderListView(found.category, found.list);
            return renderHome();
        }
        if (route.level === 1 && allCategoryNames().includes(route.category)) {
            return renderCategoryView(route.category);
        }
        return renderHome();
    }

    function setHeader(title, crumbText, back) {
        viewTitle.textContent = title;
        crumb.textContent = crumbText || '';
        crumb.hidden = !crumbText;
        backBtn.hidden = !back;
        if (back) {
            backLabel.textContent = back.label;
            backBtn.dataset.hash = back.hash;
        }
    }

    // ---------- 1단계: 대분류 ----------
    function renderHome() {
        setHeader('나의 BEST', '', null);
        const tiles = allCategoryNames().map(name => {
            const count = listsOf(name).length;
            return `<button type="button" class="tile" data-action="open-category" data-category="${escapeHtml(name)}">
                <b>${escapeHtml(name)}</b><span>${count ? `리스트 ${count}개` : '비어 있음'}</span>
            </button>`;
        }).join('');
        view.innerHTML = `
            <p class="guide">대분류(예: 영화)를 누르면 그 안의 BEST 리스트를 만들고 고칠 수 있어요.</p>
            <div class="tiles">${tiles}</div>
            <form class="card add-card" data-form="new-category">
                <label for="newCategoryName" class="card-label">새 대분류 만들기</label>
                <div class="add-row">
                    <input type="text" id="newCategoryName" placeholder="예: 영화, 음악, 맛집" autocomplete="off">
                    <button type="submit" class="btn-primary">만들기</button>
                </div>
            </form>`;
    }

    // ---------- 2단계: 대분류 안의 리스트 ----------
    function renderCategoryView(categoryName) {
        setHeader(categoryName, '나의 BEST ›', { label: '나의 BEST', hash: '#/' });
        const lists = listsOf(categoryName);
        const rows = lists.map((list, idx) => {
            const limit = U.parseBestLimit(list.소분류명);
            const first = list.항목[0];
            return `<div class="list-row">
                <button type="button" class="list-open" data-action="open-list" data-id="${list.id}">
                    <span class="list-open-text">
                        <b>${escapeHtml(list.소분류명)}</b>
                        <small>${first ? `1위 ${escapeHtml(first.제목)}` : '아직 비어 있어요'}</small>
                    </span>
                    <span class="count">${list.항목.length}${limit ? `/${limit}` : '개'}</span>
                    <span class="chevron" aria-hidden="true">›</span>
                </button>
                <div class="move-btns">
                    <button type="button" class="icon-btn" data-action="move-list" data-index="${idx}" data-delta="-1" aria-label="위로" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button type="button" class="icon-btn" data-action="move-list" data-index="${idx}" data-delta="1" aria-label="아래로" ${idx === lists.length - 1 ? 'disabled' : ''}>▼</button>
                </div>
            </div>`;
        }).join('');

        view.innerHTML = `
            ${rows ? `<div class="list-rows">${rows}</div>` : '<p class="guide">아직 리스트가 없어요. 아래에서 첫 BEST를 만들어 보세요.</p>'}
            <form class="card add-card" data-form="new-list">
                <label for="newListTopic" class="card-label">새 BEST 리스트</label>
                <input type="text" id="newListTopic" placeholder="무엇의 BEST인가요? 예: 남자배우" autocomplete="off">
                <div class="chips" role="radiogroup" aria-label="몇 위까지">
                    ${BEST_CHOICES.map(n => `<button type="button" class="chip${n === 5 ? ' chip--on' : ''}" data-action="pick-limit" data-limit="${n}" role="radio" aria-checked="${n === 5}">BEST ${n}</button>`).join('')}
                    <button type="button" class="chip" data-action="pick-limit" data-limit="0" role="radio" aria-checked="false">개수 없이</button>
                </div>
                <p class="preview" id="newListPreview"></p>
                <button type="submit" class="btn-primary btn-block">리스트 만들기</button>
            </form>
            <details class="card settings">
                <summary>대분류 설정</summary>
                <form data-form="rename-category" class="add-row">
                    <input type="text" id="renameCategory" value="${escapeHtml(categoryName)}" aria-label="대분류 이름" autocomplete="off">
                    <button type="submit" class="btn-secondary">이름 변경</button>
                </form>
                <p class="hint">대분류를 없애려면 안의 리스트를 모두 삭제하세요.</p>
            </details>`;
        updateNewListPreview();
    }

    function selectedLimit() {
        const on = view.querySelector('.chip--on');
        return on ? Number(on.dataset.limit) : 0;
    }

    function updateNewListPreview() {
        const preview = document.getElementById('newListPreview');
        const topic = document.getElementById('newListTopic');
        if (!preview || !topic) return;
        const title = U.buildListTitle(topic.value, selectedLimit());
        preview.innerHTML = title
            ? `저장될 제목: <b>${escapeHtml(title)}</b>`
            : '예: 남자배우 + BEST 5 → <b>남자배우 BEST5</b>';
    }

    // ---------- 3단계: 순위 편집 ----------
    function renderListView(category, list) {
        setHeader(list.소분류명, `나의 BEST › ${category.대분류} ›`, {
            label: category.대분류, hash: `#/c/${encodeURIComponent(category.대분류)}`
        });
        const limit = U.parseBestLimit(list.소분류명);
        const full = limit && list.항목.length >= limit;

        const rows = list.항목.map((item, idx) => {
            if (item.id === editingItemId) {
                return `<li class="item-row item-row--editing" data-id="${item.id}">
                    <form data-form="edit-item" data-id="${item.id}" class="item-edit">
                        <div class="item-edit-head">${rankBadge(idx)}<b>${idx + 1}위 수정</b></div>
                        <label>제목<input type="text" name="title" value="${escapeHtml(item.제목)}" required></label>
                        <label>한줄 코멘트<textarea name="comment" placeholder="왜 좋은지 짧게">${escapeHtml(item.코멘트)}</textarea></label>
                        <label>이미지·유튜브·링크<input type="url" name="media" value="${escapeHtml(item['이미지/링크'])}" placeholder="https://..."></label>
                        <div class="edit-actions">
                            <button type="button" class="btn-danger" data-action="delete-item" data-id="${item.id}">삭제</button>
                            <button type="button" class="btn-secondary" data-action="cancel-edit">취소</button>
                            <button type="submit" class="btn-primary">저장</button>
                        </div>
                    </form>
                </li>`;
            }
            return `<li class="item-row" data-id="${item.id}">
                ${rankBadge(idx)}
                <button type="button" class="item-open" data-action="edit-item" data-id="${item.id}">
                    <span>${escapeHtml(item.제목)}</span>
                    ${item.코멘트 ? `<small>${escapeHtml(item.코멘트)}</small>` : ''}
                </button>
                <span class="drag-handle" title="끌어서 순위 변경" aria-hidden="true">⠿</span>
            </li>`;
        }).join('');

        view.innerHTML = `
            <div class="card">
                ${rows ? `<ol class="item-list" data-list-id="${list.id}">${rows}</ol>` : '<p class="guide">1위부터 적어보세요.</p>'}
                ${full
                    ? `<p class="done">BEST ${limit} 완성!</p>`
                    : `<form data-form="add-item" class="add-row add-row--item">
                        <input type="text" id="newItemTitle" placeholder="${list.항목.length + 1}위 입력" autocomplete="off" aria-label="${list.항목.length + 1}위 제목">
                        <button type="submit" class="btn-primary">추가</button>
                    </form>`}
            </div>
            <p class="hint">항목을 누르면 코멘트·링크를 수정할 수 있고, ⠿를 끌면 순위가 바뀌어요.</p>
            <details class="card settings">
                <summary>리스트 설정</summary>
                <form data-form="rename-list" class="add-row">
                    <input type="text" id="renameList" value="${escapeHtml(list.소분류명)}" aria-label="리스트 제목" autocomplete="off">
                    <button type="submit" class="btn-secondary">제목 변경</button>
                </form>
                <button type="button" class="btn-danger btn-block" data-action="delete-list">이 리스트 삭제 (항목 ${list.항목.length}개 포함)</button>
            </details>`;

        const ol = view.querySelector('.item-list');
        if (ol && !editingItemId) setupDragReorder(ol, list.id);
    }

    // ---------- 저장 동작 ----------
    async function run(task, successMessage) {
        if (busy) return;
        busy = true;
        view.classList.add('is-busy');
        try {
            await task();
            if (successMessage) showToast(successMessage);
        } catch (err) {
            showToast(err.message || '처리 중 오류가 발생했습니다.', 'danger');
        } finally {
            busy = false;
            view.classList.remove('is-busy');
            await refresh();
        }
    }

    async function saveList(list, categoryName, order, name) {
        const payload = U.buildListPayload({ 소분류명: name, 대분류: categoryName, 표시순서: order }, list ? list.id : null);
        await post(API_LIST_SAVE_URL, payload, '리스트 저장 실패');
    }

    async function saveListOrder(categoryName, orderedLists) {
        for (const list of U.renumber(orderedLists, '표시순서')) {
            await saveList(list, categoryName, list.표시순서, list.소분류명);
        }
    }

    async function saveItemOrder(listId, orderedItems) {
        for (const item of U.renumber(orderedItems, '순위')) {
            await post(API_ITEM_SAVE_URL, itemPayload(item, listId), '순위 저장 실패');
        }
    }

    // 항목을 손가락(또는 마우스)으로 드래그해서 순서를 바꾸는 기능.
    // 드래그가 끝나면 그 소분류 안의 항목 순위를 1..N으로 다시 매겨서 바뀐 것만 저장한다.
    function setupDragReorder(olEl, listId) {
        olEl.querySelectorAll('.item-row').forEach(row => {
            const handle = row.querySelector('.drag-handle');
            if (!handle) return;

            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                row.classList.add('dragging');
                try { handle.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저는 미지원 */ }

                const onMove = (ev) => {
                    ev.preventDefault();
                    const rows = [...olEl.querySelectorAll('.item-row:not(.dragging)')];
                    const next = rows.find(r => {
                        const rect = r.getBoundingClientRect();
                        return ev.clientY < rect.top + rect.height / 2;
                    });
                    if (next) olEl.insertBefore(row, next);
                    else olEl.appendChild(row);
                };

                const onUp = async (ev) => {
                    row.classList.remove('dragging');
                    try { handle.releasePointerCapture(ev.pointerId); } catch (err) { /* noop */ }
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    const found = findListById(listId);
                    if (!found) return;
                    const ordered = [...olEl.querySelectorAll('.item-row')]
                        .map(r => found.list.항목.find(i => i.id === r.dataset.id))
                        .filter(Boolean);
                    if (U.renumber(ordered, '순위').length === 0) return;
                    await run(() => saveItemOrder(listId, ordered), '순위가 변경되었습니다.');
                };

                document.addEventListener('pointermove', onMove, { passive: false });
                document.addEventListener('pointerup', onUp);
            });
        });
    }

    view.addEventListener('input', (e) => {
        if (e.target.id === 'newListTopic') updateNewListPreview();
    });

    view.addEventListener('click', async (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const route = parseRoute();
        const action = el.dataset.action;

        if (action === 'open-category') {
            go(`#/c/${encodeURIComponent(el.dataset.category)}`);
        } else if (action === 'open-list') {
            go(`#/l/${encodeURIComponent(el.dataset.id)}`);
        } else if (action === 'pick-limit') {
            view.querySelectorAll('.chip').forEach(chip => {
                const on = chip === el;
                chip.classList.toggle('chip--on', on);
                chip.setAttribute('aria-checked', String(on));
            });
            updateNewListPreview();
        } else if (action === 'move-list') {
            const lists = listsOf(route.category);
            const moved = U.moveInArray(lists, Number(el.dataset.index), Number(el.dataset.delta));
            if (moved) await run(() => saveListOrder(route.category, moved), '순서가 변경되었습니다.');
        } else if (action === 'edit-item') {
            editingItemId = el.dataset.id;
            render();
            const input = view.querySelector('.item-row--editing input[name="title"]');
            if (input) input.focus();
        } else if (action === 'cancel-edit') {
            editingItemId = null;
            render();
        } else if (action === 'delete-item') {
            const found = findListById(route.listId);
            if (!found || !confirm('이 항목을 삭제할까요?')) return;
            const rest = found.list.항목.filter(i => i.id !== el.dataset.id);
            editingItemId = null;
            await run(async () => {
                await post(API_DELETE_URL, { type: 'item', id: el.dataset.id }, '삭제 실패');
                await saveItemOrder(found.list.id, rest);
            }, '삭제되었습니다.');
        } else if (action === 'delete-list') {
            const found = findListById(route.listId);
            if (!found) return;
            const { category, list } = found;
            if (!confirm(`"${list.소분류명}"을(를) 삭제하면 항목 ${list.항목.length}개도 함께 삭제됩니다. 계속할까요?`)) return;
            // 리스트가 사라진 뒤 돌아갈 곳. 마지막 리스트였으면 빈 대분류로 남겨 둔다.
            if (category.소분류목록.length === 1) pendingCategories.push(category.대분류);
            await run(async () => {
                for (const step of U.buildDeletePlan(list)) {
                    await post(API_DELETE_URL, step, '삭제 실패');
                }
            }, '삭제되었습니다.');
            go(`#/c/${encodeURIComponent(category.대분류)}`);
        }
    });

    view.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const route = parseRoute();
        const kind = form.dataset.form;

        if (kind === 'new-category') {
            const name = document.getElementById('newCategoryName').value.trim();
            if (!name) { showToast('대분류 이름을 입력해 주세요.', 'danger'); return; }
            if (!allCategoryNames().includes(name)) pendingCategories.push(name);
            go(`#/c/${encodeURIComponent(name)}`);
            const topic = document.getElementById('newListTopic');
            if (topic) topic.focus();
            showToast(`"${name}"이(가) 생겼어요. 첫 리스트를 만들면 저장됩니다.`);
        } else if (kind === 'new-list') {
            const name = U.buildListTitle(document.getElementById('newListTopic').value, selectedLimit());
            const { valid, errors } = U.validateListForm({ 소분류명: name, 대분류: route.category });
            if (!valid) { showToast(errors.join(' '), 'danger'); return; }
            const lists = listsOf(route.category);
            const order = lists.reduce((max, l) => Math.max(max, Number(l.표시순서) || 0), 0) + 1;
            await run(() => saveList(null, route.category, order, name), `"${name}" 리스트를 만들었어요.`);
            const created = listsOf(route.category).find(l => l.소분류명 === name && !lists.includes(l));
            if (created) go(`#/l/${encodeURIComponent(created.id)}`);
        } else if (kind === 'rename-category') {
            const newName = document.getElementById('renameCategory').value.trim();
            if (!newName || newName === route.category) return;
            const lists = listsOf(route.category);
            if (lists.length === 0) {
                pendingCategories = pendingCategories.map(n => (n === route.category ? newName : n));
                go(`#/c/${encodeURIComponent(newName)}`);
                return;
            }
            await run(async () => {
                for (const list of lists) await saveList(list, newName, list.표시순서, list.소분류명);
            }, '대분류 이름을 바꿨어요.');
            go(`#/c/${encodeURIComponent(newName)}`);
        } else if (kind === 'add-item') {
            const input = document.getElementById('newItemTitle');
            const title = input.value.trim();
            if (!title) { input.focus(); return; }
            const found = findListById(route.listId);
            if (!found) return;
            const payload = U.buildItemPayload(
                { 제목: title, 순위: found.list.항목.length + 1, 코멘트: '', '이미지/링크': '', 소속목록: found.list.id },
                null
            );
            await run(() => post(API_ITEM_SAVE_URL, payload, '저장 실패'), `${payload.순위}위에 추가했어요.`);
            const next = document.getElementById('newItemTitle');
            if (next) next.focus();
        } else if (kind === 'edit-item') {
            const found = findListById(route.listId);
            const item = found && found.list.항목.find(i => i.id === form.dataset.id);
            if (!item) return;
            const payload = itemPayload(item, found.list.id, {
                제목: form.elements.title.value,
                코멘트: form.elements.comment.value,
                '이미지/링크': form.elements.media.value
            });
            const { valid, errors } = U.validateItemForm(payload);
            if (!valid) { showToast(errors.join(' '), 'danger'); return; }
            editingItemId = null;
            await run(() => post(API_ITEM_SAVE_URL, payload, '저장 실패'), '저장했어요.');
        } else if (kind === 'rename-list') {
            const found = findListById(route.listId);
            const name = document.getElementById('renameList').value.trim();
            if (!found || !name || name === found.list.소분류명) return;
            await run(() => saveList(found.list, found.category.대분류, found.list.표시순서, name), '제목을 바꿨어요.');
        }
    });

    backBtn.addEventListener('click', () => go(backBtn.dataset.hash || '#/'));
    window.addEventListener('hashchange', () => { editingItemId = null; render(); });

    async function refresh() {
        try {
            await loadData();
        } catch (err) {
            showToast(err.message || '데이터를 불러오지 못했습니다.', 'danger');
        } finally {
            loadingEl.hidden = true;
            render();
        }
    }

    refreshBtn.addEventListener('click', refresh);

    await refresh();
});
