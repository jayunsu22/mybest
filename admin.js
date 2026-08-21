document.addEventListener('DOMContentLoaded', async () => {
    const n8nBase = "https://primary-production-a6fa.up.railway.app";
    const API_GET_URL = `${n8nBase}/webhook/taste-get`;
    const API_LIST_SAVE_URL = `${n8nBase}/webhook/taste-list-save`;
    const API_ITEM_SAVE_URL = `${n8nBase}/webhook/taste-item-save`;
    const API_DELETE_URL = `${n8nBase}/webhook/taste-delete`;

    let categories = [];

    const toast = document.getElementById('toast');
    const categoryOptions = document.getElementById('categoryOptions');
    const listForm = document.getElementById('listForm');
    const listFormId = document.getElementById('listFormId');
    const listFormCategory = document.getElementById('listFormCategory');
    const listFormName = document.getElementById('listFormName');
    const listFormOrder = document.getElementById('listFormOrder');
    const listFormCancel = document.getElementById('listFormCancel');

    const itemForm = document.getElementById('itemForm');
    const itemFormId = document.getElementById('itemFormId');
    const itemFormListSelect = document.getElementById('itemFormListSelect');
    const itemFormTitle = document.getElementById('itemFormTitle');
    const itemFormRank = document.getElementById('itemFormRank');
    const itemFormComment = document.getElementById('itemFormComment');
    const itemFormMedia = document.getElementById('itemFormMedia');
    const itemFormCancel = document.getElementById('itemFormCancel');

    const listContainer = document.getElementById('listContainer');

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => { toast.className = 'toast'; }, 3000);
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

    async function loadData() {
        const response = await fetchWithTimeout(`${API_GET_URL}?_t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('데이터를 불러오지 못했습니다.');
        const result = await response.json();
        const data = Array.isArray(result) ? result[0] : result;
        categories = (data && data.categories) || [];
    }

    function findListById(listId) {
        for (const category of categories) {
            const found = category.소분류목록.find(l => l.id === listId);
            if (found) return found;
        }
        return null;
    }

    function findCategoryOfList(listId) {
        return categories.find(c => c.소분류목록.some(l => l.id === listId));
    }

    function renderCategoryOptions() {
        const names = [...new Set(categories.map(c => c.대분류))];
        categoryOptions.innerHTML = names.map(n => `<option value="${n}"></option>`).join('');
    }

    function renderListSelect() {
        const opts = ['<option value="">-- 소분류 선택 --</option>'];
        categories.forEach(category => {
            category.소분류목록.forEach(list => {
                opts.push(`<option value="${list.id}">${category.대분류} &gt; ${list.소분류명}</option>`);
            });
        });
        itemFormListSelect.innerHTML = opts.join('');
    }

    function renderLists() {
        if (categories.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">등록된 소분류가 없습니다. 위 폼에서 추가해 보세요.</p>';
            return;
        }
        listContainer.innerHTML = categories.map(category => `
            <section class="admin-category">
                <h2>${category.대분류}</h2>
                ${category.소분류목록.map(list => `
                    <div class="admin-list-card" data-list-id="${list.id}">
                        <div class="admin-list-header">
                            <strong>${list.소분류명}</strong> (표시순서 ${list.표시순서})
                            <button type="button" class="btn-edit-list" data-id="${list.id}">수정</button>
                            <button type="button" class="btn-delete-list" data-id="${list.id}">삭제</button>
                        </div>
                        <ul class="admin-item-list">
                            ${list.항목.length ? list.항목.map(item => `
                                <li>
                                    ${item.순위}위 · ${item.제목}
                                    <button type="button" class="btn-edit-item" data-id="${item.id}" data-list-id="${list.id}">수정</button>
                                    <button type="button" class="btn-delete-item" data-id="${item.id}">삭제</button>
                                </li>
                            `).join('') : '<li class="empty-state">항목 없음</li>'}
                        </ul>
                    </div>
                `).join('')}
            </section>
        `).join('');
    }

    function renderAll() {
        renderCategoryOptions();
        renderListSelect();
        renderLists();
    }

    function resetListForm() {
        listFormId.value = '';
        listForm.reset();
        listFormCancel.style.display = 'none';
    }

    function resetItemForm() {
        itemFormId.value = '';
        itemForm.reset();
        itemFormCancel.style.display = 'none';
    }

    async function refresh() {
        try {
            await loadData();
            renderAll();
        } catch (err) {
            showToast(err.message || '데이터를 불러오지 못했습니다.', 'danger');
        }
    }

    listForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = { 소분류명: listFormName.value, 대분류: listFormCategory.value, 표시순서: listFormOrder.value };
        const { valid, errors } = window.AdminUtils.validateListForm(form);
        if (!valid) { showToast(errors.join(' '), 'danger'); return; }
        const payload = window.AdminUtils.buildListPayload(form, listFormId.value || null);
        try {
            const response = await fetchWithTimeout(API_LIST_SAVE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('저장 실패');
            showToast('소분류가 저장되었습니다.');
            resetListForm();
            await refresh();
        } catch (err) {
            showToast(err.message || '저장 중 오류가 발생했습니다.', 'danger');
        }
    });

    listFormCancel.addEventListener('click', resetListForm);

    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = {
            제목: itemFormTitle.value,
            순위: itemFormRank.value,
            코멘트: itemFormComment.value,
            '이미지/링크': itemFormMedia.value,
            소속목록: itemFormListSelect.value
        };
        const { valid, errors } = window.AdminUtils.validateItemForm(form);
        if (!valid) { showToast(errors.join(' '), 'danger'); return; }
        const payload = window.AdminUtils.buildItemPayload(form, itemFormId.value || null);
        try {
            const response = await fetchWithTimeout(API_ITEM_SAVE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('저장 실패');
            showToast('항목이 저장되었습니다.');
            resetItemForm();
            await refresh();
        } catch (err) {
            showToast(err.message || '저장 중 오류가 발생했습니다.', 'danger');
        }
    });

    itemFormCancel.addEventListener('click', resetItemForm);

    listContainer.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.classList.contains('btn-edit-list')) {
            const list = findListById(target.dataset.id);
            if (!list) return;
            const category = findCategoryOfList(list.id);
            listFormId.value = list.id;
            listFormCategory.value = category ? category.대분류 : '';
            listFormName.value = list.소분류명;
            listFormOrder.value = list.표시순서;
            listFormCancel.style.display = 'inline-block';
            listForm.scrollIntoView({ behavior: 'smooth' });
        }

        if (target.classList.contains('btn-delete-list')) {
            const list = findListById(target.dataset.id);
            if (!list) return;
            const ok = confirm(`"${list.소분류명}"을(를) 삭제하면 하위 항목 ${list.항목.length}개도 함께 삭제됩니다. 계속할까요?`);
            if (!ok) return;
            try {
                const plan = window.AdminUtils.buildDeletePlan(list);
                for (const step of plan) {
                    const response = await fetchWithTimeout(API_DELETE_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(step)
                    });
                    if (!response.ok) throw new Error('삭제 실패');
                }
                showToast('삭제되었습니다.');
                await refresh();
            } catch (err) {
                showToast(err.message || '삭제 중 오류가 발생했습니다.', 'danger');
            }
        }

        if (target.classList.contains('btn-edit-item')) {
            const list = findListById(target.dataset.listId);
            const item = list && list.항목.find(i => i.id === target.dataset.id);
            if (!item) return;
            itemFormId.value = item.id;
            itemFormListSelect.value = list.id;
            itemFormTitle.value = item.제목;
            itemFormRank.value = item.순위;
            itemFormComment.value = item.코멘트;
            itemFormMedia.value = item['이미지/링크'];
            itemFormCancel.style.display = 'inline-block';
            itemForm.scrollIntoView({ behavior: 'smooth' });
        }

        if (target.classList.contains('btn-delete-item')) {
            const ok = confirm('이 항목을 삭제할까요?');
            if (!ok) return;
            try {
                const response = await fetchWithTimeout(API_DELETE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'item', id: target.dataset.id })
                });
                if (!response.ok) throw new Error('삭제 실패');
                showToast('삭제되었습니다.');
                await refresh();
            } catch (err) {
                showToast(err.message || '삭제 중 오류가 발생했습니다.', 'danger');
            }
        }
    });

    await refresh();
});
