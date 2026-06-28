import { useState, useMemo } from 'react'
import { useSkills } from '../api/client.js'
import SkillCard from '../components/SkillCard.jsx'

const PAGE_SIZE = 20

export default function SkillBrowser() {
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [sort, setSort] = useState('new')
  const [page, setPage] = useState(1)

  const { data: skills, isLoading, isFetching } = useSkills({ search: search || undefined, sort })

  const allTags = useMemo(() => {
    if (!skills) return []
    const set = new Set()
    skills.forEach((s) => (s.tags || []).forEach((t) => set.add(t)))
    return [...set].sort()
  }, [skills])

  const filtered = useMemo(() => {
    if (!skills) return []
    if (!selectedTags.length) return skills
    return skills.filter((s) =>
      selectedTags.every((t) => (s.tags || []).includes(t))
    )
  }, [skills, selectedTags])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSlice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleTag = (t) => {
    setPage(1)
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Skill Browser</h2>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search skills…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="new">Newest</option>
          <option value="rating">Top Rated</option>
          <option value="efficiency">Most Efficient</option>
          <option value="popular">Most Popular</option>
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                selectedTags.includes(t)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading…</p>
      ) : pageSlice.length === 0 ? (
        <p className="text-gray-400 text-sm">No skills found.</p>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
          {pageSlice.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center pt-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
