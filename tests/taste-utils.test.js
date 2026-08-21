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
