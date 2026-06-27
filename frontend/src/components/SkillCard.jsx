import { Link } from 'react-router-dom'
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
      {formatTokens(avg_tokens)} tok
    </span>
  )
}

export default function SkillCard({ skill }) {
  const roundedRating = Math.round(skill.rating_avg)
  return (
    <Link
      to={`/skills/${skill.id}`}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-400 transition-colors flex flex-col gap-2"
    >
      <div className="flex justify-between items-start">
        <span className="font-semibold text-gray-900 leading-tight">{skill.name}</span>
        <span className="text-amber-400 text-sm whitespace-nowrap ml-2">
          {'★'.repeat(roundedRating)}{'☆'.repeat(5 - roundedRating)}{' '}
          <span className="text-gray-500 text-xs">{skill.rating_avg.toFixed(1)}</span>
        </span>
      </div>
      <p className="text-sm text-gray-500 line-clamp-2">{skill.summary}</p>
      <div className="flex gap-2 flex-wrap">
        {(skill.tags || []).map((t) => (
          <span key={t} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
            {t}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <TokenBadge avg_tokens={skill.avg_tokens} />
        <span className="text-xs text-gray-400">{skill.use_count} uses</span>
      </div>
    </Link>
  )
}
