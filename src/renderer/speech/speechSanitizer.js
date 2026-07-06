const FILE_EXTENSION_PATTERN = /\b[^\s`'"<>]+\.(pdf|txt|md|docx?|xlsx?|pptx?|png|jpe?g|gif|mp3|mp4|zip|js|ts|rs|py|json|ya?ml|html|css)\b/gi;
const WINDOWS_PATH_PATTERN = /[a-zA-Z]:[\\/][^\n\r]+/g;
const NETWORK_OR_UNIX_PATH_PATTERN = /(?:\\\\|\/)[^\n\r]+/g;
const BACKTICK_BLOCK_PATTERN = /`[^`]*`/g;

function sanitizeSpeechText(text, fallback = '화면에 결과를 정리해뒀어.') {
  const source = String(text || '');
  const cleaned = source
    .replace(BACKTICK_BLOCK_PATTERN, '')
    .replace(WINDOWS_PATH_PATTERN, '')
    .replace(NETWORK_OR_UNIX_PATH_PATTERN, '')
    .replace(FILE_EXTENSION_PATTERN, '')
    .split('\n')
    .filter((line) => !looksPathLike(line))
    .join('\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned || fallback;
}

function looksPathLike(line) {
  const lower = String(line || '').toLowerCase();
  return lower.includes(':\\')
    || lower.includes(':/')
    || lower.includes('경로:')
    || lower.includes('위치:')
    || lower.includes('파일명:')
    || lower.includes('폴더명:');
}

module.exports = { sanitizeSpeechText };
