import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ChartCard } from './ChartCard';
import { cn } from '../../lib/utils';

interface DonutMetricChartProps {
  title: string;
  value: number;
  total: number;
  centerLabel?: string;
  centerSubLabel?: string;
  valueLabel?: string;
  remainderLabel?: string;
  description?: string;
  className?: string;
  getColor?: (percentage: number) => string;
}

export function DonutMetricChart({
  title,
  value,
  total,
  centerLabel,
  centerSubLabel,
  valueLabel = "완료",
  remainderLabel = "잔여",
  description,
  className,
  getColor,
}: DonutMetricChartProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  
  const defaultGetColor = (p: number) => p >= 100 ? '#00786F' /* nickel-600 */ : '#008F83'; /* nickel-500 */
  const color = getColor ? getColor(percentage) : defaultGetColor(percentage);
  
  const data = [
    { name: valueLabel, value: Math.max(0, value), color: color },
    { name: remainderLabel, value: Math.max(0, total - value), color: '#EEF2EC' } /* lithium-100 */
  ];

  const isEmpty = total === 0 && value === 0;

  return (
    <ChartCard title={title} description={description} className={className} isEmpty={isEmpty}>
      <div className="relative w-full h-[260px] min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="85%"
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()}`, '']}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
              itemStyle={{ color: '#111111', fontWeight: 600, fontSize: '14px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl sm:text-4xl font-black text-eco-black tabular-nums tracking-tighter">
            {centerLabel || `${Math.round(percentage)}%`}
          </span>
          {centerSubLabel && (
            <span className="text-sm font-medium text-lithium-500 mt-1">
              {centerSubLabel}
            </span>
          )}
        </div>
      </div>
    </ChartCard>
  );
}
