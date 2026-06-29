import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
})

// --- Analytics hooks ---

export function useAnalyticsSummary({ from, to, userId } = {}) {
  return useQuery({
    queryKey: ['analytics', 'summary', from, to, userId],
    queryFn: async () => {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      if (userId) params.user_id = userId
      const { data } = await api.get('/analytics/summary', { params })
      return data
    },
  })
}

export function useByDay({ from, to, userId } = {}) {
  return useQuery({
    queryKey: ['analytics', 'by-day', from, to, userId],
    queryFn: async () => {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      if (userId) params.user_id = userId
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
export function useToolBreakdown({ from, to, userId } = {}) {
  return useQuery({
    queryKey: ['analytics', 'tool-breakdown', from, to, userId],
    queryFn: async () => {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      if (userId) params.user_id = userId
      const { data } = await api.get('/analytics/summary', { params })
      return data.by_tool
    },
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users')
      return data
    },
  })
}

// --- Skills ---

export function useSkills({ tag, search, sort } = {}) {
  return useQuery({
    queryKey: ['skills', tag, search, sort],
    queryFn: async () => {
      const params = {}
      if (tag) params.tag = tag
      if (search) params.search = search
      if (sort) params.sort = sort
      const { data } = await api.get('/skills', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })
}

export function useSkill(id) {
  return useQuery({
    queryKey: ['skills', id],
    queryFn: async () => {
      const { data } = await api.get(`/skills/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useSkillVersions(id) {
  return useQuery({
    queryKey: ['skills', id, 'versions'],
    queryFn: async () => {
      const { data } = await api.get(`/skills/${id}/versions`)
      return data
    },
    enabled: !!id,
  })
}

export function useSkillRatings(id) {
  return useQuery({
    queryKey: ['skills', id, 'ratings'],
    queryFn: async () => {
      const { data } = await api.get(`/skills/${id}/ratings`)
      return data
    },
    enabled: !!id,
  })
}

export function usePostRating(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ stars, comment }) => {
      const token = localStorage.getItem('token')
      const { data } = await api.post(
        `/skills/${id}/ratings`,
        { stars, comment },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', id, 'ratings'] })
      queryClient.invalidateQueries({ queryKey: ['skills', id] })
    },
  })
}

export function useDownloadSkill(id, target) {
  return useMutation({
    mutationFn: async () => {
      const resp = await api.get(`/skills/${id}/download`, {
        params: { target },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(resp.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${id}-${target}.tar.gz`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
  })
}

export function useCreateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (skillData) => {
      const token = localStorage.getItem('token')
      const { data } = await api.post('/skills', skillData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}

export function useRecommendations(userId) {
  return useQuery({
    queryKey: ['recommendations', userId],
    queryFn: async () => {
      const { data } = await api.get(`/recommendations/${userId}`)
      return data
    },
    enabled: !!userId,
  })
}
