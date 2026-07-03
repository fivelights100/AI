const DEFAULT_SERVER_BASE_URL = 'http://localhost:3000';
const SERVER_BASE_URL_STORAGE_KEY = 'aiCompanion.serverBaseUrl';

const API_PATHS = {
  status: '/api/status',
  chat: '/api/chat',
  schedules: '/api/schedules',
  stt: '/api/stt',
  model: '/models/hiyori_ex/runtime/hiyori_free_t08.model3.json',
};

const WAKE_WORD_MODEL_URL = 'https://teachablemachine.withgoogle.com/models/vISQlyUPn/';

function normalizeBaseUrl(value) {
  const fallback = DEFAULT_SERVER_BASE_URL;
  const rawValue = String(value || '').trim();

  if (!rawValue) return fallback;

  const withProtocol = /^https?:\/\//i.test(rawValue)
    ? rawValue
    : `http://${rawValue}`;

  return withProtocol.replace(/\/+$/, '');
}

function getServerBaseUrl() {
  try {
    return normalizeBaseUrl(localStorage.getItem(SERVER_BASE_URL_STORAGE_KEY));
  } catch (_error) {
    return DEFAULT_SERVER_BASE_URL;
  }
}

function setServerBaseUrl(value) {
  const normalizedUrl = normalizeBaseUrl(value);

  try {
    localStorage.setItem(SERVER_BASE_URL_STORAGE_KEY, normalizedUrl);
  } catch (error) {
    console.warn('서버 주소 설정 저장 실패:', error);
  }

  return normalizedUrl;
}

function buildServerUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getServerBaseUrl()}${normalizedPath}`;
}

function getModelUrl() {
  return buildServerUrl(API_PATHS.model);
}

module.exports = {
  API_PATHS,
  DEFAULT_SERVER_BASE_URL,
  WAKE_WORD_MODEL_URL,
  buildServerUrl,
  getModelUrl,
  getServerBaseUrl,
  normalizeBaseUrl,
  setServerBaseUrl,
};
