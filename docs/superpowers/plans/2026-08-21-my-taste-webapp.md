# 나의 취향 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대분류-소분류-항목(BEST5) 구조로 개인 취향을 기록하는 정적 웹앱을 만들고, Airtable(저장)+N8N(레일웨이, API)+GitHub Pages(호스팅)로 배포한다.

**Architecture:** GitHub Pages가 서빙하는 프레임워크 없는 HTML/CSS/JS 프론트엔드가 기존 레일웨이 N8N 인스턴스의 웹훅(taste-get/taste-list-save/taste-item-save/taste-delete)을 호출하고, N8N이 Airtable(신규 베이스 "나의취향")을 읽고 쓴다. 프론트엔드는 Airtable을 직접 호출하지 않는다.

**Tech Stack:** 순수 HTML/CSS/JS(프레임워크 없음), N8N(Railway, 기존 인스턴스 재사용), Airtable, GitHub + GitHub Pages, Node.js 내장 테스트 러너(`node --test`)로 순수 로직 유닛테스트.

## Global Constraints

- 공개 범위: 로그인 없이 URL만으로 접근하는 개인용. `<meta name="robots" content="noindex, nofollow">`로 검색엔진 노출 차단.
- 관리자(admin.html) 화면은 비밀번호 보호 없음 — URL만으로 구분되는 가벼운 개인용 (설계 문서 §1 결정).
- 이미지/미디어는 파일 업로드 없이 외부 URL만 입력받는다 (설계 문서 §1 결정).
- N8N은 기존 레일웨이 인스턴스 `https://primary-production-a6fa.up.railway.app`를 재사용한다. 새 인스턴스를 만들지 않는다.
- N8N 웹훅 경로는 모두 `taste-` 접두어를 쓴다: `taste-get`, `taste-list-save`, `taste-item-save`, `taste-delete`.
- Airtable 접근은 항상 N8N 웹훅을 경유한다. 프론트엔드는 Airtable API를 직접 호출하지 않는다.
- N8N의 기존 Airtable 자격증명(`credential id: J5wefJCMalpjjm3Q`, name: "Airtable Personal Access Token account 2")을 재사용한다. 이 PAT의 Airtable 측 접근 범위(scope)에 새 베이스를 반드시 추가해야 한다.
- 프론트엔드 파일은 `?v=YYYYMMDD` 쿼리스트링으로 캐시버스팅한다. JS/CSS를 고치고 push할 때마다 그 날짜로 갱신한다.
- GitHub push, GitHub Pages 활성화 등 공개 저장소에 반영/공개하는 작업은 반드시 사용자 확인 후 진행한다 (설계 문서 §7).
- Airtable 필드명은 그대로 N8N Code 노드와 프론트 JS의 객체 키로 쓰인다: `소분류명`, `대분류`, `표시순서`, `제목`, `순위`, `코멘트`, `이미지/링크`, `소속목록`. 이름을 바꾸지 않는다.

---

### Task 1: Airtable 베이스 "나의취향" 생성

**Files:**
- Create: `docs/superpowers/plans/airtable-ids.json`

**Interfaces:**
- Produces: `docs/superpowers/plans/airtable-ids.json`에 `{ "baseId": "appXXXXXXXXXXXXXXX", "listTableId": "tblXXXXXXXXXXXXXXX", "itemTableId": "tblXXXXXXXXXXXXXXX", "workspaceId": "wspM4cjxuM52BmpYX" }` 형태로 실제 ID 3종을 기록한다. Task 2가 이 파일을 읽어서 사용한다.

- [x] **Step 1: 베이스와 `취향목록` 테이블 생성**

Airtable MCP 도구 `mcp__afe48573-6e9a-4239-8478-29244eb6d906__create_base`를 아래 파라미터로 호출한다.

```json
{
  "workspaceId": "wspM4cjxuM52BmpYX",
  "name": "나의취향",
  "tables": [
    {
      "name": "취향목록",
      "fields": [
        { "name": "소분류명", "type": "singleLineText" },
        {
          "name": "대분류",
          "type": "singleSelect",
          "options": {
            "choices": [
              { "name": "음악" },
              { "name": "드라마/영화" },
              { "name": "음식" },
              { "name": "장소" }
            ]
          }
        },
        { "name": "표시순서", "type": "number", "options": { "precision": 0 } }
      ]
    }
  ]
}
```

응답에서 `id`(베이스 ID, `app`로 시작)와 `tables[0].id`(`취향목록` 테이블 ID, `tbl`로 시작)를 기록해 둔다.

- [x] **Step 2: `취향항목` 테이블 생성 (취향목록에 링크)**

`mcp__afe48573-6e9a-4239-8478-29244eb6d906__create_table`를 호출한다. `<BASE_ID>`와 `<LIST_TABLE_ID>`는 Step 1에서 얻은 값으로 채운다.

