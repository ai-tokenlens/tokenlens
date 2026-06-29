import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useByDay } from '../../api/client.js'
import { formatTokens } from '../../utils/formatters.js'

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

function rangeFor(days) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { from: toDateStr(from), to: toDateStr(to) }
}

export default function TokenTrendChart({ userId } = {}) {
  const [days, setDays] = useState(7)
  const { from, to } = rangeFor(days)
  const { data, isLoading, isError } = useByDay({ from, to, userId })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">Token Trend</h3>
        <div className="flex gap-1">
          {[7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded-md ${
                days === d
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>}
      {isError && <p className="text-sm text-red-400 py-8 text-center">Failed to load data.</p>}
      {data && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => formatTokens(v)}
              tick={{ fontSize: 11 }}
              width={56}
            />
            <Tooltip formatter={(v) => [formatTokens(v), 'Total tokens']} />
            <Line
              type="monotone"
              dataKey="total_tokens"
              name="Total tokens"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
