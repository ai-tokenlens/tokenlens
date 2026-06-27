import { useParams } from 'react-router-dom'
import RecommendationPanel from '../components/RecommendationPanel.jsx'

export default function UserDetail() {
  const { id } = useParams()

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">User Detail — {id}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* TODO(spec): usage history table/charts per user */}
          <p className="text-gray-400 text-sm">Usage history coming soon.</p>
        </div>

        <aside className="space-y-3">
          <h3 className="text-lg font-semibold">Recommendations</h3>
          <RecommendationPanel userId={id} />
        </aside>
      </div>
    </div>
  )
}
