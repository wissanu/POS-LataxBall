import { http } from './http'

export const productService = {
  list: (params) => http.get('/products', { params }).then((r) => r.data),
  categories: () => http.get('/categories').then((r) => r.data),
}
