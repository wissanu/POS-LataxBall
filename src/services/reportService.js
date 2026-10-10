import { http } from './http'

// GET /reports/overview?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month&customer=<key>
//  -> {
//       range:      { from, to, groupBy, days },
//       summary:    { total, netKg, billCount, previous: { total, netKg, billCount } },   // previous = same-length period before `from`
//       series:     [{ key, from, total, netKg, bills }],       // one point per day/week/month (empty buckets included)
//       byCustomer: [{ key, name, total, netKg, bills }],       // NOT narrowed by `customer`
//       byProduct:  [{ key, name, total, netKg }],              // narrowed by `customer`
//     }
export const reportService = {
  overview: (params) => http.get('/reports/overview', { params }).then((r) => r.data),
}
