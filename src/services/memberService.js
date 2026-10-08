import { http } from './http'

// GET /members -> [{ id, no, name }]   (no = หมายเลขลูกค้าประจำ)
export const memberService = {
  list: () => http.get('/members').then((r) => r.data),
}
