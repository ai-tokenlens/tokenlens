import axios from 'axios'
import { useQuery } from '@tanstack/react-query'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
})

// --- Analytics hooks ---

export function useAnalyticsSummary({ from, to } = {}) {
  return useQuery({
    queryKey: ['analytics', 'summary', from, to],
    queryFn: async () => {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/analytics/summary', { params })
      return data
    },
  })
}

export function useByDay({ from, to } = {}) {
  return useQuery({
    queryKey: ['analytics', 'by-day', from, to],
    queryFn: async () => {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/analytics/by-day', { params })
      return data.days
    },
  })
}

export function useTopConsumers({ limit = 10, from, to } = {}) {
  return useQuery({
    queryKey: ['analytics', 'top-consumers', limit, from, to],
    queryFn: async () => {
      const params = { limit }
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/analytics/top-consumers', { params })
      return data.consumers
    },
  })
}

// Reuses /analytics/summary – by_tool gives tool→total_tokens breakdown
export function useToolBreakdown({ from, to } = {}) {
  return useQuery({
    queryKey: ['analytics', 'tool-breakdown', from, to],
    queryFn: async () => {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/analytics/summary', { params })
      return data.by_tool
    },
  })
}

// --- Skills / Recommendations (used by other pages) ---

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const { data } = await api.get('/skills')
      return data
    },
  })
}

export function useRecommendations(userId) {
  return useQuery({
    queryKey: ['recommendations', userId],
    queryFn: async () => {
      const { data } = await api.get(`/recommendations?user_id=${userId}`)
      return data
    },
    enabled: !!userId,
  })
}
