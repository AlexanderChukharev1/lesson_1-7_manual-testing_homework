import { PREFIX } from './api.js';

export const CANARY_KEY = `${PREFIX}canary`;
const LOG_KEY = `${PREFIX}incidents`;
const BLOCK_KEY = `${PREFIX}blockedUntil`;

let incidents = [];
let refreshTimes = [];
let blockedUntil = 0;
let timer = null;

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function showIncidents() {
  const list = document.querySelector('#incident-list');
  list.replaceChildren();
  for (const incident of [...incidents].reverse()) {
    const item = document.createElement('li');
    item.textContent = `${incident.time} — ${incident.type}: ${incident.reason}`;
    list.append(item);
  }
  document.querySelector('#incidents-empty').hidden = incidents.length > 0;
  document.querySelector('#incident-count').textContent = String(incidents.length);
}

function updateTimer() {
  const seconds = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
  document.querySelector('#security-status').textContent = seconds ? `Пауза: ${seconds} с` : 'Ограничений нет';
  const detail = document.querySelector('#restriction-detail');
  detail.hidden = seconds === 0;
  if (seconds) detail.textContent = `Отправка и обновление недоступны ${seconds} с. Причина: ${incidents.at(-1)?.reason || 'инцидент'}`;
  if (!seconds && timer !== null) {
    clearInterval(timer);
    timer = null;
    blockedUntil = 0;
  }
}

function startTimer() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  updateTimer();
  if (blockedUntil > Date.now()) timer = setInterval(updateTimer, 250);
}

export function reportIncident(type, reason) {
  if (isRestricted()) return;
  incidents.push({ time: new Date().toISOString(), type, reason });
  incidents = incidents.slice(-30);
  blockedUntil = Date.now() + 30000;
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(incidents));
    localStorage.setItem(BLOCK_KEY, JSON.stringify(blockedUntil));
  } catch {}
  showIncidents();
  startTimer();
}

export function checkActivity(action, details = {}) {
  if (isRestricted()) return;
  if (action === 'refresh') {
    const now = Date.now();
    refreshTimes = refreshTimes.filter(time => now - time < 5000);
    refreshTimes.push(now);
    if (refreshTimes.length >= 6) {
      refreshTimes = [];
      reportIncident('T1', 'Шесть обновлений за пять секунд');
    }
  }
  if (action === 'submit') {
    if (String(details.supportCode || '').trim()) {
      reportIncident('T2', 'Заполнено скрытое поле supportCode');
    } else if (details.topic && !['html', 'javascript', 'api'].includes(details.topic)) {
      reportIncident('T4', 'Неизвестное направление');
    }
  }
  if (action === 'decoy') reportIncident('T3', 'Вызвана скрытая кнопка staff-export');
  if (action === 'startup') {
    const canary = read(CANARY_KEY, null);
    if (canary?.role === 'admin') {
      try { localStorage.setItem(CANARY_KEY, JSON.stringify({ role: 'visitor' })); } catch {}
      reportIncident('T5', 'Изменён маркер visitor на admin');
    }
    const url = new URL(location.href);
    if (url.searchParams.get('staff') === '1') {
      url.searchParams.delete('staff');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      reportIncident('T6', 'Параметр staff=1 в адресе');
    }
  }
}

export function isRestricted() {
  return blockedUntil > Date.now();
}

export function initializeSecurity() {
  const saved = read(LOG_KEY, []);
  incidents = Array.isArray(saved) ? saved.filter(item => item && typeof item.time === 'string' && typeof item.type === 'string' && typeof item.reason === 'string').slice(-30) : [];
  const until = read(BLOCK_KEY, 0);
  blockedUntil = typeof until === 'number' && Number.isFinite(until) ? until : 0;
  try {
    if (localStorage.getItem(CANARY_KEY) === null) {
      localStorage.setItem(CANARY_KEY, JSON.stringify({ role: 'visitor' }));
    }
  } catch {}
  showIncidents();
  startTimer();
  checkActivity('startup');
}

export function resetSecurity() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  blockedUntil = 0;
  incidents = [];
  refreshTimes = [];
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX) && key !== `${PREFIX}applications`) localStorage.removeItem(key);
    }
    localStorage.setItem(CANARY_KEY, JSON.stringify({ role: 'visitor' }));
  } catch {}
  showIncidents();
  updateTimer();
}
