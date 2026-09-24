import api from './client.js'

export const getDashboardStats = async (category) => {
  const response = await api.get('/api/v1/complaints/stats', { params: category ? { category } : {} })
  return response.data
}

export const getSuggestionStats = async () => {
  const response = await api.get('/api/v1/complaints/suggestion-stats')
  return response.data
}

export const getEscalatedComplaints = async (category) => {
  const response = await api.get('/api/v1/complaints/escalated', { params: category ? { category } : {} })
  return response.data
}

export const getAdminComplaintOverview = async (category) => {
  const response = await api.get('/api/v1/complaints/admin-overview', { params: category ? { category } : {} })
  return response.data
}

// Downloads straight to disk via a throwaway <a> — a plain <a href> can't
// carry the Authorization header these endpoints need, so the file has to
// come back as a blob through the authenticated axios client first.
async function downloadXlsx(url, category, fallbackFilename) {
  const response = await api.get(url, {
    params: category ? { category } : {},
    responseType: 'blob',
  })
  const disposition = response.headers['content-disposition']
  const match = disposition && disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : fallbackFilename

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(blobUrl)
}

export const exportComplaints = (category) =>
  downloadXlsx('/api/v1/complaints/export', category, 'uacms-complaints-export.xlsx')

export const exportAdminOverview = (category) =>
  downloadXlsx('/api/v1/complaints/admin-overview/export', category, 'uacms-admin-complaints-export.xlsx')