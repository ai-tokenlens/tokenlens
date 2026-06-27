import { useAnalyticsSummary } from '../api/client.js'
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
  const todaySummary = useAnalyticsSummary({ from: today, to: today })
  const weekSummary = useAnalyticsSummary({ from: weekAgo, to: today })

  const todayTokens = todaySummary.data?.totals?.total_tokens ?? 0
  const weekTokens = weekSummary.data?.totals?.total_tokens ?? 0
  const activeUsers = weekSummary.data?.by_user?.length ?? 0
  const toolsUsed = weekSummary.data?.by_tool?.length ?? 0

  const kpiLoading = todaySummary.isLoading || weekSummary.isLoading
  const kpiError = todaySummary.isError || weekSummary.isError

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

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
        <KpiCard
          label="Utenti attivi"
          value={kpiLoading ? '…' : activeUsers}
        />
        <KpiCard
          label="Tool in uso"
          value={kpiLoading ? '…' : toolsUsed}
        />
      </div>

      <TokenTrendChart />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopConsumersChart from={weekAgo} to={today} />
        <ToolBreakdownPie from={weekAgo} to={today} />
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
