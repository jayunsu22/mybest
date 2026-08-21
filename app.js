document.addEventListener('DOMContentLoaded', async () => {
    const n8nBase = "https://primary-production-a6fa.up.railway.app";
    const API_GET_URL = `${n8nBase}/webhook/taste-get`;

    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('errorMessage');
    const emptyEl = document.getElementById('emptyState');
    const categoriesEl = document.getElementById('categories');

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
            <li class="item-card${rankCls ? ' item-card--top' : ''}">
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
                <h3 class="list-title">${escapeHtml(list.소분류명)}</h3>
                <ol class="item-list">${items}</ol>
            </div>`;
    }

    function renderCategory(category) {
        const lists = category.소분류목록.map(renderList).join('');
        return `
            <section class="category-section">
                <h2 class="category-title">${escapeHtml(category.대분류)}</h2>
                <div class="list-grid">${lists}</div>
            </section>`;
    }

    function render(categories) {
        if (!categories || categories.length === 0) {
            emptyEl.style.display = 'block';
            categoriesEl.innerHTML = '';
            return;
        }
        emptyEl.style.display = 'none';
        categoriesEl.innerHTML = categories.map(renderCategory).join('');
    }

    // 제목을 탭하면 코멘트/이미지·링크가 펼쳐지는 아코디언 (이벤트 위임으로 한 번만 등록)
    categoriesEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.item-title--expandable');
        if (!btn) return;
        const detail = btn.nextElementSibling;
        if (!detail) return;
        const isHidden = detail.hasAttribute('hidden');
        if (isHidden) {
            detail.removeAttribute('hidden');
            btn.classList.add('item-title--open');
            btn.setAttribute('aria-expanded', 'true');
        } else {
            detail.setAttribute('hidden', '');
            btn.classList.remove('item-title--open');
            btn.setAttribute('aria-expanded', 'false');
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
            render(data && data.categories ? data.categories : []);
        } catch (error) {
            console.error(error);
            errorEl.textContent = error.message || '데이터를 불러오는 도중 오류가 발생했습니다.';
            errorEl.style.display = 'block';
        } finally {
            loadingEl.style.display = 'none';
        }
    }

    await load();
});
