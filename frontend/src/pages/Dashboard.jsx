import { useState } from 'react'
import { useAnalyticsSummary, useUsers } from '../api/client.js'
import TokenTrendChart from '../components/charts/TokenTrendChart.jsx'
import TopConsumersChart from '../components/charts/TopConsumersChart.jsx'
import ToolBreakdownPie from '../components/charts/ToolBreakdownPie.jsx'
import { formatTokens } from '../utils/formatters.js'

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

const today = toDateStr(new Date())
const weekAgo = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return toDateStr(d)
})()

export default function Dashboard() {
  const [selectedUser, setSelectedUser] = useState('')
  const usersQuery = useUsers()

  const userId = selectedUser || undefined

  const todaySummary = useAnalyticsSummary({ from: today, to: today, userId })
  const weekSummary = useAnalyticsSummary({ from: weekAgo, to: today, userId })

  const todayTokens = todaySummary.data?.totals?.total_tokens ?? 0
  const weekTokens = weekSummary.data?.totals?.total_tokens ?? 0
  const activeUsers = weekSummary.data?.by_user?.length ?? 0
  const toolsUsed = weekSummary.data?.by_tool?.length ?? 0

  const kpiLoading = todaySummary.isLoading || weekSummary.isLoading
  const kpiError = todaySummary.isError || weekSummary.isError

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="user-filter" className="text-sm text-gray-500">
            Utente
          </label>
          <select
            id="user-filter"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tutti gli utenti</option>
            {usersQuery.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {kpiError && (
        <p className="text-sm text-red-500">Failed to load summary data.</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Tokens oggi"
          value={kpiLoading ? '…' : formatTokens(todayTokens)}
        />
        <KpiCard
          label="Tokens (7 giorni)"
          value={kpiLoading ? '…' : formatTokens(weekTokens)}
        />
        {!userId && (
          <KpiCard
            label="Utenti attivi"
            value={kpiLoading ? '…' : activeUsers}
          />
        )}
        <KpiCard
          label="Tool in uso"
          value={kpiLoading ? '…' : toolsUsed}
        />
      </div>

      <TokenTrendChart userId={userId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopConsumersChart from={weekAgo} to={today} userId={userId} />
        <ToolBreakdownPie from={weekAgo} to={today} userId={userId} />
      </div>
    </div>
  )
}

function KpiCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}
