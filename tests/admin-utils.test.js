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

const { buildListTitle, parseBestLimit, moveInArray, renumber } = require('../admin-utils.js');

test('buildListTitle appends BEST N only when a limit is given', () => {
  assert.equal(buildListTitle(' 남자배우 ', 5), '남자배우 BEST5');
  assert.equal(buildListTitle('인생영화', 0), '인생영화');
  assert.equal(buildListTitle('', 5), '');
});

test('parseBestLimit reads the number after BEST', () => {
  assert.equal(parseBestLimit('남자배우 BEST5'), 5);
  assert.equal(parseBestLimit('여름노래 best 10'), 10);
  assert.equal(parseBestLimit('인생영화'), null);
});

test('moveInArray moves an element and rejects out-of-range moves', () => {
  assert.deepEqual(moveInArray(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  assert.deepEqual(moveInArray(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.equal(moveInArray(['a', 'b'], 0, -1), null);
  assert.equal(moveInArray(['a', 'b'], 1, 1), null);
});

test('renumber returns only entries whose field changed', () => {
  const result = renumber([{ id: 'x', 순위: 2 }, { id: 'y', 순위: 2 }, { id: 'z', 순위: 0 }], '순위');
  assert.deepEqual(result, [{ id: 'x', 순위: 1 }, { id: 'z', 순위: 3 }]);
});
