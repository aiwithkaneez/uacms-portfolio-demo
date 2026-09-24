const CATEGORY_LABEL = {
  general: 'General',
  grievance: 'Grievance',
  harassment: 'Harassment',
  whistleblow: 'Whistleblow',
}

const STATUS_LABEL = {
  new: 'New',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export function formatCategory(category) {
  return CATEGORY_LABEL[category] || category
}

export function formatStatus(status) {
  return STATUS_LABEL[status] || status
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-CA')
}
