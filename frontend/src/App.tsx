import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownToLine, ArrowRight, BarChart3, BookOpen, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Database, FileSpreadsheet, FolderOpen,
  GitCompareArrows, Info, Layers3, Menu, Plus, RotateCcw, Save, Settings2,
  ShieldCheck, Sparkles, Trash2, UploadCloud, WandSparkles, X,
} from 'lucide-react';
import Chart from './Chart';
import { analyze, deleteScenario, getScenario, listScenarios, saveScenario } from './api';
import { cloneDemo } from './demo';
import { downloadText, exportCsv, importCsv } from './csv';
import type { Analysis, Dataset, Ranked, ScenarioSummary } from './types';

type Page = 'overview' | 'data' | 'weights' | 'results' | 'history';
type Method = 'topsis' | 'electre' | 'saw';
const NAV: { id: Page; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Обзор проекта', icon: Layers3 },
  { id: 'data', label: 'Альтернативы и данные', icon: Database },
  { id: 'weights', label: 'Критерии и AHP', icon: Settings2 },
  { id: 'results', label: 'Результаты анализа', icon: BarChart3 },
  { id: 'history', label: 'История решений', icon: Clock3 },
];

function nice(value: number, digits = 3) {
  return Number.isFinite(value) ? value.toLocaleString('ru-RU', { maximumFractionDigits: digits }) : '—';
}

function Tag({ children, tone = 'purple' }: { children: React.ReactNode; tone?: 'purple' | 'green' | 'gray' }) {
  return <span className={'tag tag-' + tone}>{children}</span>;
}

function SectionTitle({ eyebrow, title, description, action }: {
  eyebrow: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return <div className="section-head">
    <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {action && <div className="section-action">{action}</div>}
  </div>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'panel ' + className}>{children}</div>;
}