```json
{
  "baseId": "<BASE_ID>",
  "name": "취향항목",
  "fields": [
    { "name": "제목", "type": "singleLineText" },
    { "name": "순위", "type": "number", "options": { "precision": 0 } },
    { "name": "코멘트", "type": "multilineText" },
    { "name": "이미지/링크", "type": "url" },
    {
      "name": "소속목록",
      "type": "multipleRecordLinks",
      "options": { "linkedTableId": "<LIST_TABLE_ID>" }
    }
  ]
}
```

응답에서 `id`(취향항목 테이블 ID)를 기록해 둔다.

- [x] **Step 3: 스키마 검증**

`mcp__afe48573-6e9a-4239-8478-29244eb6d906__list_tables_for_base`를 `{ "baseId": "<BASE_ID>" }`로 호출한다.

Expected: 응답 `tables` 배열에 `취향목록`(필드: 소분류명, 대분류, 표시순서, 그리고 취향항목을 가리키는 자동 역방향 링크 필드)과 `취향항목`(필드: 제목, 순위, 코멘트, 이미지/링크, 소속목록)이 모두 존재해야 한다. 하나라도 빠졌으면 Step 1/2로 돌아가 원인을 확인한다.

이 응답에는 각 필드의 `id`(`fld`로 시작)도 들어있다. Step 4에서 레코드를 만들 때는 필드 **이름이 아니라 이 필드 ID**를 키로 써야 하므로, `취향목록`의 소분류명/대분류/표시순서와 `취향항목`의 제목/순위/코멘트/소속목록 필드 ID 7개를 여기서 받아 적어 둔다 (`create_records_for_table` 도구는 `fields`의 키로 필드 ID를 요구함 — 필드 이름을 쓰면 실패한다).

- [x] **Step 4: 예시 데이터 1건 시딩 (동작 확인 겸 시작 데이터)**

`mcp__afe48573-6e9a-4239-8478-29244eb6d906__create_records_for_table`로 `취향목록`에 예시 소분류를 만든다. `<LIST_소분류명_FLD>`/`<LIST_대분류_FLD>`/`<LIST_표시순서_FLD>`는 Step 3에서 받아 적은 필드 ID로 채운다.

```json
{
  "baseId": "<BASE_ID>",
  "tableId": "<LIST_TABLE_ID>",
  "records": [
    {
      "fields": {
        "<LIST_소분류명_FLD>": "여름노래 BEST5",
        "<LIST_대분류_FLD>": "음악",
        "<LIST_표시순서_FLD>": 1
      }
    }
  ],
  "fieldIds": ["<LIST_소분류명_FLD>", "<LIST_대분류_FLD>", "<LIST_표시순서_FLD>"]
}
```

`fieldIds`를 함께 넘기면 응답에 방금 쓴 필드 값도 필드 이름과 함께 되돌아오므로, 응답에서 생성된 레코드의 `id`(`<LIST_RECORD_ID>`)를 확인한다. 같은 도구로 `취향항목`에 예시 항목 1건을 만든다. `<ITEM_제목_FLD>`/`<ITEM_순위_FLD>`/`<ITEM_코멘트_FLD>`/`<ITEM_소속목록_FLD>`도 Step 3에서 받아 적은 필드 ID다.

```json
{
  "baseId": "<BASE_ID>",
  "tableId": "<ITEM_TABLE_ID>",
  "records": [
    {
      "fields": {
        "<ITEM_제목_FLD>": "예시 항목 — 자유롭게 수정/삭제하세요",
        "<ITEM_순위_FLD>": 1,
        "<ITEM_코멘트_FLD>": "admin.html에서 실제 항목으로 바꿔보세요.",
        "<ITEM_소속목록_FLD>": ["<LIST_RECORD_ID>"]
      }
    }
  ],
  "fieldIds": ["<ITEM_제목_FLD>", "<ITEM_순위_FLD>", "<ITEM_코멘트_FLD>", "<ITEM_소속목록_FLD>"]
}
```

Expected: 두 호출 모두 생성된 레코드의 `id`를 포함한 성공 응답을 반환한다.

- [x] **Step 5: ID를 파일로 기록**

`docs/superpowers/plans/airtable-ids.json`을 아래 내용으로 작성한다 (Step 1/2에서 얻은 실제 값으로 채움).

```json
{
  "baseId": "<BASE_ID>",
  "listTableId": "<LIST_TABLE_ID>",
  "itemTableId": "<ITEM_TABLE_ID>",
  "workspaceId": "wspM4cjxuM52BmpYX"
}
```

- [x] **Step 6: 커밋**

```bash
git add docs/superpowers/plans/airtable-ids.json
git commit -m "chore: 나의취향 Airtable 베이스 ID 기록"
```

---

### Task 2: N8N 워크플로우 완성 및 임포트

