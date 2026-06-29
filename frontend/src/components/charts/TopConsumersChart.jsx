import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useTopConsumers, useToolBreakdown } from '../../api/client.js'
import { formatTokens } from '../../utils/formatters.js'

const COLORS = [
  '#6366f1','#8b5cf6','#a78bfa','#818cf8','#60a5fa',
  '#34d399','#fbbf24','#f87171','#fb923c','#e879f9',
]

export default function TopConsumersChart({ from, to, userId }) {
  const navigate = useNavigate()

  const consumersQuery = useTopConsumers({ limit: 10, from, to })
  const toolQuery = useToolBreakdown({ from, to, userId })

  const byTool = !!userId
  const query = byTool ? toolQuery : consumersQuery
  const { data, isLoading, isError } = query

  const chartData = byTool
    ? (data?.map((d) => ({ label: d.key, total_tokens: d.total_tokens })) ?? [])
    : (data?.map((d) => ({ label: d.user_id, total_tokens: d.total_tokens })) ?? [])

  function handleBarClick(entry) {
    if (!byTool && entry?.label) {
      navigate(`/users/${encodeURIComponent(entry.label)}`)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">
        {byTool ? 'Token per Tool' : 'Top Consumers (tokens)'}
      </h3>

      {isLoading && <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>}
      {isError && <p className="text-sm text-red-400 py-8 text-center">Failed to load data.</p>}
      {data && chartData.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">No data.</p>
      )}
      {data && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
            onClick={(e) => {
              if (e?.activePayload?.[0]) {
                handleBarClick(e.activePayload[0].payload)
              }
            }}
          >
            <XAxis
              type="number"
              tickFormatter={(v) => formatTokens(v)}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={{ fontSize: 11 }}
            />
            <Tooltip formatter={(v) => [formatTokens(v), 'Tokens']} />
            <Bar
              dataKey="total_tokens"
              radius={[0, 4, 4, 0]}
              cursor={byTool ? 'default' : 'pointer'}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {!byTool && (
        <p className="text-xs text-gray-400 mt-2">Clicca una barra per vedere il dettaglio utente.</p>
      )}
    </div>
  )
}
