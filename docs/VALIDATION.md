# Tekshiruv natijalari

2026-10-09, Node.js 24, Linux, Chromium. Tekshiruvlar shu cloud workspace’da bajarildi. CI workflow yozilgan, ammo GitHub’da CI bajarilgan deb da’vo qilinmaydi.

| Tekshiruv                              | Natija                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| TypeScript strict typecheck            | O‘tdi                                                    |
| ESLint, React hooks                    | O‘tdi                                                    |
| Vite production build                  | O‘tdi                                                    |
| SQLite Vitest biznes/API/xavfsizlik    | 19 / 19 o‘tdi                                            |
| PostgreSQL 17 Vitest — xuddi shu suite | 19 / 19 o‘tdi                                            |
| Playwright Chromium                    | 4 / 4 o‘tdi                                              |
| `npm audit --omit=dev`                 | 0 vulnerabilities                                        |
| Tokenisiz Telegram bot mock            | Menyu va seed xulosasi o‘tdi, haqiqiy xabar yuborilmadi  |
| Docker multi-stage image               | Yig‘ildi, TLS/checksum tekshiruvi o‘chirilmagan          |
| Docker API + static UI                 | Demo login, ma’lumotlar, yozish va brauzer renderi o‘tdi |
| Docker restart                         | Kiritilgan yozuv SQLite’da saqlandi                      |

## Biznes va xavfsizlik suite

Mijoz/mahsulot persistence, stock movement, qarzga savdo, qisman/to‘liq to‘lov va Paid status, aralash to‘lov, rollback, ortiqcha to‘lov va yetarli stock yo‘qligi, bir xil/concurrent idempotency, parallel overpayment, savdo reversal/refund, organization izolyatsiyasi, role authorization, qarzni tahrirlash, manfiy stock, atomik import, money/date validation, qayta migratsiya, password scrypt, Telegram initData imzo/yosh/duplicate tekshiruvi, auth cookie/origin, queue at-most-once va preference, cost overflow, Mini App bearer transport.

PostgreSQL tekshiruvi alohida `savdo_test` bazasida bajarildi; har test orasida schema tozalangan. Asosiy demo bazasi bu suite’dan alohida.

## Brauzer ssenariylari

1. Mijoz qo‘shish → mahsulot qo‘shish (10 dona) → 2 dona qarzga savdo → ombor 8 dona → 7 000 so‘m qisman to‘lov → 13 000 so‘m qoldiq → to‘liq to‘lov → Yopilgan → reload persistence → hisobot/CSV. Browser pageerror: 0.
2. Dark/light, reload’da tema saqlanishi, global qidiruv, Escape bilan modalni yopish, 390 px mobil dashboard.
3. Inventarizatsiya +5, CSV import, savdoni qaytarish, XLSX download, sozlamalar persistence.
4. Mock Telegram SDK: ready/expand, dark theme, Back/Main Button. Barcha 7 bo‘lim 320/390/768 px ekranlarda horizontal overflow bermaydi.

Haqiqiy Telegram login/xabar/Webhook, tashqi printer va public HTTPS deployment token/servis bo‘lmagani uchun bajarilmagan. PDF uchun brauzer Print → Save as PDF ishlatiladi; printerga fizik chop etish tekshirilmagan.

## Docker uchun cloud tarmoq izohi

Bu muhitda BuildKit oddiy DNS orqali `proxy` hostname’ni topa olmadi. Platformaning mavjud HTTP(S) proksisi, uning DNS manzili va platforma CA sertifikati optional BuildKit secret sifatida berildi. CA faqat build vaqtida o‘qiladi va image ichiga saqlanmaydi. TLS yoki paket checksum tekshiruvi chetlab o‘tilmagan. Oddiy mahalliy muhitda `docker compose up --build` bunday maxsus argumentlarni talab qilmaydi.

## Tasvirlar

`dashboard.png`, `dashboard-dark.png`, `mobile.png` — ishlayotgan ilovadan Chromium orqali olingan tasvirlar. Ular statik mahsulot o‘rnini bosmaydi: frontend API va saqlanadigan backend bilan ishlaydi.

## Production chegaralari

2026-10-09: Render Free + Neon konfiguratsiyasi qo‘shildi. `npm test` 23 testni o‘tkazdi; typecheck, lint va build ham o‘tdi. Yangi 4 test Render HTTPS manzili, public demo/ephemeral SQLite rad etilishi, bir portdagi API/webhook, webhook secret tekshiruvi va Telegram ID membership bog‘lanishini tekshiradi. Telegram tashqi API chaqiruvlari testda adapter orqali mock qilindi. Haqiqiy Render/Neon hisoblarida deploy va Telegram tashqi yetkazish ushbu tekshiruv bilan tasdiqlanmagan.

README’dagi Hozirgi chegaralar bo‘limi qolgan ishlarni aniq belgilaydi. Demo auth production deb ko‘rsatilmagan. Haqiqiy integratsiyalar keyin ulanadi; kalitlar frontend bundle’da yoki repo’da saqlanmaydi. Environment draft saqlanishi deployment/publish bajarilganini anglatmaydi.