**Files:**
- Read: `n8n_workflow.template.json` (프로젝트 루트, 계획 단계에서 이미 작성됨)
- Read: `docs/superpowers/plans/airtable-ids.json` (Task 1 산출물)
- Create: `n8n_workflow.json`

**Interfaces:**
- Consumes: Task 1이 만든 `docs/superpowers/plans/airtable-ids.json`의 `baseId`/`listTableId`/`itemTableId`
- Produces: N8N에 임포트해서 활성화하는 워크플로우 "나의 취향 웹앱 백엔드". 웹훅 4개가 이후 모든 프론트엔드 Task(3~5)가 호출하는 API 계약이 된다:
  - `GET {n8nBase}/webhook/taste-get` → `{ categories: [{ 대분류, 소분류목록: [{ id, 소분류명, 표시순서, 항목: [{ id, 제목, 순위, 코멘트, "이미지/링크" }] }] }] }`
  - `POST {n8nBase}/webhook/taste-list-save` body `{ id?, 소분류명, 대분류, 표시순서 }`
  - `POST {n8nBase}/webhook/taste-item-save` body `{ id?, 제목, 순위, 코멘트, "이미지/링크", 소속목록 }` (소속목록은 취향목록 레코드 id 문자열 1개)
  - `POST {n8nBase}/webhook/taste-delete` body `{ type: "list"|"item", id }`

- [x] **Step 1: 토큰을 실제 ID로 치환해 `n8n_workflow.json` 생성**

```bash
node -e "
const fs = require('fs');
const ids = JSON.parse(fs.readFileSync('docs/superpowers/plans/airtable-ids.json', 'utf8'));
let content = fs.readFileSync('n8n_workflow.template.json', 'utf8');
content = content.split('<AIRTABLE_BASE_ID>').join(ids.baseId);
content = content.split('<AIRTABLE_LIST_TABLE_ID>').join(ids.listTableId);
content = content.split('<AIRTABLE_ITEM_TABLE_ID>').join(ids.itemTableId);
fs.writeFileSync('n8n_workflow.json', content);
console.log('n8n_workflow.json written');
"
```

Expected output: `n8n_workflow.json written`

- [x] **Step 2: JSON 유효성 + 토큰 잔존 여부 확인**

```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('n8n_workflow.json', 'utf8');
JSON.parse(content); // throws if invalid
if (content.includes('<AIRTABLE_')) { throw new Error('치환 안 된 토큰이 남아있음'); }
console.log('OK: valid JSON, no leftover tokens');
"
```

Expected output: `OK: valid JSON, no leftover tokens`

- [x] **Step 3: 커밋**

```bash
git add n8n_workflow.template.json n8n_workflow.json
git commit -m "feat: 나의 취향 N8N 워크플로우 작성"
```

- [x] **Step 4: Airtable PAT 스코프에 새 베이스 추가 (사용자 수동 작업)**

사용자에게 안내: https://airtable.com/create/tokens 접속 → N8N이 쓰는 토큰(이름이 보통 "Airtable Personal Access Token account 2" 또는 그와 유사)을 열기 → "Access" 섹션에서 새로 만든 "나의취향" 베이스를 추가 → 저장. 이 단계를 건너뛰면 N8N의 Airtable 노드가 새 베이스에 접근하지 못해 모든 웹훅이 실패한다.

- [x] **Step 5: N8N에 워크플로우 임포트 (사용자 수동 작업)**

사용자에게 안내: 레일웨이의 N8N 에디터(`https://primary-production-a6fa.up.railway.app`) 접속 → 새 워크플로우 생성 → 우측 상단 메뉴 "Import from File" → 이 프로젝트의 `n8n_workflow.json` 선택 → 각 Airtable 노드가 자격증명 "Airtable Personal Access Token account 2"를 자동으로 물고 있는지 확인 (id가 일치하므로 보통 자동 연결됨. 안 되어 있으면 노드마다 수동으로 같은 자격증명 선택) → 워크플로우 우측 상단 토글로 **Activate**.

- [x] **Step 6: 웹훅 4개 curl로 검증**

아래 `N8N_BASE`는 그대로 사용한다. Step 5에서 워크플로우를 활성화한 뒤 실행한다.

```bash
N8N_BASE="https://primary-production-a6fa.up.railway.app"

# 1) GET taste-get — Task 1에서 시딩한 예시 데이터가 보여야 함
curl -s "$N8N_BASE/webhook/taste-get"
```

Expected: `[{"categories":[{"대분류":"음악","소분류목록":[{"id":"rec...","소분류명":"여름노래 BEST5","표시순서":1,"항목":[{"id":"rec...","제목":"예시 항목 — 자유롭게 수정/삭제하세요","순위":1,"코멘트":"admin.html에서 실제 항목으로 바꿔보세요.","이미지/링크":""}]}]}]}]`

