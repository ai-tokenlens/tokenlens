import { useParams, useSearchParams } from 'react-router-dom'
import {
  useSkill,
  useSkillRatings,
  useSkillVersions,
  usePostRating,
  useDownloadSkill,
} from '../api/client.js'
import RatingStars from '../components/RatingStars.jsx'
import CommentList from '../components/CommentList.jsx'
import { formatTokens } from '../utils/formatters.js'

function TokenBadge({ avg_tokens }) {
  const color =
    avg_tokens < 1000
      ? 'bg-green-100 text-green-700'
      : avg_tokens < 3000
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${color}`}>
      {formatTokens(avg_tokens)} tokens avg
    </span>
  )
}

export default function SkillDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()

  const { data: skill, isLoading } = useSkill(id)
  const { data: ratings } = useSkillRatings(id)
  const { data: versions } = useSkillVersions(id)
  const postRating = usePostRating(id)

  const target =
    searchParams.get('target') ||
    localStorage.getItem('target') ||
    'claude-code'
  const download = useDownloadSkill(id, target)

  const isLoggedIn = !!localStorage.getItem('token')

  if (isLoading) return <p className="text-gray-500">Loading…</p>
  if (!skill) return <p className="text-red-500">Skill not found.</p>

  const roundedRating = Math.round(skill.rating_avg)

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{skill.name}</h2>
            <p className="text-gray-500 mt-1">{skill.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => download.mutate()}
            disabled={download.isPending}
            className="shrink-0 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {download.isPending ? 'Downloading…' : `Add to workspace (${target})`}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <TokenBadge avg_tokens={skill.avg_tokens} />
          <span className="text-amber-400">
            {'★'.repeat(roundedRating)}{'☆'.repeat(5 - roundedRating)}
          </span>
          <span className="text-gray-400">{skill.rating_avg.toFixed(1)} ({skill.rating_count})</span>
          <span className="text-gray-400">{skill.use_count} uses</span>
          {skill.author && <span className="text-gray-400">by {skill.author}</span>}
          <span className="text-gray-400 font-mono">v{skill.latest_version}</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(skill.tags || []).map((t) => (
            <span key={t} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      </div>

      {skill.description && (
        <section>
          <h3 className="font-semibold text-gray-800 mb-2">Description</h3>
          <p className="text-gray-600 text-sm whitespace-pre-wrap">{skill.description}</p>
        </section>
      )}

      {skill.usage && (
        <section>
          <h3 className="font-semibold text-gray-800 mb-2">Usage Instructions</h3>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-4 border border-gray-100 overflow-x-auto">
            {skill.usage}
          </pre>
        </section>
      )}

      {versions?.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-800 mb-2">Versions</h3>
          <ul className="space-y-1">
            {versions.map((v) => (
              <li key={v.id} className="flex gap-4 text-sm text-gray-600">
                <span className="font-mono text-indigo-700">{v.version}</span>
                <span className="text-gray-400">
                  {new Date(v.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Rate this skill</h3>
        <RatingStars
          disabled={!isLoggedIn}
          onSubmit={(data) => postRating.mutateAsync(data)}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-800 mb-3">
          Reviews ({ratings?.length ?? 0})
        </h3>
        <CommentList ratings={ratings} />
      </section>
    </div>
  )
}
