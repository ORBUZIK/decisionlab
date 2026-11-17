import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Ranked } from './types';

type Props = { data: Ranked[]; metric: 'score' | 'flow'; selected: string; onSelect: (value: string) => void };
export default function Chart({ data, metric, selected, onSelect }: Props) {
  const container = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = d3.select(container.current);
    svg.selectAll('*').remove();
    if (!data.length) return;
    const width = 820;
    const height = Math.max(260, data.length * 49 + 60);
    const margin = { top: 12, right: 76, bottom: 22, left: 146 };
    svg.attr('viewBox', '0 0 ' + width + ' ' + height);
    const values = data.map(d => Number(d[metric] ?? 0));
    const min = Math.min(0, ...values);
    const max = Math.max(.001, ...values);
    const x = d3.scaleLinear().domain([min, max]).nice()
      .range([margin.left, width - margin.right]);
    const y = d3.scaleBand<string>().domain(data.map(d => d.name))
      .range([margin.top, height - margin.bottom]).padding(.28);
    const plot = svg.append('g');
    plot.selectAll('line.grid').data(x.ticks(5)).enter()
      .append('line').attr('class', 'chart-grid')
      .attr('x1', d => x(d)).attr('x2', d => x(d))
      .attr('y1', margin.top).attr('y2', height - margin.bottom);
    plot.selectAll('text.label').data(data).enter().append('text')
      .attr('class', 'chart-label').attr('x', margin.left - 16)
      .attr('y', d => (y(d.name) ?? 0) + y.bandwidth() / 2 + 5)
      .attr('text-anchor', 'end').text(d => d.name.length > 18 ? d.name.slice(0, 17) + '…' : d.name);
    plot.selectAll('rect.bar').data(data).enter().append('rect')
      .attr('class', d => 'chart-bar ' + (d.name === selected ? 'chart-bar-selected' : ''))
      .attr('rx', 6)
      .attr('x', d => x(Math.min(0, Number(d[metric] ?? 0))))
      .attr('y', d => y(d.name) ?? 0)
      .attr('width', d => Math.max(2, Math.abs(x(Number(d[metric] ?? 0)) - x(0))))
      .attr('height', y.bandwidth()).on('click', (_event, d) => onSelect(d.name))
      .append('title').text(d => d.name + ': ' + Number(d[metric] ?? 0).toFixed(3));
    plot.selectAll('text.value').data(data).enter().append('text')
      .attr('class', 'chart-value')
      .attr('x', d => x(Number(d[metric] ?? 0)) + (Number(d[metric] ?? 0) < 0 ? -8 : 8))
      .attr('text-anchor', d => Number(d[metric] ?? 0) < 0 ? 'end' : 'start')
      .attr('y', d => (y(d.name) ?? 0) + y.bandwidth() / 2 + 5)
      .text(d => Number(d[metric] ?? 0).toFixed(metric === 'flow' ? 0 : 3));
  }, [data, metric, selected, onSelect]);
  return <svg className="ranking-chart" ref={container} role="img" aria-label="Рейтинг альтернатив" />;
}
