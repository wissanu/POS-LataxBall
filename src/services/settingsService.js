import { http } from './http'

// GET /settings/containers -> { version, updatedAt?, containers: [{ id, label, short, icon, scale?, tare, fixed? }] }
// PUT /settings/containers  { containers: [{ id, tare }] }  -> same document
//   edit-only: the server must reject unknown ids (no create / delete) and any change to a `fixed` item
export const settingsService = {
  getContainers: () => http.get('/settings/containers').then((r) => r.data),
  updateContainers: (containers) => http.put('/settings/containers', { containers }).then((r) => r.data),
}
