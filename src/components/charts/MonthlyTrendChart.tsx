import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartCard } from './ChartCard';

interface MonthlyTrendChartProps {
  title: string;
  data: any[];
  description?: string;
  className?: string;
  formatValue?: (val: number) => string;
}

export function MonthlyTrendChart({
  title,
  data,
  description,
  className,
  formatValue = (val) => `${(val / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}백만`,
}: MonthlyTrendChartProps) {
  return (
    <ChartCard title={title} description={description} className={className} isEmpty={data.length === 0}>
      <div className="relative w-full h-[260px] min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EC" />
          <XAxis 
            dataKey="month" 
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
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: '1px solid #DDE5DE', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            itemStyle={{ fontWeight: 600, fontSize: '14px' }}
          />
          <Legend 
            iconType="circle"
            wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 500 }}
          />
          <Line type="monotone" dataKey="budget" name="예산" stroke="#DDE5DE" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="actual" name="실적" stroke="#00786F" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
