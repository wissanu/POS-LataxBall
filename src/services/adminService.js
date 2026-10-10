import { http } from './http'

// GET    /admin/permissions                  -> [{ code, module, name }]
// GET    /admin/roles                        -> [{ code, name, level, isStaff, description, permissions: [code] }]
// PUT    /admin/roles/:code/permissions      { permissions: [code] }               -> role
// GET    /admin/users                        -> [{ id, username, name, role, active, customerId, overrides, permissions, lastLoginAt }]
// POST   /admin/users                        { username, name, password, role, customerId?, active }
// PATCH  /admin/users/:id                    { name, password?, role, customerId?, active }
// DELETE /admin/users/:id
// PUT    /admin/users/:id/permissions        { overrides: { [code]: 'GRANT' | 'DENY' } }  (differences from the role defaults)
export const adminService = {
  permissions: () => http.get('/admin/permissions').then((r) => r.data),
  roles: () => http.get('/admin/roles').then((r) => r.data),
  saveRolePermissions: (code, permissions) => http.put(`/admin/roles/${code}/permissions`, { permissions }).then((r) => r.data),
  users: () => http.get('/admin/users').then((r) => r.data),
  createUser: (body) => http.post('/admin/users', body).then((r) => r.data),
  updateUser: (id, body) => http.patch(`/admin/users/${id}`, body).then((r) => r.data),
  deleteUser: (id) => http.delete(`/admin/users/${id}`).then((r) => r.data),
  saveUserOverrides: (id, overrides) => http.put(`/admin/users/${id}/permissions`, { overrides }).then((r) => r.data),
}