function initialMatrix(data: Dataset): number[][] {
  const size = data.criteria.length;
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => i === j ? 1 : 1));
}

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [data, setData] = useState<Dataset>(cloneDemo);
  const [result, setResult] = useState<Analysis | null>(null);
  const [method, setMethod] = useState<Method>('topsis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('');
  const [scenarioName, setScenarioName] = useState('Выбор IT-стажировки');
  const [history, setHistory] = useState<ScenarioSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dirty, setDirty] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const change = useCallback((next: Dataset | ((prev: Dataset) => Dataset)) => {
    setData(next);
    setDirty(true);
    setResult(null);
    setError('');
    requestId.current++;
  }, []);

  const run = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError(''); setMessage('');
    try {
      const next = await analyze(data);
      if (current !== requestId.current) return;
      setResult(next);
      setSelected(next.recommendation.name);
      setDirty(false);
      setPage('results');
    } catch (e) { if (current === requestId.current) setError((e as Error).message); }
    finally { if (current === requestId.current) setLoading(false); }
  }, [data]);

  const refresh = useCallback(async () => {
    try { setHistory(await listScenarios()); } catch { /* no history when server offline */ }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const ranked: Ranked[] = useMemo(() => {
    if (!result) return [];
    return method === 'topsis' ? result.topsis
      : method === 'saw' ? result.saw : result.electre.ranking;
  }, [result, method]);
  const metric = method === 'electre' ? 'flow' as const : 'score' as const;

  async function onFile(file: File) {
    if (file.size > 1024 * 1024) { setError('Максимальный размер файла — 1 МБ'); return; }
    try {
      const parsed = importCsv(await file.text());
      change(parsed);
      setScenarioName(file.name.replace(/\.csv$/i, ''));
      setPage('data');
      setMessage('CSV загружен. Проверьте направления критериев и веса.');
    } catch (e) { setError((e as Error).message); }
  }

  async function save() {
    setLoading(true); setError('');
    try {
      await saveScenario(scenarioName || 'Без названия', data);
      setMessage('Расчёт сохранён в PostgreSQL.');
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function restore(id: string) {
    setLoading(true); setError('');
    try {
      const scenario = await getScenario(id);
      change(scenario.payload);
      setResult(scenario.result);
      setDirty(false);
      setScenarioName(scenario.name);
      setSelected(scenario.result.recommendation.name);
      setPage('results');
      setMessage('Сохранённый расчёт открыт.');
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function remove(id: string) {
    if (!window.confirm('Удалить сохранённый расчёт?')) return;
    try { await deleteScenario(id); await refresh(); }
    catch (e) { setError((e as Error).message); }
  }

  function addCriterion() {
    if (data.criteria.length >= 10) { setError('Максимум — 10 критериев'); return; }
    let index = data.criteria.length + 1;
    while (data.criteria.some(c => c.key === 'c' + index)) index++;
    const key = 'c' + index;
    change(prev => ({
      ...prev, criteria: [...prev.criteria, { key, label: 'Новый критерий', direction: 'max', weight: 10 }],
      alternatives: prev.alternatives.map(a => ({ ...a, values: { ...a.values, [key]: 0 } })),
      pairwise: null,
    }));
  }

  function removeCriterion(key: string) {
    if (data.criteria.length <= 2) { setError('Нужно минимум два критерия'); return; }
    change(prev => ({
      ...prev, criteria: prev.criteria.filter(c => c.key !== key),
      alternatives: prev.alternatives.map(a => {
        const values = { ...a.values }; delete values[key];
        return { ...a, values };
      }), pairwise: null,
    }));
  }

  function criterionChange(key: string, field: 'label' | 'direction' | 'weight', value: string) {
    change(prev => ({
      ...prev,
      criteria: prev.criteria.map(c => c.key === key ? {
        ...c, [field]: field === 'weight' ? Number(value) : value,
      } : c),
      pairwise: field === 'weight' ? null : prev.pairwise,
    }));
  }

  function addAlternative() {
    if (data.alternatives.length >= 200) { setError('Максимум — 200 альтернатив'); return; }
    const count = data.alternatives.length + 1;
    change(prev => ({
      ...prev, alternatives: [...prev.alternatives, {
        name: 'Вариант ' + count,
        values: Object.fromEntries(prev.criteria.map(c => [c.key, 0])),
      }],
    }));
  }

  function updateAlternative(i: number, key: string, value: string) {
    change(prev => ({
      ...prev, alternatives: prev.alternatives.map((a, index) => index !== i ? a : {
        ...a, ...(key === 'name' ? { name: value } : {
          values: { ...a.values, [key]: value === '' ? NaN : Number(value) },
        }),
      }),
    }));
  }

  function setComparison(i: number, j: number, raw: string) {
    const ratio = Number(raw);
    if (!ratio || !Number.isFinite(ratio)) return;
    change(prev => {
      const matrix = prev.pairwise || initialMatrix(prev);
      const next = matrix.map(row => [...row]);
      next[i][j] = ratio;
      next[j][i] = 1 / ratio;
      return { ...prev, pairwise: next };
    });
  }

  const weightTotal = data.criteria.reduce((a, c) => a + c.weight, 0);
  const choose = (next: Page) => { setPage(next); setSidebarOpen(false); setError(''); };
  const activeName = NAV.find(n => n.id === page)?.label;
  const scores = result ? Object.fromEntries(result.topsis.map(r => [r.name, r.score ?? 0])) : {};

  return <div className="app-shell">
    <aside className={'sidebar ' + (sidebarOpen ? 'sidebar-open' : '')}>
      <div className="brand"><div className="brand-symbol"><GitCompareArrows size={23} /></div>
        <div className="brand-text">Decision<span>Lab</span><small>DECISION INTELLIGENCE</small></div>
        <button className="sidebar-close icon-button" onClick={() => setSidebarOpen(false)} aria-label="Закрыть меню"><X size={19}/></button>
      </div>
      <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav className="sidebar-nav">{NAV.map(item => <button key={item.id}
        className={'nav-item ' + (page === item.id ? 'nav-active' : '')}
        onClick={() => choose(item.id)}><item.icon size={19}/><span>{item.label}</span>
        {page === item.id && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <Card className="sidebar-help">
        <div className="help-icon"><WandSparkles size={19}/></div>
        <strong>Превратите данные в решение</strong>
        <p>Сравните альтернативы тремя методами и узнайте, что влияет на результат.</p>
        <button className="text-link" onClick={() => choose('data')}>Настроить данные <ArrowRight size={15}/></button>
      </Card>
      <div className="sidebar-footer"><span className="status-dot"/> Локальный учебный проект <span>v0.1</span></div>
    </aside>

    {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}/>}
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Открыть меню"><Menu size={22}/></button>
          <div className="breadcrumb">Пространство решений <span>/</span> <b>{activeName}</b></div></div>
        <div className="topbar-right">
          <Tag tone="green"><span className="tiny-dot"/> Демо-проект</Tag>
          <button className="button button-subtle" onClick={() => {
            if (!window.confirm('Загрузить пример заново? Несохранённые изменения будут потеряны.')) return;
            change(cloneDemo()); setScenarioName('Выбор IT-стажировки'); setPage('overview');
          }}><RotateCcw size={15}/> Пример заново</button>
          <button className="button button-primary top-run" onClick={() => void run()} disabled={loading}>
            <Sparkles size={16}/>{loading ? 'Считаю…' : 'Рассчитать'}</button>
        </div>
      </header>
      <main className="content">
        {error && <div role="alert" className="alert alert-error"><Info size={18}/><span>{error}</span><button onClick={() => setError('')} aria-label="Закрыть"><X size={17}/></button></div>}
        {message && <div role="status" className="alert alert-success"><CheckCircle2 size={18}/><span>{message}</span><button onClick={() => setMessage('')} aria-label="Закрыть"><X size={17}/></button></div>}

        {page === 'overview' && <>
          <div className="hero">
            <div className="hero-content">
              <div className="hero-pill"><Sparkles size={14}/> АНАЛИТИКА НОВОГО УРОВНЯ</div>
              <h1>Каждое решение<br/><em>основано на данных.</em></h1>
              <p>Оцените варианты, настройте приоритеты и найдите лучший компромисс с помощью проверенных методов поддержки принятия решений.</p>
              <div className="hero-actions"><button className="button button-white" onClick={() => void run()}>Начать анализ <ArrowRight size={17}/></button>
                <button className="button button-hero-outline" onClick={() => choose('data')}>Посмотреть данные</button></div>
            </div>
            <div className="hero-decoration" aria-hidden="true"><div className="orbit orbit-1"/><div className="orbit orbit-2"/><div className="orbit orbit-3"/><div className="hero-orb"><BarChart3 size={49}/></div></div>
          </div>
          <div className="stat-grid">
            <Card className="stat-card"><div className="stat-head">Альтернативы <div className="stat-icon purple"><Layers3 size={20}/></div></div>
              <strong>{String(data.alternatives.length).padStart(2, '0')}</strong><span>вариантов для сравнения</span></Card>
            <Card className="stat-card"><div className="stat-head">Критерии <div className="stat-icon blue"><Settings2 size={20}/></div></div>
              <strong>{String(data.criteria.length).padStart(2, '0')}</strong><span>с настраиваемыми весами</span></Card>
            <Card className="stat-card"><div className="stat-head">Методы <div className="stat-icon green"><GitCompareArrows size={20}/></div></div>
              <strong>03<span className="plus-stat">+1</span></strong><span>AHP · TOPSIS · ELECTRE · SAW</span></Card>
            <Card className="stat-card"><div className="stat-head">Статус <div className="stat-icon orange"><Activity size={20}/></div></div>
              <strong className="stat-state">{result && !dirty ? 'Готово' : 'К анализу'}</strong><span>{result && !dirty ? 'расчёт выполнен' : 'ожидается запуск'}</span></Card>
          </div>
          <div className="columns-2">
            <Card>
              <div className="panel-heading"><div><span className="eyebrow">РАБОЧИЙ ПРОЦЕСС</span><h3>Три шага к решению</h3></div><Tag>Быстрый старт</Tag></div>
              <div className="steps">
                <button onClick={() => choose('data')} className="step"><span className="step-no">01</span><div><b>Добавьте альтернативы</b><p>Загрузите CSV или отредактируйте демонстрационные данные</p></div><ArrowRight size={18}/></button>
                <button onClick={() => choose('weights')} className="step"><span className="step-no">02</span><div><b>Настройте критерии</b><p>Выберите направления оптимизации, веса и попарные оценки AHP</p></div><ArrowRight size={18}/></button>
                <button onClick={() => void run()} className="step"><span className="step-no">03</span><div><b>Получите рекомендации</b><p>Сравните TOPSIS, ELECTRE I и SAW, проверьте устойчивость</p></div><ArrowRight size={18}/></button>
              </div>
            </Card>
            <Card>
              <div className="panel-heading"><div><span className="eyebrow">МЕТОДОЛОГИЯ</span><h3>Методы анализа</h3></div></div>
              <div className="method-list">
                {[['AHP', 'Определение приоритетов', 'Попарные сравнения и контроль согласованности', 'violet'],
                  ['TOPSIS', 'Близость к идеалу', 'Рейтинг с учётом лучшего и худшего решений', 'sky'],
                  ['ELECTRE I', 'Попарное превосходство', 'Отношения согласия и несогласия', 'mint'],
                  ['SAW', 'Взвешенная сумма', 'Дополнительное сравнение результатов', 'peach']].map(([short, label, detail, color]) =>
                    <div className="method-row" key={short}><span className={'method-badge '+color}>{short}</span><div><b>{label}</b><small>{detail}</small></div></div>)}
              </div>
            </Card>
          </div>
        </>}

        {page === 'data' && <>
          <SectionTitle eyebrow="01 / ДАННЫЕ" title="Альтернативы и входные данные"
            description="Создайте собственную матрицу решений или загрузите CSV. Первый столбец — name, остальные — числовые критерии."
            action={<div className="action-buttons">
              <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={event => {
                const file = event.target.files?.[0]; if (file) void onFile(file); event.target.value = '';
              }}/>
              <button className="button button-subtle" onClick={() => fileRef.current?.click()}><UploadCloud size={16}/> Импорт CSV</button>
              <button className="button button-subtle" onClick={() => downloadText('decisionlab-data.csv', exportCsv(data), 'text/csv;charset=utf-8')}><ArrowDownToLine size={16}/> Экспорт</button>
            </div>}/>
          <Card className="data-panel">
            <div className="panel-heading"><div><h3>Матрица решений</h3><p>{data.alternatives.length} альтернатив · {data.criteria.length} критериев</p></div><Tag tone="gray">Редактируется</Tag></div>
            <div className="table-scroll"><table className="data-table"><thead><tr><th>Альтернатива</th>{data.criteria.map(c => <th key={c.key}>{c.label}<small>{c.direction === 'min' ? '↓ меньше — лучше' : '↑ больше — лучше'}</small></th>)}<th/></tr></thead>
              <tbody>{data.alternatives.map((a, i) => <tr key={i}><td><input aria-label={'Название варианта '+(i+1)} value={a.name} onChange={e => updateAlternative(i, 'name', e.target.value)}/></td>
                {data.criteria.map(c => <td key={c.key}><input type="number" step="any" value={Number.isNaN(a.values[c.key]) ? '' : a.values[c.key]}
                  aria-label={a.name + ': ' + c.label} onChange={e => updateAlternative(i, c.key, e.target.value)}/></td>)}
                <td><button className="icon-button danger" disabled={data.alternatives.length <= 2} onClick={() => change(prev => ({...prev, alternatives: prev.alternatives.filter((_, j) => i !== j)}))} aria-label={'Удалить '+a.name}><Trash2 size={17}/></button></td></tr>)}</tbody></table></div>
            <div className="panel-bottom"><button className="button button-subtle" onClick={addAlternative}><Plus size={17}/> Добавить альтернативу</button><span>Не менее 2 и не более 200 вариантов</span></div>
          </Card>
          <Card className="info-panel"><Info size={19}/><div><b>После импорта CSV</b><p>Все критерии получают одинаковый вес и направление «больше — лучше». Обязательно проверьте их в разделе «Критерии и AHP».</p></div><button onClick={() => choose('weights')} className="button button-subtle">Настроить <ArrowRight size={15}/></button></Card>
        </>}

        {page === 'weights' && <>
          <SectionTitle eyebrow="02 / ПРИОРИТЕТЫ" title="Критерии и метод AHP"
            description="Настройте важность критериев напрямую или через попарное сравнение по методу Саати."
            action={<button className="button button-subtle" onClick={addCriterion}><Plus size={16}/> Добавить критерий</button>}/>
          <div className="columns-weight">
            <Card>
              <div className="panel-heading"><div><h3>Вес и направление критериев</h3><p>Веса автоматически нормируются до 100%</p></div><Tag>Настройки</Tag></div>
              <div className="criteria-list">{data.criteria.map((c, index) => <div className="criterion-row" key={c.key}>
                <div className="criterion-top"><span className="criterion-number">{String(index+1).padStart(2,'0')}</span>
                  <input className="criterion-label" value={c.label} aria-label={'Название критерия '+(index+1)}
                    onChange={e => criterionChange(c.key, 'label', e.target.value)}/>
                  <button className="icon-button danger" disabled={data.criteria.length <= 2} onClick={() => removeCriterion(c.key)} aria-label={'Удалить '+c.label}><X size={17}/></button></div>
                <div className="criterion-bottom"><select value={c.direction} aria-label={'Направление '+c.label}
                  onChange={e => criterionChange(c.key, 'direction', e.target.value)}>
                  <option value="max">↑ Больше — лучше</option><option value="min">↓ Меньше — лучше</option></select>
                  <div className="weight-control"><input type="number" min="0" max="10000" step="any" value={c.weight}
                    aria-label={'Вес '+c.label} onChange={e => criterionChange(c.key, 'weight', e.target.value)}/><span>вес</span></div></div>
                <div className="weight-track"><span style={{width: (weightTotal > 0 ? c.weight/weightTotal*100 : 0) + '%'}}/></div>
              </div>)}</div>
              <div className="weight-summary"><span>Суммарный вес</span><b>{nice(weightTotal, 2)}</b><span>Доли после нормализации: {data.criteria.map(c => nice(weightTotal ? c.weight/weightTotal*100 : 0,0)+'%').join(' · ')}</span></div>
            </Card>
            <Card>
              <div className="panel-heading"><div><h3>Попарные сравнения AHP</h3><p>Оцените относительную важность критериев</p></div><Tag tone={data.pairwise ? 'green' : 'gray'}>{data.pairwise ? 'Включён' : 'Не используется'}</Tag></div>
              <div className="ahp-explain"><CircleHelp size={17}/><span>Для пары критериев укажите, во сколько раз первый важнее второго. Шкала от 1/9 до 9, 1 — одинаково важны.</span></div>
              <label className="switch-row"><span><b>Использовать веса AHP</b><small>При включении заменяет прямые веса попарными оценками</small></span>
                <input type="checkbox" checked={data.pairwise !== null && data.pairwise !== undefined} onChange={e => change(prev => ({
                  ...prev, pairwise: e.target.checked ? initialMatrix(prev) : null,
                }))}/></label>
              {data.pairwise && <div className="pairwise-list">{data.criteria.flatMap((left, i) => data.criteria.slice(i+1).map((right, offset) => {
                const j = i + offset + 1;
                const ratio = data.pairwise![i][j];
                return <div className="pairwise-row" key={left.key+right.key}>
                  <div className="pairwise-label"><b>{left.label}</b><small>в сравнении с</small><b>{right.label}</b></div>
                  <select aria-label={left.label + ' относительно ' + right.label}
                    value={String(Math.round(ratio*10000)/10000)}
                    onChange={e => setComparison(i,j,e.target.value)}>
                    {[1/9,1/8,1/7,1/6,1/5,1/4,1/3,1/2,1,2,3,4,5,6,7,8,9].map(v =>
                      <option key={v} value={String(Math.round(v*10000)/10000)}>{nice(v,3)}×</option>)}
                  </select></div>;
              }))}</div>}
              {!data.pairwise && <div className="empty-ahp"><GitCompareArrows size={36}/><b>Попарное сравнение выключено</b><p>Включите AHP, чтобы рассчитать веса методом Саати и проверить согласованность предпочтений.</p></div>}
              {result?.ahp && !dirty && <div className={'consistency '+(result.ahp.consistent ? 'consistency-ok' : 'consistency-bad')}>
                <ShieldCheck size={19}/><div><b>CR = {nice(result.ahp.cr,4)} — {result.ahp.consistent ? 'согласовано' : 'требует пересмотра'}</b>
                  <small>Рекомендуемый порог CR &lt; 0,10</small></div></div>}
            </Card>
          </div>
          <div className="next-step"><p>Критерии готовы? Запустите анализ и сравните результаты методов.</p>
            <button className="button button-primary" onClick={() => void run()} disabled={loading}><Sparkles size={17}/> Рассчитать рейтинг</button></div>
        </>}

        {page === 'results' && <>
          <SectionTitle eyebrow="03 / РЕЗУЛЬТАТЫ" title="Анализ и рекомендации"
            description="Сравнение альтернатив по нескольким методам и оценка устойчивости решения."
            action={<div className="action-buttons"><button className="button button-subtle" onClick={() => {
              if (!result) return;
              downloadText('decisionlab-results.json', JSON.stringify(result,null,2),'application/json');
            }} disabled={!result}><ArrowDownToLine size={16}/> Экспорт JSON</button>
              <button className="button button-primary" onClick={() => void save()} disabled={!result || dirty || loading}><Save size={16}/> Сохранить расчёт</button></div>}/>
          {!result || dirty ? <Card className="empty-results"><BarChart3 size={43}/><h3>Результатов пока нет</h3><p>Выполните расчёт, чтобы увидеть сравнение альтернатив и рекомендации.</p>
            <button className="button button-primary" disabled={loading} onClick={() => void run()}><Sparkles size={16}/> Рассчитать</button></Card> : <>
            <div className="recommendation">
              <div><div className="recommendation-kicker"><Sparkles size={15}/> РЕКОМЕНДАЦИЯ НА ОСНОВЕ TOPSIS</div>
                <h2>{result.recommendation.name}</h2><p>Наиболее предпочтительная альтернатива с текущими весами и направлениями критериев.</p></div>
              <div className="recommendation-score"><small>ИТОГОВЫЙ БАЛЛ</small><strong>{nice(result.recommendation.score, 4)}</strong><span>из 1,0</span></div>
            </div>
            <div className="result-grid">
              <Card className="chart-panel">
                <div className="panel-heading"><div><h3>Рейтинг альтернатив</h3><p>Нажмите на столбец для выбора варианта</p></div><div className="method-tabs">
                  {(['topsis','electre','saw'] as const).map(m => <button key={m}
                    className={m===method?'active':''} onClick={() => setMethod(m)}>{m==='electre'?'ELECTRE':m.toUpperCase()}</button>)}</div></div>
                <Chart data={ranked} metric={metric} selected={selected} onSelect={setSelected}/>
                <div className="chart-caption"><Info size={15}/>{method === 'electre' ?
                  'ELECTRE I: поток исходящих минус входящие связи. Полный порядок не гарантирован.' :
                  method === 'topsis' ? 'Чем ближе значение к 1, тем ближе альтернатива к идеалу.' :
                    'SAW: взвешенная сумма нормированных полезностей. Чем выше, тем лучше.'}</div>
              </Card>
              <Card className="detail-panel"><div className="panel-heading"><div><span className="eyebrow">ДЕТАЛИ ВАРИАНТА</span><h3>{selected || result.recommendation.name}</h3></div><Tag tone="green">Анализ</Tag></div>
                <div className="detail-score"><span>Результат по TOPSIS</span><strong>{nice(scores[selected] ?? 0, 4)}</strong></div>
                <h4>Значения критериев</h4>
                {data.criteria.map(c => <div className="detail-row" key={c.key}>
                  <span>{c.label}<small>{c.direction === 'min' ? 'Минимизация' : 'Максимизация'}</small></span>
                  <b>{nice(data.alternatives.find(a => a.name === selected)?.values[c.key] ?? 0, 2)}</b>
                </div>)}
                {selected===result.recommendation.name && <div className="reason-block"><b><Sparkles size={16}/> Сильные стороны лидера</b>
                  {result.recommendation.reasons.map(item => <p key={item.criterion}>{item.criterion}: полезность {nice(item.utility,2)}, вес {nice(item.weight*100,1)}%</p>)}</div>}
              </Card>
            </div>
            <div className="columns-2">
              <Card><div className="panel-heading"><div><span className="eyebrow">СОГЛАСОВАННОСТЬ</span><h3>Результаты всех методов</h3></div></div>
                <div className="table-scroll"><table className="data-table comparison-table"><thead><tr><th>Альтернатива</th><th>TOPSIS</th><th>ELECTRE</th><th>SAW</th></tr></thead>
                  <tbody>{result.topsis.map((t, index) => <tr key={t.name}><td><b>{index+1}. {t.name}</b></td>
                    <td>{nice(t.score ?? 0, 4)}</td>
                    <td>{nice(result.electre.ranking.find(r => r.name === t.name)?.flow ?? 0, 0)}</td>
                    <td>{nice(result.saw.find(r => r.name === t.name)?.score ?? 0, 4)}</td></tr>)}</tbody></table></div>
                <p className="footnote">Шкалы методов различаются — баллы нельзя складывать или усреднять.</p>
              </Card>
              <Card><div className="panel-heading"><div><span className="eyebrow">УСТОЙЧИВОСТЬ</span><h3>Анализ чувствительности</h3></div></div>
                <p className="panel-copy">Проверяем, изменится ли лидер TOPSIS при увеличении или уменьшении веса каждого критерия на 20%.</p>
                <div className="table-scroll"><table className="data-table sensitivity-table"><thead><tr><th>Критерий</th><th>Изменение</th><th>Лидер</th></tr></thead>
                  <tbody>{result.sensitivity.map((item,i) => <tr key={i}><td>{item.criterion}</td>
                    <td><span className={'delta '+(item.factor>1?'delta-up':'delta-down')}>{item.factor>1?'+20%':'−20%'}</span></td>
                    <td>{item.leader===result.recommendation.name?<span className="stable">{item.leader} <CheckCircle2 size={14}/></span>:<span className="changed">{item.leader}</span>}</td></tr>)}</tbody></table></div>
              </Card>
            </div>
            <Card><div className="panel-heading"><div><span className="eyebrow">AHP И ELECTRE</span><h3>Проверка методов</h3></div></div>
              <div className="validation-grid"><div><h4>Весовые коэффициенты</h4>{result.weights.map(w => <div className="weight-result" key={w.key}><span>{w.label}</span><b>{nice(w.weight*100,1)}%</b><div className="weight-track"><span style={{width:w.weight*100+'%'}}/></div></div>)}</div>
                <div><h4>Согласованность AHP</h4>{result.ahp ? <><p>CR: <b>{nice(result.ahp.cr,4)}</b></p><Tag tone={result.ahp.consistent?'green':'gray'}>{result.ahp.consistent?'Согласовано':'Несогласовано'}</Tag></> :
                    <p className="muted">Использованы напрямую заданные веса. Включите AHP для проверки согласованности.</p>}
                  <h4 className="graph-title">ELECTRE I: превосходство</h4><p>Выявлено направленных связей: <b>{result.electre.edges.length}</b></p>
                  <p className="muted">Пороги согласия: {nice(result.electre.thresholds.concordance,2)}, несогласия: {nice(result.electre.thresholds.discordance,2)}.</p>
                </div></div>
            </Card>
          </>}
        </>}

        {page === 'history' && <>
          <SectionTitle eyebrow="04 / ИСТОРИЯ" title="Сохранённые решения"
            description="Возвращайтесь к результатам, сравнивайте сценарии и продолжайте анализ."
            action={<button className="button button-subtle" onClick={() => void refresh()}><RotateCcw size={16}/> Обновить</button>}/>
          <Card>{history.length===0?<div className="empty-history"><FolderOpen size={42}/><h3>Пока нет сохранённых расчётов</h3>
            <p>Откройте «Результаты анализа» и сохраните свой первый сценарий.</p>
            <button className="button button-primary" onClick={() => choose('data')}>Создать решение <ArrowRight size={16}/></button></div>:
            <div className="history-list">{history.map(s => <div className="history-item" key={s.id}>
              <div className="history-icon"><FileSpreadsheet size={21}/></div><div className="history-text"><b>{s.name}</b>
                <span>{new Date(s.created_at).toLocaleString('ru-RU')} · {s.alternatives} альтернатив</span></div>
              <button className="button button-subtle" onClick={() => void restore(s.id)}><FolderOpen size={16}/> Открыть</button>
              <button className="icon-button danger" onClick={() => void remove(s.id)} aria-label={'Удалить '+s.name}><Trash2 size={18}/></button>
            </div>)}</div>}
          </Card>
          <Card className="info-panel"><BookOpen size={19}/><div><b>Где хранятся данные?</b><p>Сценарии сохраняются на сервере Django в PostgreSQL. В учебной версии нет авторизации, поэтому приложение предназначено для локального запуска.</p></div></Card>
        </>}

        <footer className="footer"><span>© 2026 DecisionLab · Система поддержки принятия решений</span><span>Сделано для исследований и обучения <ChevronDown size={13}/></span></footer>
      </main>
    </div>
  </div>;
}
