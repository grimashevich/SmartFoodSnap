import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { MacroData } from '../types';

interface NutritionChartProps {
  macros: MacroData;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b']; // Blue (Protein), Green (Carbs), Amber (Fat)

const NutritionChart: React.FC<NutritionChartProps> = ({ macros }) => {
  const data = [
    { name: 'Белки', value: macros.protein },
    { name: 'Жиры', value: macros.fat },
    { name: 'Углеводы', value: macros.carbs },
  ];

  return (
    <div className="w-full bg-white rounded-xl shadow-sm p-4 flex flex-col items-center justify-center">
      <h3 className="text-gray-500 text-sm font-medium mb-4 uppercase tracking-wider">Баланс БЖУ</h3>
      <div className="w-full h-64 relative">
         <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={65}
            outerRadius={85}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `${value.toFixed(1)} г`} 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle" 
            iconSize={10}
            wrapperStyle={{ paddingTop: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <span className="block text-3xl font-bold text-gray-800 leading-none">{Math.round(macros.calories)}</span>
        <span className="text-xs text-gray-500 font-medium uppercase mt-1">ккал</span>
      </div>
      </div>
     
    </div>
  );
};

export default NutritionChart;