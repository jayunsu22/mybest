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
