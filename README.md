# Smart Savdo & Qarz Daftar

Kichik biznes uchun savdo, qarz, mijoz va ombor boshqaruvi. Web dashboard va Telegram Mini App bitta responsive React ilova; bot ham shu backendning biznes xizmatlari va bazasidan foydalanadi.

**Kalitlarsiz ishlaydigan, ma’lumotlarni serverda saqlaydigan demo.** Haqiqiy to‘lov provayderi ulanmagan: naqd/karta yozuvlari hisob-kitobni qayd etadi, bankdan pul yechmaydi. Telegram tokenisiz xabarlar faqat demo bildirishnomasi sifatida saqlanadi.

## Tez boshlash

Node.js **24 LTS**, npm va Linux/macOS/Windows kerak. Tavsiya etilgan versiya `.node-version` faylida.

```bash
npm ci
npm run dev
```

Web: `http://localhost:5173`, API: `http://localhost:3001`. Kirish ekranida **Demo bilan tanishish** tugmasini bosing. `.env` yoki token shart emas. Ilova birinchi ishga tushishda SQLite bazasini va bog‘langan demo yozuvlarini yaratadi. Bu manzillar mahalliy ishga tushirish uchun; bulutli onboarding UI localhost preview bermaydi.

Demo ma’lumotlar `data/smart-savdo.sqlite` faylida saqlanadi; server yoki brauzerni qayta ishga tushirish ularni o‘chirmaydi. Bir xil demo tashkiloti shu instansiyadagi demo foydalanuvchilariga umumiy: shaxsiy yoki haqiqiy biznes ma’lumotlarini demo hisobiga kiritmang.

```bash
npm run build
APP_URL=http://localhost:3001 WEB_APP_URL=http://localhost:3001 npm start
```

Bu rejimda backend `dist/` web buildini ham beradi. `.env.example` ni `.env` ga nusxalash va kerakli sozlamalarni kiritish mumkin. `.env` Git va Docker buildiga kirmaydi.

## Ishlaydigan modullar

- **Dashboard:** bugungi/haftalik/oylik savdo, sof foyda, qarz qoldig‘i, qaytgan mablag‘, mijozlar, ombor, savdo dinamikasi va oxirgi operatsiyalar. Yangi yozuvdan so‘ng barcha sahifalar yangilanadi.
- **Qarz:** mijozga qarz berish, sana/muddat/izoh, filtr va qidiruv, qisman/to‘liq to‘lov, status, tahrirlash, saqlanadigan to‘lov tarixi va qo‘lda eslatma. Savdoga bog‘langan qarz faqat savdoni qaytarish orqali bekor qilinadi.
- **CRM:** yangi mijoz, profil tahriri, telefon/Telegram ID/manzil/izoh, xarid va qarz summalari, faoliyat tarixi.
- **POS:** mahsulot va miqdor, chegirma, naqd/karta/qarz/aralash to‘lov, savdo tarixi, chop etiladigan chek. Savdo qaytarilganda qoldiq omborga qaytadi, qarz yopiladi, to‘lovga alohida refund yozuvlari qo‘shiladi.
- **Ombor:** mahsulot tahriri, SKU, tannarx/narx, kam qoldiq, kirim/chiqim va harakatlar tarixi. CSV import yangi SKU uchun atomik; bir qator xato bo‘lsa butun import bekor qilinadi. CSV eksport shablon sifatida ishlatiladi.
- **Analitika:** sana filtri, savdo/xarajat/sof foyda, top mahsulot va mijozlar, xarajat qo‘shish, Savdo/qarz/xarajat/joriy ombor uchun CSV va haqiqiy XLSX eksport. PDF — brauzerning Print → Save as PDF funksiyasi. Grafik oxirgi 30 kunni, ko‘rsatkichlar esa butun tanlangan davrni qamraydi.
- **Sozlamalar:** do‘kon nomi, UZS, qarz muddati, light/dark/system, bildirishnomalar, rol boshqaruvi, Telegram bog‘lash, JSON biznes eksporti va audit. Ruscha/inglizcha navigatsiya tarjima qilingan; qolgan modullar o‘zbekcha.
- **Mini App:** Telegram mavzusi, haptic feedback, Back Button, savat bo‘lsa Main Button, safe-area va mobil pastki navigatsiya. SDK Telegram tashqarisida talab qilinmaydi.
- **Bot:** reply/inline menyular, dashboard, mijoz/qarz qo‘shish dialoglari, qarz to‘lovi, ombor/analitika, Mini App tugmasi. Botdagi POS va batafsil sozlamalar Mini App orqali ochiladi.

