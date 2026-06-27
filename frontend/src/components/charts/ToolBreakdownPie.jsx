import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useToolBreakdown } from '../../api/client.js'
import { formatTokens } from '../../utils/formatters.js'

const COLORS = [
  '#6366f1','#8b5cf6','#60a5fa','#34d399','#fbbf24',
  '#f87171','#fb923c','#e879f9','#a78bfa','#818cf8',
]

export default function ToolBreakdownPie({ from, to }) {
  const { data, isLoading, isError } = useToolBreakdown({ from, to })

  const chartData = data?.map((d) => ({ name: d.key, value: d.total_tokens })) ?? []

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Token Split by Tool</h3>

      {isLoading && <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>}
      {isError && <p className="text-sm text-red-400 py-8 text-center">Failed to load data.</p>}
      {data && chartData.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">No data.</p>
      )}
      {data && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [formatTokens(v), 'Tokens']} />
            <Legend
              formatter={(name) => (
                <span className="text-xs text-gray-600">{name}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
