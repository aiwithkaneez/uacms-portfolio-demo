import api from './client.js'

export const getPolicyChunks = async () => {
  const response = await api.get('/api/v1/knowledge-base/policies')
  return response.data
}

export const createPolicyChunk = async (payload) => {
  const response = await api.post('/api/v1/knowledge-base/policies', payload)
  return response.data
}

export const updatePolicyChunk = async (id, payload) => {
  const response = await api.patch(`/api/v1/knowledge-base/policies/${id}`, payload)
  return response.data
}
