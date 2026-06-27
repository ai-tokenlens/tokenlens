import axios from 'axios'
import { useQuery } from '@tanstack/react-query'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
})

// --- Mock data ---

const MOCK_SUMMARY = {
  total_tokens: 4_820_300,
  total_cost_usd: 14.46,
  active_users: 12,
  top_tool: 'claude-sonnet-4-6',
  trend: [
    { date: '2026-06-21', tokens: 620000 },
    { date: '2026-06-22', tokens: 710000 },
    { date: '2026-06-23', tokens: 540000 },
    { date: '2026-06-24', tokens: 830000 },
    { date: '2026-06-25', tokens: 770000 },
    { date: '2026-06-26', tokens: 900000 },
    { date: '2026-06-27', tokens: 450000 },
  ],
}

const MOCK_SKILLS = [
  { id: 1, name: 'code-review', description: 'Review PRs for bugs', tags: ['dev'], avg_tokens: 3200, rating: 4.5 },
  { id: 2, name: 'summarise-doc', description: 'Summarise long docs', tags: ['writing'], avg_tokens: 1800, rating: 4.0 },
  { id: 3, name: 'sql-gen', description: 'Generate SQL queries', tags: ['dev', 'data'], avg_tokens: 900, rating: 3.8 },
]

const MOCK_RECOMMENDATIONS = [
  { skill_id: 2, reason: 'Saves ~1 200 tokens vs your current approach', name: 'summarise-doc' },
  { skill_id: 3, reason: 'Matches your frequent data queries', name: 'sql-gen' },
]

// --- Hooks ---

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => Promise.resolve(MOCK_SUMMARY),
  })
}

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => Promise.resolve(MOCK_SKILLS),
  })
}

export function useRecommendations(userId) {
  return useQuery({
    queryKey: ['recommendations', userId],
    queryFn: () => Promise.resolve(MOCK_RECOMMENDATIONS),
    enabled: !!userId,
  })
}
