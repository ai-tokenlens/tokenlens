import { useParams } from 'react-router-dom'
import { useSkills } from '../api/client.js'
import { formatTokens } from '../utils/formatters.js'

export default function SkillDetail() {
  const { id } = useParams()
  const { data: skills, isLoading } = useSkills()
  const skill = skills?.find((s) => String(s.id) === id)

  if (isLoading) return <p className="text-gray-500">Loading…</p>
  if (!skill) return <p className="text-red-500">Skill not found.</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">{skill.name}</h2>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <p className="text-gray-600">{skill.description}</p>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">Rating: <strong>{skill.rating}</strong></span>
          <span className="text-gray-500">Avg tokens: <strong>{formatTokens(skill.avg_tokens)}</strong></span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {skill.tags.map((t) => (
            <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
