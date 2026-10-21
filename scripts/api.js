// Готовый браузерный сервис. Сетевые POST-запросы не отправляются.
export const VERSION = 'workshop-hw7.0';
export const PREFIX = 'workshop-hw7:';
const DATA_KEY = `${PREFIX}applications`;
const seed = [
  { id: '1', name: 'Анна Лебедева', topic: 'html', comment: 'Хочу разобраться с адаптивной вёрсткой.' },
  { id: '2', name: 'Михаил Орлов', topic: 'javascript', comment: 'Интересно, как устроены события.' },
  { id: '3', name: 'София Волкова', topic: 'javascript', comment: 'Покажите работу с формой и списком.' },
];
let mode = 'normal';
let generation = 0;
let storageProblem = '';
let applications = readApplications();

function readApplications() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw === null) return structuredClone(seed);
    const value = JSON.parse(raw);
    const fields = ['id', 'name', 'topic', 'comment'];
    if (!Array.isArray(value) || !value.every(item => item && fields.every(key => typeof item[key] === 'string')) || new Set(value.map(item => item.id)).size !== value.length) throw new Error('format');
    return value;
  } catch {
    storageProblem = 'Не удалось прочитать сохранённые заявки. Загружены исходные данные.';
    return structuredClone(seed);
  }
}

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(data) };
}

export function getStorageProblem() { return storageProblem; }
export function setMode(value) { if (['normal', 'delay', 'error'].includes(value)) mode = value; }
export async function listApplications() { return structuredClone(applications); }

export async function createApplication(input) {
  const requestMode = mode;
  const requestGeneration = generation;
  const snapshot = structuredClone(input);
  await new Promise(resolve => setTimeout(resolve, requestMode === 'delay' ? 2000 : 150));
  if (generation !== requestGeneration) return response(409, { error: { message: 'Стенд сброшен. Повторите действие.' } });
  if (requestMode === 'error') return response(503, { error: { message: 'Сервис временно недоступен. Попробуйте ещё раз.' } });
  const id = String(Math.max(0, ...applications.map(item => Number(item.id) || 0)) + 1);
  const created = { id, name: snapshot.name, topic: snapshot.topic, comment: snapshot.comment };
  const updated = [...applications, created];
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(updated));
    applications = updated;
    storageProblem = '';
    return response(201, created);
  } catch {
    return response(503, { error: { message: 'Не удалось сохранить данные в браузере.' } });
  }
}

export function resetData() {
  generation += 1;
  mode = 'normal';
  applications = structuredClone(seed);
  storageProblem = '';
  try { localStorage.setItem(DATA_KEY, JSON.stringify(applications)); }
  catch { storageProblem = 'Данные сброшены в памяти; запись в хранилище недоступна.'; }
}
