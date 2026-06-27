import { useAnalyticsSummary } from '../api/client.js'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatTokens, formatUsd } from '../utils/formatters.js'

export default function Dashboard() {
  const { data, isLoading } = useAnalyticsSummary()

  if (isLoading) return <p className="text-gray-500">Loading…</p>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Tokens" value={formatTokens(data.total_tokens)} />
        <StatCard label="Total Cost" value={formatUsd(data.total_cost_usd)} />
        <StatCard label="Active Users" value={data.active_users} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Token Trend (7 days)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.trend}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatTokens(v)} />
            <Line type="monotone" dataKey="tokens" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}
