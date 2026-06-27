import { useNavigate } from 'react-router-dom'
import { useRecommendations } from '../api/client.js'

const ICONS = {
  skill_gap: '💡',
  context_bloat: '⚡',
  efficient_swap: '🔄',
}

const LABELS = {
  skill_gap: 'Skill Gap',
  context_bloat: 'Context Bloat',
  efficient_swap: 'Efficient Swap',
}

export default function RecommendationPanel({ userId }) {
  const { data: recs, isLoading, isError } = useRecommendations(userId)
  const navigate = useNavigate()

  if (isLoading) return <p className="text-gray-400 text-sm">Loading recommendations…</p>
  if (isError) return <p className="text-red-400 text-sm">Failed to load recommendations.</p>
  if (!recs?.length) return <p className="text-gray-400 text-sm">No recommendations yet.</p>

  return (
    <div className="space-y-3">
      {recs.map((rec, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{ICONS[rec.type] ?? '💡'}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {LABELS[rec.type] ?? rec.type}
            </span>
          </div>
          <p className="text-sm text-gray-700">{rec.reason}</p>
          {(rec.potential_savings_tokens != null || rec.potential_savings_pct != null) && (
            <p className="text-xs text-green-600 font-medium">
              Est. savings:{' '}
              {rec.potential_savings_tokens != null && `${rec.potential_savings_tokens.toLocaleString()} tokens`}
              {rec.potential_savings_tokens != null && rec.potential_savings_pct != null && ' · '}
              {rec.potential_savings_pct != null && `${rec.potential_savings_pct}%`}
            </p>
          )}
          {rec.skill_id && (
            <button
              onClick={() => navigate(`/skills/${rec.skill_id}`)}
              className="self-start text-xs bg-indigo-600 text-white rounded-lg px-3 py-1 hover:bg-indigo-700 transition-colors"
            >
              Add to workspace
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