```bash
# 2) POST taste-list-save — 신규 소분류 생성
curl -s -X POST "$N8N_BASE/webhook/taste-list-save" \
  -H "Content-Type: application/json" \
  -d '{"소분류명":"검증용 소분류","대분류":"음악","표시순서":99}'
```

Expected: 생성된 레코드의 `id`(rec로 시작)를 포함한 JSON 응답. 이 id를 `<TEST_LIST_ID>`로 기억해 둔다.

```bash
# 3) POST taste-item-save — 위에서 만든 소분류에 항목 추가
curl -s -X POST "$N8N_BASE/webhook/taste-item-save" \
  -H "Content-Type: application/json" \
  -d '{"제목":"검증용 항목","순위":1,"코멘트":"삭제 예정","이미지/링크":"https://example.com/a.jpg","소속목록":"<TEST_LIST_ID>"}'
```

Expected: 생성된 레코드의 `id`를 포함한 JSON 응답. 이 id를 `<TEST_ITEM_ID>`로 기억해 둔다.

```bash
# 4) POST taste-delete — 검증용으로 만든 항목/소분류 정리
curl -s -X POST "$N8N_BASE/webhook/taste-delete" -H "Content-Type: application/json" -d '{"type":"item","id":"<TEST_ITEM_ID>"}'
curl -s -X POST "$N8N_BASE/webhook/taste-delete" -H "Content-Type: application/json" -d '{"type":"list","id":"<TEST_LIST_ID>"}'
```

Expected: 두 호출 모두 삭제된 레코드 `id`를 포함한 성공 응답. 이후 `curl -s "$N8N_BASE/webhook/taste-get"`을 다시 호출해 검증용 데이터가 사라지고 Task 1의 예시 데이터만 남아있는지 확인한다.

---

### Task 3: 공유 유틸 모듈 (`taste-utils.js`, `admin-utils.js`)

**Files:**
- Create: `taste-utils.js`
- Create: `admin-utils.js`
- Test: `tests/taste-utils.test.js`
- Test: `tests/admin-utils.test.js`

**Interfaces:**
- Produces: `window.TasteUtils = { extractYoutubeId(url), detectMediaType(url), getYoutubeThumbnail(url) }` — Task 4(`app.js`)가 사용.
- Produces: `window.AdminUtils = { validateListForm(form), buildListPayload(form, existingId), validateItemForm(form), buildItemPayload(form, existingId), buildDeletePlan(list) }` — Task 5(`admin.js`)가 사용. `list`는 Task 2 GET 응답의 소분류 객체 `{ id, 소분류명, 표시순서, 항목: [{id, ...}] }` 형태.

- [x] **Step 1: `taste-utils.js` 실패하는 테스트 작성**

`tests/taste-utils.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectMediaType, extractYoutubeId, getYoutubeThumbnail } = require('../taste-utils.js');

test('detectMediaType returns none for empty url', () => {
  assert.equal(detectMediaType(''), 'none');
  assert.equal(detectMediaType(undefined), 'none');
});

test('detectMediaType detects youtube watch url', () => {
  assert.equal(detectMediaType('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
});

test('detectMediaType detects youtu.be short url', () => {
  assert.equal(detectMediaType('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
});

test('detectMediaType detects image url regardless of case or query string', () => {
  assert.equal(detectMediaType('https://example.com/photo.jpg'), 'image');
  assert.equal(detectMediaType('https://example.com/photo.PNG?x=1'), 'image');
});

test('detectMediaType falls back to link for other urls', () => {
  assert.equal(detectMediaType('https://example.com/some-page'), 'link');
});

test('extractYoutubeId pulls the 11-char video id from watch and short urls', () => {
  assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://example.com/not-youtube'), null);
});

test('getYoutubeThumbnail builds the thumbnail url, null for non-youtube', () => {
  assert.equal(
    getYoutubeThumbnail('https://youtu.be/dQw4w9WgXcQ'),
    'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
  );
  assert.equal(getYoutubeThumbnail('https://example.com'), null);
});
```

- [x] **Step 2: 테스트가 실패하는지 확인 (모듈이 아직 없음)**

Run: `node --test tests/taste-utils.test.js`
Expected: FAIL — `Cannot find module '../taste-utils.js'`

- [x] **Step 3: `taste-utils.js` 구현**

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TasteUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function extractYoutubeId(url) {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
      /(?:youtu\.be\/)([\w-]{11})/,
      /(?:youtube\.com\/embed\/)([\w-]{11})/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  function detectMediaType(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') return 'none';
    if (extractYoutubeId(url)) return 'youtube';
    if (/\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(url)) return 'image';
    return 'link';
  }

  function getYoutubeThumbnail(url) {
    const id = extractYoutubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
  }

  return { extractYoutubeId, detectMediaType, getYoutubeThumbnail };
});
```

- [x] **Step 4: 테스트 통과 확인**

Run: `node --test tests/taste-utils.test.js`
Expected: PASS — `# pass 6`, `# fail 0`

