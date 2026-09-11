'use client';

import React from 'react';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from 'recharts';

interface BudgetRadialChartProps {
  spent: number;
  limit: number;
}

export default function BudgetRadialChart({ spent, limit }: BudgetRadialChartProps) {
  const pct = Math.round((spent / limit) * 100);
  const color = pct >= 80 ? 'var(--warning)' : 'var(--primary)';

  const data = [{ name: 'budget', value: pct, fill: color }];

  return (
    <div className="relative w-28 h-28">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          data={data}
          barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={6}
            background={{ fill: 'var(--secondary)' }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums" style={{ color }}>
          {pct}%
        </span>
        <span className="text-xs text-muted-foreground">used</span>
      </div>
    </div>
  );
}