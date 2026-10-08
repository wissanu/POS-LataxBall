import { http } from './http'

export const productService = {
  list: (params) => http.get('/products', { params }).then((r) => r.data),
  categories: () => http.get('/categories').then((r) => r.data),
  /** { name, price }  price = บาทต่อกิโลกรัม  ->  { id, name, price } */
  create: (payload) => http.post('/products', payload).then((r) => r.data),
}