## Arxitektura va texnologiyalar

**React + TypeScript + Vite**: tezkor frontend va Telegram uchun bitta build. **Express + TypeScript**: web va bot uchun umumiy biznes logika. **Knex + SQLite/PostgreSQL**: bir xil tranzaksiya va migratsiyalar bilan kalitlarsiz lokal demo, hamda production PostgreSQL. Prisma o‘rniga Knex tanlandi, chunki demo va PostgreSQL uchun alohida model generatsiyasi talab qilinmaydi. **Zod**, **Recharts**, **Motion**, **Lucide**, **grammY**, **Vitest** va **Playwright** ishlatiladi. Shriftlar npm orqali ilova bilan birga keladi, tashqi font CDN kerak emas.

```text
src/
  components/       UI, modal, form, grafik va holatlar
  pages/            Dashboard, Debts, Customers, Sales, Products, Reports, Settings
  config/           API konfiguratsiyasi va i18n lug‘atlari
  services/         API interfeysi, HTTP adapter, Telegram SDK adapteri
  store.tsx         Umumiy holat, API yangilanishi va toast
shared/types.ts     Web/backend ma’lumot kontraktlari
server/
  db.ts             Versionlangan SQLite/PostgreSQL schema va migratsiyalar
  domain.ts         Tranzaksiyali biznes xizmatlari va validatsiya
  auth.ts           Password scrypt, JWT, Telegram initData tekshiruvi
  app.ts            API, auth, RBAC, origin himoyasi, rate limiting
  adapters/         Mock va haqiqiy Telegram xabar adapterlari
  services/         Telegram bildirishnoma navbati
  seed.ts           Izchil demo seed
bot/                grammY bot, umumiy biznes xizmatlari
scripts/            Foydalanuvchi yaratish
 tests/             Biznes, xavfsizlik, API va brauzer testlari
 docs/              Arxitektura, API va test natijalari
```

Batafsil: [arxitektura](docs/ARCHITECTURE.md), [API](docs/API.md), [tekshiruvlar](docs/VALIDATION.md).

## Hisob-kitob va xavfsizlik

- Summalar **butun tiyinlarda** (1 so‘m = 100 tiyin), SQLite/PostgreSQL `BIGINT` ustunlarida saqlanadi. API pul maydonlari ham tiyin. Kiritish chegarasi 1 trillion tiyin, float qabul qilinmaydi. Frontend so‘mdan tiyinlarga bir marta o‘giradi.
- Har bir muhim yozuv sessiya, membership va organization scope bilan tekshiriladi. `organizationId` brauzerdan olinmaydi.
- Administrator/menejer mahsulot, inventarizatsiya, xarajat, qaytarish va sozlamalarni boshqaradi. Kassir mijoz, savdo, qarz va to‘lov bilan ishlaydi; kuzatuvchi yozuvlarni o‘zgartira olmaydi.
- Moliyaviy operatsiyalarda `Idempotency-Key` shart. Bir xil kalit/payload avvalgi javobni qaytaradi; boshqa payload bilan 409. PostgreSQL tashkilot yozuvini `FOR UPDATE` bilan bloklaydi; SQLite bitta ulanishda tranzaksiyalarni navbat bilan bajaradi.
- To‘lov/refund/audit yozuvlarini o‘chirish endpointi yo‘q. Qarz balansi to‘lovlardan kelib chiqadi, manfiy qoldiq rad etiladi.
- Production login: tuzlangan scrypt parol xeshi, HS256 JWT, issuer/audience tekshiruvi, HttpOnly/SameSite=Strict cookie va 8 soatlik sessiya. Telegram iframe third-party cookie cheklovi uchun Mini App JWT faqat JS xotirasida saqlanadi; localStorage’da token saqlanmaydi. HTTPS APP_URL bo‘lsa Secure cookie.
- JSON-only mutatsiyalar, origin/fetch-site tekshiruvi, Helmet CSP, XSS uchun React escaping va login/API rate limitlar mavjud. Tashqi foydalanuvchi ma’lumotlari HTML sifatida qo‘yilmaydi; CSV formula injection neytrallanadi.
- **DEMO_MODE=false** demo loginni o‘chiradi va 32+ belgili JWT_SECRET talab qiladi. Ishlab turgan demo sessiyasini production auth deb talqin qilmang.

