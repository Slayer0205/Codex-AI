# API kontrakti

Baza path `/api`. JSON so‘rov/javoblar. Money maydonlari integer tiyin. Auth — web uchun HttpOnly cookie, Mini App uchun xotirada saqlanadigan Authorization: Bearer JWT; frontend adapter `credentials: include` ishlatadi. Mutatsiyalar uchun yangi `Idempotency-Key` (UUID) bering va aynan shu operatsiyani qayta yuborganda **o‘sha kalitni** saqlang.

| Metod      | Path                  | Maqsad                                                |
| ---------- | --------------------- | ----------------------------------------------------- |
| GET        | /health               | Database va demo/production holati                    |
| POST       | /auth/demo            | Faqat demo sessiya                                    |
| POST       | /auth/login           | email, password, ixtiyoriy organizationId             |
| POST       | /auth/telegram        | imzolangan initData                                   |
| POST       | /auth/logout          | Cookie’ni yopish                                      |
| GET        | /session              | name, email, role, demo                               |
| GET        | /snapshot             | Shu organization biznes yozuvlari                     |
| POST/PATCH | /customers[/:id]      | Mijoz qo‘shish/tahrirlash                             |
| POST/PATCH | /products[/:id]       | Mahsulot qo‘shish/tahrirlash                          |
| POST       | /products/import      | {products:[...]} atomik CSV import                    |
| POST       | /products/:id/stock   | {quantity: signed integer, reason}                    |
| POST/PATCH | /debts[/:id]          | Mustaqil qarz qo‘shish/tahrirlash                     |
| POST       | /debts/:id/repayments | {amount: tiyin, method: cash/card}                    |
| POST       | /debts/:id/remind     | Qo‘lda Telegram eslatmasi                             |
| POST       | /sales                | items, customerId?, discount, method, paid?, dueDate? |
| POST       | /sales/:id/reverse    | Compensating qaytarish                                |
| POST       | /expenses             | name, category, amount, date?                         |
| PUT        | /settings             | To‘liq settings kontrakti                             |
| POST       | /notifications/read   | Barcha xabarlar o‘qilgan                              |
| GET/PATCH  | /memberships[/:id]    | Admin ro‘yxati/rol o‘zgartirish                       |
| PUT        | /profile/telegram     | telegramId + productionda imzolangan initData         |
| GET        | /backup               | Admin biznes JSON eksporti, secrets yo‘q              |

`/auth/login` ixtiyoriy `miniApp:true` bo‘lsa accessToken qaytaradi; oddiy web login bu maydonni qaytarmaydi. `/auth/telegram` imzolangan initData tekshiruvdan keyin accessToken beradi.

## Misollar

```json
{
  "customerId": "customer-uuid",
  "items": [{ "productId": "product-uuid", "quantity": 2 }],
  "discount": 50000,
  "method": "mixed",
  "paid": 1000000,
  "dueDate": "2026-11-01"
}
```

`method`: cash/card/debt/mixed. Debt usulida 0 paid; cash/card’da butun total paid; mixed’da paid majburiy va total’dan oshmaydi. Qoldiq >0 bo‘lsa customerId majburiy.

```json
{
  "customerId": "uuid",
  "amount": 12500000,
  "date": "2026-10-09",
  "dueDate": "2026-10-23",
  "notes": "Mahsulot xaridi"
}
```

Natija 125 000 so‘mlik qarz. Qarzni to‘lash:

```json
{ "amount": 5000000, "method": "cash" }
```

## Xatolar

`{ "error": "tushunarli xabar" }`: 400 biznes qoidasi, 401 sessiya/auth, 403 rol/origin, 404 begona yoki yo‘q yozuv, 409 SKU/idempotency/reversal konflikt, 415 JSON talab, 422 Zod validatsiya, 429 rate limit, 500 ichki xato. Begona organization yozuvlari 404 bilan berkitiladi.

Read snapshot transaction bilan olinadi, shuning uchun bir savdo davomida qisman yangilangan stock/debt ko‘rsatilmaydi. POST operatsiyasi moliyaviy tashqi API chaqirmaydi. Telegram jo‘natish statuslari demo/queued/sending/sent/failed/unconfigured/disabled: faqat **sent** haqiqiy API qabul qilganini bildiradi, foydalanuvchi o‘qiganini emas.
