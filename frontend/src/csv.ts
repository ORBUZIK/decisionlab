import type { Dataset } from './types';

function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let text = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { text += '"'; i++; }
      else { quoted = !quoted; }
    } else if (ch === delimiter && !quoted) {
      fields.push(text.trim()); text = '';
    } else { text += ch; }
  }
  if (quoted) throw new Error('Незакрытые кавычки в CSV');
  fields.push(text.trim());
  return fields;
}

export function importCsv(text: string): Dataset {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
    .split('\n').filter(line => line.trim());
  if (lines.length < 3) throw new Error('CSV: нужны заголовок и минимум две альтернативы');
  const delimiter = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';
  const header = splitCsvLine(lines[0], delimiter);
  if (header.length < 3 || header.length > 11) throw new Error('CSV: нужно 2–10 критериев и колонка name');
  if (header[0].toLowerCase() !== 'name') throw new Error('Первый столбец CSV должен называться name');
  if (new Set(header.map(h => h.toLowerCase())).size !== header.length) throw new Error('Заголовки CSV должны быть уникальными');
  const keys = header.slice(1).map((_, i) => 'c' + (i + 1));
  const criteria = header.slice(1).map((label, i) => ({
    key: keys[i], label, direction: 'max' as const, weight: 1,
  }));
  const alternatives = lines.slice(1).map((line, i) => {
    const fields = splitCsvLine(line, delimiter);
    if (fields.length !== header.length) throw new Error('Строка ' + (i + 2) + ': неверное число столбцов');
    const name = fields[0];
    if (!name) throw new Error('Строка ' + (i + 2) + ': пустое название');
    const values: Record<string, number> = {};
    fields.slice(1).forEach((value, j) => {
      // For semicolon-separated files accept decimal commas.
      const parsed = Number(value.replace(',', '.'));
      if (!value || !Number.isFinite(parsed)) throw new Error('Строка ' + (i + 2) + ': некорректное число');
      values[keys[j]] = parsed;
    });
    return { name, values };
  });
  if (alternatives.length > 200) throw new Error('Не более 200 альтернатив');
  return { criteria, alternatives, pairwise: null };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[;"\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function exportCsv(data: Dataset): string {
  const head = ['name', ...data.criteria.map(c => c.label)];
  return [head, ...data.alternatives.map(a => [
    a.name, ...data.criteria.map(c => a.values[c.key]),
  ])].map(row => row.map(csvCell).join(';')).join('\r\n');
}

export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob(['\uFEFF', text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
