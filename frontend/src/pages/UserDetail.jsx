import { useParams } from 'react-router-dom'
import { useRecommendations } from '../api/client.js'

export default function UserDetail() {
  const { id } = useParams()
  const { data: recs, isLoading } = useRecommendations(id)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">User Detail — {id}</h2>

      <section>
        <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
        {isLoading ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {recs?.map((r) => (
              <li key={r.skill_id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <span className="font-medium">{r.name}</span>
                <span className="text-gray-500 text-sm ml-3">{r.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