- [x] **Step 5: `admin-utils.js` 실패하는 테스트 작성**

`tests/admin-utils.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateListForm,
  buildListPayload,
  validateItemForm,
  buildItemPayload,
  buildDeletePlan
} = require('../admin-utils.js');

test('validateListForm rejects missing 소분류명/대분류', () => {
  const result = validateListForm({ 소분류명: '', 대분류: '' });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});

test('validateListForm accepts a filled form', () => {
  const result = validateListForm({ 소분류명: '여름노래 BEST5', 대분류: '음악' });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('buildListPayload trims values and omits id when not editing', () => {
  const payload = buildListPayload({ 소분류명: ' 여름노래 BEST5 ', 대분류: ' 음악 ', 표시순서: '2' }, null);
  assert.deepEqual(payload, { 소분류명: '여름노래 BEST5', 대분류: '음악', 표시순서: 2 });
});

test('buildListPayload includes id when editing an existing record', () => {
  const payload = buildListPayload({ 소분류명: 'a', 대분류: 'b', 표시순서: '' }, 'recABC');
  assert.equal(payload.id, 'recABC');
  assert.equal(payload.표시순서, 0);
});

test('validateItemForm requires 제목, 소속목록, numeric 순위', () => {
  const result = validateItemForm({ 제목: '', 순위: 'abc', 소속목록: '' });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
});

test('validateItemForm accepts a filled form', () => {
  const result = validateItemForm({ 제목: '노래', 순위: '1', 소속목록: 'recLIST' });
  assert.equal(result.valid, true);
});

test('buildItemPayload maps the 이미지/링크 key and trims text fields', () => {
  const payload = buildItemPayload(
    { 제목: ' 노래 ', 순위: '3', 코멘트: ' 좋다 ', '이미지/링크': ' https://a.com/x.jpg ', 소속목록: 'recLIST' },
    null
  );
  assert.deepEqual(payload, {
    제목: '노래',
    순위: 3,
    코멘트: '좋다',
    소속목록: 'recLIST',
    '이미지/링크': 'https://a.com/x.jpg'
  });
});

test('buildDeletePlan deletes every item before the list itself', () => {
  const list = { id: 'recLIST', 항목: [{ id: 'recA' }, { id: 'recB' }] };
  const plan = buildDeletePlan(list);
  assert.deepEqual(plan, [
    { type: 'item', id: 'recA' },
    { type: 'item', id: 'recB' },
    { type: 'list', id: 'recLIST' }
  ]);
});

test('buildDeletePlan handles a list with no items', () => {
  const plan = buildDeletePlan({ id: 'recLIST', 항목: [] });
  assert.deepEqual(plan, [{ type: 'list', id: 'recLIST' }]);
});
```

- [x] **Step 6: 테스트가 실패하는지 확인**

Run: `node --test tests/admin-utils.test.js`
Expected: FAIL — `Cannot find module '../admin-utils.js'`

- [x] **Step 7: `admin-utils.js` 구현**

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AdminUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function validateListForm(form) {
    const errors = [];
    if (!form.소분류명 || !form.소분류명.trim()) errors.push('소분류명을 입력해 주세요.');
    if (!form.대분류 || !form.대분류.trim()) errors.push('대분류를 선택하거나 입력해 주세요.');
    return { valid: errors.length === 0, errors };
  }

  function buildListPayload(form, existingId) {
    const payload = {
      소분류명: (form.소분류명 || '').trim(),
      대분류: (form.대분류 || '').trim(),
      표시순서: form.표시순서 !== undefined && form.표시순서 !== '' ? Number(form.표시순서) : 0
    };
    if (existingId) payload.id = existingId;
    return payload;
  }

  function validateItemForm(form) {
    const errors = [];
    if (!form.제목 || !form.제목.trim()) errors.push('제목을 입력해 주세요.');
    if (!form.소속목록) errors.push('어느 소분류에 속하는지 선택해 주세요.');
    if (form.순위 === undefined || form.순위 === '' || Number.isNaN(Number(form.순위))) {
      errors.push('순위를 숫자로 입력해 주세요.');
    }
    return { valid: errors.length === 0, errors };
  }

  function buildItemPayload(form, existingId) {
    const payload = {
      제목: (form.제목 || '').trim(),
      순위: form.순위 !== undefined && form.순위 !== '' ? Number(form.순위) : 0,
      코멘트: (form.코멘트 || '').trim(),
      소속목록: form.소속목록 || ''
    };
    payload['이미지/링크'] = (form['이미지/링크'] || '').trim();
    if (existingId) payload.id = existingId;
    return payload;
  }

  function buildDeletePlan(list) {
    const plan = (list.항목 || []).map(item => ({ type: 'item', id: item.id }));
    plan.push({ type: 'list', id: list.id });
    return plan;
  }

  return { validateListForm, buildListPayload, validateItemForm, buildItemPayload, buildDeletePlan };
});
```

- [x] **Step 8: 전체 테스트 통과 확인**

Run: `node --test tests/`
Expected: PASS — `# pass 15`, `# fail 0` (taste-utils 6개 + admin-utils 9개)

