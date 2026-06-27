function Stars({ n }) {
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

export default function CommentList({ ratings }) {
  if (!ratings?.length) return <p className="text-sm text-gray-400">No reviews yet.</p>

  return (
    <ul className="space-y-3">
      {ratings.map((r) => (
        <li key={r.id} className="border border-gray-100 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">{r.user_id}</span>
            <div className="flex items-center gap-2">
              <Stars n={r.stars} />
              <span className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
        </li>
      ))}
    </ul>
  )
}