## PostgreSQL va production hisoblar

```bash
# .env da haqiqiy DATABASE_URL, DEMO_MODE=false va JWT_SECRET sozlang
npm run db:migrate
# Parolni ADMIN_PASSWORD muhit o‘zgaruvchisida xavfsiz kiriting, buyruq satriga yozmang
npm run user:create -- --email=admin@biznes.uz --name="Aziz Karimov" --store="Baraka Market"
# Shu tashkilotga xodim qo‘shish (birinchi buyruq organization ID chiqaradi)
npm run user:create -- --email=kassir@biznes.uz --name="Kassir" --org=ORGANIZATION_ID --role=cashier
npm run build
npm start
```

`ADMIN_PASSWORD` kamida 12 belgidan iborat bo‘lsin. `--telegram=NUMERIC_ID` ishonchli ma’muriy bog‘lash uchun. Production UI orqali bog‘lash faqat Telegram ichida haqiqiy imzolangan `initData` bilan bajariladi. `.env` dagi DATABASE_URL maxfiy saqlansin; uni frontend `VITE_` maydoniga qo‘ymang.

Telegram va haqiqiy xabarlar uchun tarmoqda `api.telegram.org`, Mini App brauzeri uchun `telegram.org` kerak.

Public deployment uchun HTTPS reverse proxy/TLS, ruxsat etilgan APP_URL/WEB_APP_URL, muntazam database backup va monitoring zarur. UI’da berilgan JSON eksport to‘liq DB backup/restore o‘rnini bosmaydi. SQLite’dan PostgreSQL’ga o‘tish avtomatik ma’lumot ko‘chirish emas: ikkita bazada bir xil schema yaratiladi, mavjud ma’lumotlar alohida boshqariladigan migratsiya orqali ko‘chiriladi.

## Telegram’ni ulash

1. BotFather’da bot yarating, `TELEGRAM_BOT_TOKEN` ni **server** `.env` fayliga kiriting.
2. `APP_URL` va `WEB_APP_URL` uchun haqiqiy HTTPS domen ishlating; Telegram localhost Web App tugmasini qo‘llamaydi.
3. Foydalanuvchining Telegram ID’sini hisobga bog‘lang. Telegram backend imzoni va 5 daqiqalik amal muddatini tekshiradi, noma’lum Telegram user uchun avtomatik administrator yaratmaydi.
4. `npm run bot` — polling rejimi. API va bot **bir xil DATABASE_URL** dan foydalanishi kerak; productionda PostgreSQL tavsiya etiladi.
5. Mini App uchun BotFather’da Web App URL yoki bot menyusidagi Web App tugmasini ishlating.
6. Savdo bildirishnomalari uchun Sozlamalar → Do‘kon’da do‘kon egasining Telegram ID’sini kiriting. Qarz eslatmasi mijoz profilidagi Telegram ID’ga yuboriladi. Qabul qiluvchi avval botga `/start` yuborgan bo‘lishi kerak.

Token bo‘lmasa `npm run bot` mock menyu va demo xulosasini tekshirib chiqadi, Telegram’ga hech narsa yubormaydi. API esa normal demo ishlayveradi.

Webhook kerak bo‘lsa `TELEGRAM_MODE=webhook`, 32–256 belgili `TELEGRAM_WEBHOOK_SECRET` (harf, raqam, `_`, `-`) va HTTPS APP_URL/WEB_APP_URL sozlang. `npm start` botni web ilova bilan bir portda ishga tushiradi: `/telegram/webhook` endpointi Telegram maxfiy headerini tekshiradi. Bu rejimda alohida `npm run bot` kerak emas. Eski alohida webhook jarayoni kerak bo‘lsa `npm run bot` va BOT_PORT (3002) ishlatilishi mumkin; reverse proxy endpointni o‘sha portga yo‘naltirsin. Bir token uchun bir vaqtning o‘zida faqat bitta webhook xizmatini yoki polling jarayonini ishlating.