- [x] **Step 9: 커밋**

```bash
git add taste-utils.js admin-utils.js tests/taste-utils.test.js tests/admin-utils.test.js
git commit -m "feat: 나의 취향 공유 유틸 모듈 (TasteUtils, AdminUtils)"
```

---

### Task 4: 공개 조회 페이지 (`index.html`, `app.js`, `style.css`)

**Files:**
- Create: `index.html`
- Create: `app.js`
- Create: `style.css`
- Create: `serve-static.js` (검증용 로컬 정적 서버, 배포 대상 아님 — git에 커밋하지 않음)

**Interfaces:**
- Consumes: `window.TasteUtils`(Task 3), `GET {n8nBase}/webhook/taste-get`(Task 2)의 `{ categories: [...] }` 응답

- [x] **Step 1: `style.css` 작성**

```css
:root {
    --bg: #faf7f2;
    --card-bg: #ffffff;
    --text: #2b2622;
    --text-muted: #7a7169;
    --accent: #c9884f;
    --border: #e8e1d8;
    --danger: #c0392b;
    --radius: 12px;
}

* { box-sizing: border-box; }

body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
}

.page-header { text-align: center; padding: 40px 20px 20px; }
.page-header h1 { margin: 0 0 8px; font-size: 2rem; }
.page-subtitle { margin: 0; color: var(--text-muted); }

main { max-width: 960px; margin: 0 auto; padding: 0 16px 60px; }

.loading, .empty-state, .error-message { text-align: center; padding: 40px 16px; color: var(--text-muted); }
.error-message { color: var(--danger); }

.category-section { margin-bottom: 40px; }
.category-title { border-bottom: 2px solid var(--accent); padding-bottom: 8px; margin-bottom: 16px; }

.list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

.list-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.list-title { margin: 0 0 12px; font-size: 1.1rem; }

.item-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.item-card { display: flex; gap: 10px; align-items: flex-start; }

.item-rank {
    flex: 0 0 auto; width: 28px; height: 28px; border-radius: 50%;
    background: var(--accent); color: #fff; display: flex; align-items: center;
    justify-content: center; font-size: 0.85rem; font-weight: 700;
}

.item-body { flex: 1; min-width: 0; }
.item-title { font-weight: 600; }
.item-comment { color: var(--text-muted); font-size: 0.9rem; margin-top: 2px; }
.item-media { display: inline-block; margin-top: 8px; }
.item-media img { max-width: 100%; border-radius: 8px; display: block; }
.item-media-link { color: var(--accent); text-decoration: none; font-size: 0.9rem; }
.item-empty { color: var(--text-muted); font-size: 0.9rem; }

@media (max-width: 480px) {
    .page-header h1 { font-size: 1.5rem; }
}
```

- [x] **Step 2: `app.js` 작성**

```javascript
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
        return `
            <li class="item-card">
                <span class="item-rank">${escapeHtml(item.순위)}</span>
                <div class="item-body">
                    <div class="item-title">${escapeHtml(item.제목)}</div>
                    ${item.코멘트 ? `<div class="item-comment">${escapeHtml(item.코멘트)}</div>` : ''}
                    ${renderItemMedia(item)}
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
```

- [x] **Step 3: `index.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>나의 취향</title>
<link rel="stylesheet" href="style.css?v=20260821">
</head>
<body>
<header class="page-header">
    <h1>나의 취향</h1>
    <p class="page-subtitle">내가 좋아하는 것들을 기록하는 공간</p>
</header>
<main>
    <div id="loading" class="loading">불러오는 중...</div>
    <div id="errorMessage" class="error-message" style="display:none;"></div>
    <div id="emptyState" class="empty-state" style="display:none;">아직 등록된 취향이 없어요.</div>
    <div id="categories" class="categories"></div>
