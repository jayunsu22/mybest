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