API ichidagi worker har 15 soniyada yozilgan savdo bildirishnomalarini jo‘natadi. Yetkazish **at-most-once**: noaniq xatodan so‘ng avtomatik qayta yuborilmaydi, chunki Telegram idempotency kalitini qabul qilmaydi. `sending` holatida qolgan yozuvlar operator tekshiruvini talab qiladi. Qarz uchun avtomatik muddatli eslatmalar hozir yoqilmagan; qarz daftaridagi eslatma tugmasi ishlaydi.

## Bepul HTTPS hosting

[Render’da joylashtirish](https://render.com/deploy?repo=https://github.com/Slayer0205/Codex-AI) — repodagi `render.yaml` Blueprint web ilova va Telegram webhook botini bitta bepul xizmatda ishga tushiradi. Neon Free PostgreSQL bazasining connection string’i va BotFather tokeni kerak. Ommaviy demo kirishi o‘chiriladi, JWT va webhook sirlari Render’da avtomatik yaratiladi, HTTPS manzili `RENDER_EXTERNAL_URL` dan olinadi.

Bosqichma-bosqich Windows ko‘rsatmasi: [docs/FREE-HOSTING.md](docs/FREE-HOSTING.md). Bepul Render xizmati foydalanilmaganda uxlaydi; saytning birinchi ochilishi yoki Telegram javobi kechikishi mumkin. Bu cheklovsiz, doim uyg‘oq 24/7 xizmat kafolati emas. Providerlarning joriy limitlari va narxlarini o‘z dashboardlarida tekshiring.

## Docker

```bash
docker compose up --build -d
```

Kalitlarsiz demo `http://localhost:3001` da. SQLite volume saqlanadi. `docker compose down` volume’ni o‘chirmaydi.

Production uchun `.env.production.example` asosida `.env` yarating. POSTGRES_PASSWORD uchun URI ichida ishlatiladigan belgilarni percent-encode qilishni unutmang; oddiy uzun random alfanumerik parol ham ishlaydi.

```bash
docker compose -f compose.production.yaml up --build -d
# Hisob yaratish: konteynerda ADMIN_PASSWORD ni xavfsiz env sifatida bering
# Telegram token tayyor bo‘lganda:
docker compose -f compose.production.yaml --profile telegram up -d
```

Bot profilini faqat token mavjud bo‘lganda yoqing. Production compose o‘z PostgreSQL volume’iga ega; DB tashqariga port ochmaydi. Public HTTPS reverse proxy bu compose’dan tashqarida sozlanadi.

## Testlar

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

Playwright odatda `/usr/bin/chromium` ishlatadi. Boshqa tizimda `npx playwright install chromium` va `PLAYWRIGHT_CHROMIUM_EXECUTABLE` ni o‘rnatilgan brauzer yo‘liga sozlang. E2E alohida `data/e2e.sqlite`, API 3003 va web 5174 ishlatadi; asosiy demo bazasi o‘zgarmaydi. Testlar snapshotlarni `docs/` ga yozadi.

PostgreSQL biznes testlari alohida, **faqat test uchun** `savdo_test` bazasida:

```bash
TEST_DATABASE_URL=postgresql://.../savdo_test npm test
```

**Bu test komandasi `savdo_test` bazasining public schemasini tozalaydi. Production DATABASE_URL bilan ishlatmang.** Migratsiya ham, bir xil 19 ta test ham SQLite va PostgreSQL’da tekshiriladi.

## Hozirgi chegaralar

Bu funksional dastlabki mahsulot; to‘liq production ekspluatatsiyasi uchun sozlash va qo‘shimcha ishlar qoladi: 2FA/parolni unutish oqimi, to‘liq RU/EN tarjima, avtomatik muddatli qarz eslatmalari, PDF uchun server generatori, backup restore UI va katta dataset uchun server pagination. Demo bir umumiy tashkilotga kiradi. Botning ephemeral dialog holati restartda yo‘qoladi, saqlangan biznes yozuvlari esa bazada qoladi. Telegram’ning haqiqiy tashqi ulanishi token kiritilgandan so‘ng tekshiriladi. Bank/payment gateway adapteri hozir amalga oshirilmagan.

Bulutli vazifalarda mavjud checkout’dan foydalaning; alohida Git worktree kerak emas. O‘rnatilgan fayllar saqlanishi mumkin, ammo API/web/bot jarayonlari yangi vazifada qayta ishga tushirilishi kerak.
