import { Link, useParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useAnalyticsSummary, useUsers } from '../api/client.js'
import TokenTrendChart from '../components/charts/TokenTrendChart.jsx'
import RecommendationPanel from '../components/RecommendationPanel.jsx'
import { formatTokens } from '../utils/formatters.js'

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

const today = toDateStr(new Date())
const thirtyDaysAgo = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return toDateStr(d)
})()

const COLORS = [
  '#6366f1','#8b5cf6','#a78bfa','#818cf8','#60a5fa',
  '#34d399','#fbbf24','#f87171','#fb923c','#e879f9',
]

export default function UserDetail() {
  const { id } = useParams()

  const usersQuery = useUsers()
  const userInfo = usersQuery.data?.find((u) => u.id === id)

  const recent = useAnalyticsSummary({ userId: id, from: thirtyDaysAgo, to: today })
  const allTime = useAnalyticsSummary({ userId: id })

  const toolData = recent.data?.by_tool?.map((d) => ({
    name: d.key,
    total_tokens: d.total_tokens,
  })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900">{id}</h2>
        {userInfo && (
          <p className="text-sm text-gray-500 mt-1">
            Primo accesso: {new Date(userInfo.created_at).toLocaleDateString('it-IT')}
            {' · '}
            {userInfo.event_count} eventi totali
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h3 className="text-base font-semibold text-gray-700 mb-3">Consumi (ultimi 30 giorni)</h3>
            <TokenTrendChart userId={id} />
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-700 mb-3">Top tool usati</h3>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              {recent.isLoading && (
                <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
              )}
              {!recent.isLoading && toolData.length === 0 && (
                <p className="text-sm text-gray-400 py-8 text-center">Nessun dato.</p>
              )}
              {toolData.length > 0 && (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={toolData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatTokens(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(v) => [formatTokens(v), 'Tokens']} />
                    <Bar dataKey="total_tokens" radius={[0, 4, 4, 0]}>
                      {toolData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-700 mb-3">Riepilogo</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  label="Tokens (30gg)"
                  value={recent.isLoading ? '…' : formatTokens(recent.data?.totals?.total_tokens ?? 0)}
                />
                <KpiCard
                  label="Input (30gg)"
                  value={recent.isLoading ? '…' : formatTokens(recent.data?.totals?.input_tokens ?? 0)}
                />
                <KpiCard
                  label="Output (30gg)"
                  value={recent.isLoading ? '…' : formatTokens(recent.data?.totals?.output_tokens ?? 0)}
                />
                <KpiCard
                  label="Cache read (30gg)"
                  value={recent.isLoading ? '…' : formatTokens(recent.data?.totals?.cache_read_tokens ?? 0)}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  label="Tokens (all-time)"
                  value={allTime.isLoading ? '…' : formatTokens(allTime.data?.totals?.total_tokens ?? 0)}
                />
                <KpiCard
                  label="Input (all-time)"
                  value={allTime.isLoading ? '…' : formatTokens(allTime.data?.totals?.input_tokens ?? 0)}
                />
                <KpiCard
                  label="Output (all-time)"
                  value={allTime.isLoading ? '…' : formatTokens(allTime.data?.totals?.output_tokens ?? 0)}
                />
                <KpiCard
                  label="Cache read (all-time)"
                  value={allTime.isLoading ? '…' : formatTokens(allTime.data?.totals?.cache_read_tokens ?? 0)}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-3">
          <h3 className="text-lg font-semibold">Recommendations</h3>
          <RecommendationPanel userId={id} />
        </aside>
      </div>
    </div>
  )
}

function KpiCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}