</main>
<script src="taste-utils.js?v=20260821"></script>
<script src="app.js?v=20260821"></script>
</body>
</html>
```

- [x] **Step 4: 로컬 정적 서버로 브라우저 확인**

정적 서버 스크립트를 파일로 만들고(재사용을 위해 Task 5에서도 그대로 씀):

```javascript
// serve-static.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
http.createServer((req, res) => {
  let filePath = '.' + decodeURIComponent(req.url.split('?')[0]);
  if (filePath === './') filePath = './index.html';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8080, () => console.log('serving on 8080'));
```

Bash 도구의 `run_in_background: true` 옵션으로 `node serve-static.js`를 백그라운드 실행한다 (셸 `&`에 의존하지 않음).

브라우저 도구로 `http://localhost:8080/index.html`을 열고 확인한다:

Expected: Task 1에서 시딩한 "음악 > 여름노래 BEST5 > 예시 항목" 카드가 렌더링됨. 브라우저 콘솔에 에러 없음(`mcp__Claude_Browser__read_console_messages`로 확인).

확인 후 백그라운드로 실행한 `node serve-static.js` 프로세스를 종료한다.

- [x] **Step 5: 커밋**

```bash
git add index.html app.js style.css
git commit -m "feat: 나의 취향 공개 조회 페이지"
```

---

### Task 5: 관리자 페이지 (`admin.html`, `admin.js`, `admin_style.css`)

**Files:**
- Create: `admin.html`
- Create: `admin.js`
- Create: `admin_style.css`

**Interfaces:**
- Consumes: `window.AdminUtils`(Task 3), Task 2의 4개 웹훅 전부

- [x] **Step 1: `admin_style.css` 작성**

```css
:root {
    --bg: #f5f5f2;
    --card-bg: #ffffff;
    --text: #2b2622;
    --text-muted: #7a7169;
    --accent: #4a6fa5;
    --border: #dcd7cf;
    --danger: #c0392b;
    --radius: 10px;
}

* { box-sizing: border-box; }

body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
}

.page-header { padding: 24px 16px; text-align: center; }
main { max-width: 720px; margin: 0 auto; padding: 0 16px 60px; }

.form-section { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 24px; }
.form-section h2 { margin-top: 0; }

form label { display: block; margin-bottom: 12px; font-size: 0.9rem; color: var(--text-muted); }
form input, form textarea, form select {
    display: block; width: 100%; margin-top: 4px; padding: 8px 10px;
    border: 1px solid var(--border); border-radius: 6px; font-size: 1rem;
    font-family: inherit; color: var(--text);
}
form textarea { min-height: 60px; resize: vertical; }

.form-actions { display: flex; gap: 8px; }
.form-actions button { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.95rem; }
.form-actions button[type="submit"] { background: var(--accent); color: #fff; }
.form-actions button[type="button"] { background: var(--border); color: var(--text); }

.admin-category { margin-bottom: 20px; }
.admin-list-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 12px; }
.admin-list-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.admin-list-header button { padding: 4px 10px; font-size: 0.8rem; border: 1px solid var(--border); border-radius: 6px; background: #fff; cursor: pointer; }

.admin-item-list { list-style: none; margin: 10px 0 0; padding: 0; }
.admin-item-list li { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--border); font-size: 0.9rem; }
.admin-item-list button { padding: 2px 8px; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: #fff; cursor: pointer; }

.toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: var(--text); color: #fff; padding: 10px 20px; border-radius: 8px;
    opacity: 0; pointer-events: none; transition: all 0.2s ease;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast.show.danger { background: var(--danger); }

.empty-state { color: var(--text-muted); font-size: 0.9rem; }
```

- [x] **Step 2: `admin.js` 작성**

```javascript
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
```

- [x] **Step 3: `admin.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>나의 취향 - 관리자</title>
<link rel="stylesheet" href="admin_style.css?v=20260821">
</head>
<body>
<header class="page-header">
    <h1>나의 취향 관리자</h1>
</header>
<main>
    <section class="form-section">
        <h2>소분류 추가/수정</h2>
        <form id="listForm">
            <input type="hidden" id="listFormId">
            <label>대분류
                <input type="text" id="listFormCategory" list="categoryOptions" required>
                <datalist id="categoryOptions"></datalist>
            </label>
            <label>소분류명
                <input type="text" id="listFormName" required>
            </label>
            <label>표시순서
                <input type="number" id="listFormOrder" value="0">
            </label>
            <div class="form-actions">
                <button type="submit">저장</button>
                <button type="button" id="listFormCancel" style="display:none;">취소</button>
            </div>
        </form>
    </section>

    <section class="form-section">
        <h2>항목 추가/수정</h2>
        <form id="itemForm">
            <input type="hidden" id="itemFormId">
            <label>소속 소분류
                <select id="itemFormListSelect" required></select>
            </label>
            <label>제목
                <input type="text" id="itemFormTitle" required>
            </label>
            <label>순위
                <input type="number" id="itemFormRank" value="1">
            </label>
            <label>코멘트
                <textarea id="itemFormComment"></textarea>
            </label>
            <label>이미지/링크 URL
                <input type="url" id="itemFormMedia" placeholder="https://...">
            </label>
            <div class="form-actions">
                <button type="submit">저장</button>
                <button type="button" id="itemFormCancel" style="display:none;">취소</button>
            </div>
        </form>
    </section>

    <section>
        <h2>전체 목록</h2>
        <div id="listContainer"></div>
    </section>

    <div id="toast" class="toast"></div>
</main>
<script src="admin-utils.js?v=20260821"></script>
<script src="admin.js?v=20260821"></script>
</body>
</html>
```

- [x] **Step 4: 로컬 서버로 브라우저 확인**

Task 4에서 만든 `serve-static.js`를 Bash 도구의 `run_in_background: true`로 다시 실행하고 `http://localhost:8080/admin.html`을 연다.

Expected: 소분류 폼/항목 폼과 Task 1 예시 데이터가 목록에 보임. 브라우저 도구로 소분류 하나를 새로 추가해보고("대분류: 드라마/영화", "소분류명: 드라마 BEST5", "표시순서: 1") 토스트 메시지와 함께 목록에 반영되는지 확인 → 이어서 그 소분류에 항목 하나를 추가하고 반영 확인 → 마지막으로 방금 추가한 항목과 소분류를 삭제 버튼으로 정리해서 원상 복구한다. 콘솔 에러 없음을 확인한다.

확인 후 서버 프로세스를 종료한다.

- [x] **Step 5: 커밋**

```bash
git add admin.html admin.js admin_style.css
git commit -m "feat: 나의 취향 관리자 페이지"
```

---

### Task 6: GitHub 저장소 연결 및 GitHub Pages 배포

**Files:**
- Create: `.gitignore`

**Interfaces:**
- Consumes: 사용자가 github.com에서 만든 빈 저장소 `my-taste`의 URL

- [x] **Step 1: `.gitignore` 작성**

```
node_modules/
*.log
.DS_Store
```

- [x] **Step 2: 커밋**

```bash
git add .gitignore
git commit -m "chore: gitignore 추가"
```

- [x] **Step 3: 사용자에게 빈 GitHub 저장소 생성 요청**

사용자에게 안내: https://github.com/new 에서 저장소 이름 `my-taste`(Public), README/gitignore/license 없이 빈 저장소로 생성 → 생성된 저장소의 URL(예: `https://github.com/<username>/my-taste.git`)을 알려달라고 요청.

- [x] **Step 4: 원격 저장소 연결 (사용자가 URL을 준 뒤)**

```bash
git branch -M main
git remote add origin <사용자가 알려준 저장소 URL>
git remote -v
```

Expected: `origin`이 방금 알려준 URL로 fetch/push 모두 등록되어 출력됨.

- [x] **Step 5: Push — 반드시 사용자 확인 후 실행**

공개 저장소에 push하는 것은 "공개 콘텐츠 게시"에 해당하므로, 아래 명령을 실행하기 전에 반드시 채팅으로 "지금까지 만든 파일을 `my-taste` 저장소로 push해도 될까요?"라고 확인받는다.

```bash
git push -u origin main
```

Expected: `main -> main` 브랜치가 원격에 생성되었다는 출력.

- [x] **Step 6: GitHub Pages 활성화 (사용자 수동 작업)**

사용자에게 안내: 저장소의 Settings → Pages → Source를 "Deploy from a branch"로, Branch를 "main" / "/(root)"로 설정 후 Save. 1~2분 후 `https://<username>.github.io/my-taste/`에서 서비스된다.

- [x] **Step 7: 배포 확인**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://<username>.github.io/my-taste/index.html"
curl -s -o /dev/null -w "%{http_code}\n" "https://<username>.github.io/my-taste/admin.html"
```

Expected: 두 명령 모두 `200` 출력. 404가 나오면 Pages 빌드가 아직 끝나지 않은 것이므로 1~2분 후 재시도한다.

---

### Task 7: End-to-End 검증

**Files:** 없음 (검증 전용 태스크)

**Interfaces:** 없음

- [ ] **Step 1: 배포된 공개 페이지 확인**

`mcp__Claude_Browser__navigate`로 `https://<username>.github.io/my-taste/index.html`을 연다.

Expected: Task 1의 예시 데이터("음악 > 여름노래 BEST5")가 렌더링됨. `mcp__Claude_Browser__read_console_messages`로 콘솔 에러가 없는지 확인.

- [ ] **Step 2: 배포된 관리자 페이지에서 실제 데이터 추가**

`mcp__Claude_Browser__navigate`로 `https://<username>.github.io/my-taste/admin.html`을 연다. 사용자에게 실제로 기록하고 싶은 첫 BEST5 하나(대분류/소분류명/항목 1~2개)를 물어보고, 브라우저 도구로 폼을 채워 저장한다.

Expected: 토스트 "저장되었습니다" 표시, 목록에 반영됨.

- [ ] **Step 3: 공개 페이지에 반영 확인**

`index.html`을 새로고침한다.

Expected: Step 2에서 추가한 소분류/항목이 보임.

- [ ] **Step 4: Task 1 예시 데이터 정리**

사용자에게 "여름노래 BEST5" 예시 데이터를 이제 지워도 될지 확인하고, 승인하면 admin.html에서 삭제한다.

Expected: 삭제 후 index.html에서 예시 데이터가 사라지고 실제 데이터만 남음.
