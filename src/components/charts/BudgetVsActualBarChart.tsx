import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartCard } from './ChartCard';

interface DataItem {
  name: string;
  budget: number;
  actual: number;
  [key: string]: any;
}

interface BudgetVsActualBarChartProps {
  title: string;
  data: DataItem[];
  description?: string;
  className?: string;
  formatValue?: (val: number) => string;
}

export function BudgetVsActualBarChart({
  title,
  data,
  description,
  className,
  formatValue = (val) => `${(val / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}백만`,
}: BudgetVsActualBarChartProps) {
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-lithium-200 rounded-xl shadow-popover">
          <p className="font-bold text-eco-black mb-3 pb-2 border-b border-lithium-100">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex justify-between items-center gap-6 mb-1.5 last:mb-0">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm font-medium text-lithium-600">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold text-eco-black tabular-nums">
                {entry.value.toLocaleString()}원
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ChartCard title={title} description={description} className={className} isEmpty={data.length === 0}>
      <div className="relative w-full h-[260px] min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
            barSize={32}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EC" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#718872', fontSize: 12, fontWeight: 500 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#718872', fontSize: 12 }}
              dx={-10}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F7F9F7' }} />
            <Legend 
              iconType="circle"
              wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 500 }}
            />
            <Bar dataKey="budget" name="예산" fill="#DDE5DE" radius={[4, 4, 0, 0]} />
            <Bar dataKey="actual" name="실적" fill="#00786F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
