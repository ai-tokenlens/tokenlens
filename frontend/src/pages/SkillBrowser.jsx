import { Link } from 'react-router-dom'
import { useSkills } from '../api/client.js'
import { formatTokens } from '../utils/formatters.js'

export default function SkillBrowser() {
  const { data: skills, isLoading } = useSkills()

  if (isLoading) return <p className="text-gray-500">Loading…</p>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Skill Browser</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills?.map((skill) => (
          <Link
            key={skill.id}
            to={`/skills/${skill.id}`}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-400 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-gray-900">{skill.name}</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                ★ {skill.rating}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-3">{skill.description}</p>
            <div className="flex gap-2 flex-wrap">
              {skill.tags.map((t) => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {t}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">avg {formatTokens(skill.avg_tokens)} tokens</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
