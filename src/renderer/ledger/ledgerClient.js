const { API_PATHS, buildServerUrl } = require('../config/appConfig');

let cachedLedgerEntries = [];

function getLedgerUrl(id) {
  const baseUrl = buildServerUrl(API_PATHS.ledger);
  return id ? `${baseUrl}/${id}` : baseUrl;
}

async function getLedgerEntries() {
  try {
    const response = await fetch(getLedgerUrl(), { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`서버 가계부 응답 오류: ${response.status}`);
    }

    cachedLedgerEntries = await response.json();
    return cachedLedgerEntries;
  } catch (error) {
    console.error('🚨 서버 가계부 로딩 실패:', error);
    return cachedLedgerEntries;
  }
}

async function deleteLedgerEntry(id) {
  try {
    const response = await fetch(getLedgerUrl(id), { method: 'DELETE' });

    if (!response.ok) {
      throw new Error(`서버 가계부 삭제 응답 오류: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('🚨 서버 가계부 삭제 실패:', error);
    return null;
  }
}

module.exports = {
  getLedgerEntries,
  deleteLedgerEntry,
};
