# รายรับ-รายจ่าย-กำไร: สิ่งที่ API / DB ต้องเพิ่ม (v1.6)

Front-end เรียก endpoint ใหม่ตามนี้ (สัญญาเดียวกับคอมเมนต์ใน `src/services/financeService.js` และ `transportService.js`)
สิทธิ์: `transport.read` ดู · `transport.create` บันทึก (manager / admin) — ไม่ต้องเพิ่มรหัสสิทธิ์ใหม่

## 1) ฐานข้อมูล (ปรับชื่อตารางให้ตรงกับ schema ของคุณ)

```sql
-- ยอดบิลโรงงานของแต่ละเที่ยว (ไม่บังคับ)
ALTER TABLE transports
  ADD COLUMN IF NOT EXISTS factory_price_per_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS factory_amount       numeric(14,2);

-- ค่าใช้จ่ายรายวันที่กรอกเอง (1 แถว / วัน)
CREATE TABLE IF NOT EXISTS daily_expenses (
  expense_date   date PRIMARY KEY,
  labor_cost     numeric(12,2) NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
  transport_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  other_cost     numeric(12,2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  note           text,
  updated_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
```

## 2) Endpoint

| Method | Path | หมายเหตุ |
|---|---|---|
| POST/PATCH | `/transports` | รับ + คืน `factoryPricePerKg`, `factoryAmount` (null ได้) |
| GET | `/transports` | `summary` เพิ่ม `factoryAmount` (ผลรวม) |
| GET | `/finance/daily?date=` | ดูรูปแบบใน financeService.js — `purchaseTotal` นับเฉพาะใบ **complete** (ใบที่ยกเลิก/ปฏิเสธไม่นับ) |
| PUT | `/finance/expenses/:date` | upsert `{ laborCost, transportCost, otherCost, note? }` แล้วคืนค่าเดียวกับ `/finance/daily` |
| GET | `/finance/report?from&to&groupBy` | series รายวัน/สัปดาห์/เดือน (ช่วงที่ไม่มีข้อมูลเป็น 0) |

วันที่ของ "ซื้อยาง" ใช้วันที่ยืนยันใบ (เวลาไทย) · วันที่ของ "รายรับ" ใช้วันที่ของเที่ยวขนส่ง (`transports.date`)
