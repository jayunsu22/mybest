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
