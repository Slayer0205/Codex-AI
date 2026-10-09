# Kompyutersiz ishlaydigan bepul HTTPS havola

Web ilova va Telegram bot: Render Free web service. Baza: Neon Free PostgreSQL.
`render.yaml` ikkalasini bitta Node.js xizmatida ishlatadi; pullik background worker talab qilinmaydi.
Render foydalanilmaganda xizmatni uxlatishi mumkin: birinchi sahifa yoki bot javobi kechikadi.
Bepul rejalar limitlarga ega; limitdan oshish yoki pullik reja tanlash narxi provider dashboardida tekshiriladi.

## 1. Neon bazasini yarating

1. https://neon.tech da hisob oching. Bepul reja bilan loyiha yarating.
2. Render xizmatiga yaqin region tanlang, masalan Frankfurt.
3. Neon dashboardidagi **Connect** orqali **Connection string** oling. U `postgresql://` bilan boshlanadi va TLS parametrlarini o‘z ichiga oladi. Uni to‘liq, TLS parametrlarini saqlagan holda ishlating.
4. Bu manzil parolga ega: chatga, skrinshotga yoki GitHub’ga yubormang.

## 2. Bulut bazasida administrator yarating

PC’dagi eski SQLite hisob avtomatik PostgreSQL’ga ko‘chmaydi. Quyidagi amallar Neon’da yangi do‘kon va admin yaratadi. Lokal yozuvlar o‘z bazasida qoladi; ularni ko‘chirish alohida migratsiya talab qiladi.

Antigravity’da `package.json` turgan papkada yangi PowerShell terminali oching. Har bir buyruqni alohida bajaring:

```powershell
$savdoDb = Read-Host "Neon Connection string" -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new("", $savdoDb).Password
$savdoPassword = Read-Host "Kamida 12 belgili yangi admin paroli" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $savdoPassword).Password
$savdoEmail = Read-Host "Email"
$savdoTelegram = Read-Host "Shaxsiy raqamli Telegram ID"
npm.cmd run user:create -- "--email=$savdoEmail" --name="Admin" --store="Mening dokonim" --role=admin "--telegram=$savdoTelegram"
Remove-Item Env:ADMIN_PASSWORD
Remove-Item Env:DATABASE_URL
```

Telegram ID — shaxsiy raqamli user ID; bot tokeni, telefon raqami yoki `@username` emas. Uni Telegram’da @userinfobot orqali olish mumkin. **Created user** chiqsa, hisob tayyor. Agar shu email Neon’da allaqachon mavjud bo‘lsa, buyruqni takrorlab yangi foydalanuvchi yaratishga urinmang.

## 3. Lokal botni to‘xtating

PC’da `npm.cmd run bot` ishlab turgan terminalda **Ctrl + C** bosing. Aks holda lokal polling va Render webhook bir-biriga xalaqit beradi. Render’da keyin alohida bot jarayonini ishga tushirish kerak emas.

## 4. Render Blueprint bilan joylashtiring

1. https://render.com da GitHub orqali hisob oching.
2. [Deploy to Render](https://render.com/deploy?repo=https://github.com/Slayer0205/Codex-AI) ni oching yoki **New → Blueprint** orqali `Slayer0205/Codex-AI` repozitoriysini ulang. Agar u ro‘yxatda chiqmasa, GitHub integration’ga shu repoga kirish huquqini bering.
3. Quyidagi ikkita maxfiy qiymatni Render formasiga kiriting:

| Maydon               | Qiymat                                    |
| -------------------- | ----------------------------------------- |
| `DATABASE_URL`       | Neon’dan olingan to‘liq Connection string |
| `TELEGRAM_BOT_TOKEN` | BotFather bergan bot tokeni               |

4. Xizmat rejasini **Free** ekanini tekshiring va Blueprint’ni yarating. PostgreSQL xizmatini Render’da alohida yaratmang: baza Neon’da.
5. Build tugab, **Live** bo‘lganda Render xizmatining `https://....onrender.com` havolasini oching.

Blueprint `DEMO_MODE=false`, `TELEGRAM_MODE=webhook` va `TRUST_PROXY=1` ni o‘rnatadi. JWT va webhook maxfiy qiymatlari avtomatik yaratiladi. `APP_URL` va `WEB_APP_URL` Render bergan HTTPS manzildan avtomatik olinadi. Maxsus domen qo‘shilsa, ikkala qiymatni yangi HTTPS manzilga o‘zgartirib qayta deploy qiling.

## 5. Sayt va botni tekshiring

- Saytda Neon’da yaratgan email/parol bilan kiring. **Demo bilan tanishish** ommaviy kirishni bermaydi.
- Botga `/start` yuboring. Admin yaratishda berilgan Telegram ID uchun menyu va **Web App ochish** tugmasi chiqadi.
- Web App’da kirish, yangi mijoz yaratish va botning **Mijozlar** menyusida shu yozuvni ko‘rishni tekshiring.
- PC’ni o‘chirib, havolani telefon orqali sinang. Birinchi ochilish sekin bo‘lsa xizmat uyg‘onishini kuting.

HTTPS Mini App tugmasi bot menyusiga avtomatik qo‘shiladi. BotFather’da doimiy menyu tugmasi uchun **/setmenubutton** orqali shu Render havolasini ham belgilash mumkin.

## Muammo bo‘lsa

- **Hisob hali bog‘lanmagan:** `--telegram` da botga yozayotgan hisobingizning shaxsiy raqamli ID’si berilganini tekshiring.
- **Neon connection xatosi:** connection string’ni to‘liq kiriting va Neon loyihasi faol ekanini tekshiring.
- **Webhook xatosi:** Render loglarini tekshiring; lokal bot terminali o‘chiq bo‘lsin. Sirlar yoki connection string bor loglarni chatga yubormang.
- **Bazadagi ma’lumot yo‘q:** Render’dagi `DATABASE_URL` admin yaratishda ishlatilgan aynan o‘sha Neon bazasi bo‘lsin. SQLite free Render diskida saqlanmaydi; ilova bunday sozlamani ishga tushirishdan oldin rad etadi.

Render/Neon orqali haqiqiy tashqi deploy faqat shu xizmatlardagi hisoblar va maxfiy qiymatlar bilan tekshiriladi. Repo ichidagi lokal testlar muvaffaqiyatli bo‘lishi hosted xizmat allaqachon Live ekanini anglatmaydi.
