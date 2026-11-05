# NNP Web App (Next.js)

“Navobod naslli parranda qisqarmasi” uchun veb-ilova va Telegram Web App.
Manbalar — `../docs/API_CONTRACT.md` (5-bo‘lim: sahifalar va rollar) va `../docs/API_CONTRACT_V2.md`
(6-bo‘lim: statistika, audit, yangi sahifalar). Ikkalasi ham majburiy.

Texnologiyalar: Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript,
Tailwind CSS 4, react-leaflet + OpenStreetMap, lucide-react. UI kit va grafik kutubxonasi yo‘q.

## Ishga tushirish (Windows)

Talablar: Node.js 24, npm 11, ishlab turgan backend (`parranda_backend`, `127.0.0.1:8000`).

```powershell
cd E:\Haydar_bobo\parranda_next
npm install
copy .env.example .env.local      # BACKEND_URL=http://127.0.0.1:8000
npm run dev                       # http://localhost:3000
```

Production:

```powershell
npm run build
npm run start                     # http://localhost:3000
```

Tekshiruvlar:

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

## Backend bilan bog‘lanish

Brauzer va Telegram Web App faqat nisbiy `/api/...` yo‘llarini chaqiradi. `next.config.ts` dagi
`rewrites` ularni `${BACKEND_URL}/api/...` ga proxy qiladi — bitta origin, CORS kerak emas.
Yo‘llar oxirida `/` bo‘lmaydi (kontrakt talabi).

`BACKEND_URL` `next build` / `next dev` ishga tushganda o‘qiladi (rewrites build vaqtida
yoziladi). Qiymatni o‘zgartirsangiz, serverni qayta ishga tushiring yoki qayta build qiling.

## Telegram Web App va ngrok

Telegram Web App faqat `https` manzilni ochadi. Lokal ishlashda bitta tunnel yetarli —
faqat Next.js portiga (3000), chunki API ham shu origin orqali o‘tadi:

```powershell
ngrok http 3000
```

Hosil bo‘lgan `https://....ngrok-free.app` manzilini botning `.env` faylidagi `WEBAPP_URL` ga yozing.
Bot tugmasi `WEBAPP_URL + button_path` ni ochadi (masalan, `/households/3`). Sahifa
`telegram-web-app.js` ni yuklaydi, `Telegram.WebApp.ready()` va `expand()` ni chaqiradi.
Sessiya bo‘lmasa `/login` ga o‘tadi va `initData` bo‘sh bo‘lmasa avtomatik
`POST /api/auth/telegram` qiladi, so‘ng foydalanuvchini so‘ralgan sahifaga qaytaradi.
Telegram akkaunti bog‘lanmagan bo‘lsa (403) — “Botda /start bosing” xabari va login/parol formasi ko‘rsatiladi.
Telegram ichida “Chiqish” bosilgandan keyin avtomatik kirish shu oynada qayta ishlamaydi —
“Telegram orqali kirish” tugmasi bilan qo‘lda kiriladi.

Avtomatik kirish **faqat Telegram mijozi ichida** ishlaydi (mobil/desktop ilova `TelegramWebviewProxy` ni beradi,
Telegram Web esa ilovani iframe’da ochadi). Oddiy brauzerda `#tgWebAppData=...` bilan ochilgan havola boshqa
odamning `initData` sini olib kelishi mumkin (login CSRF), shuning uchun u yerda faqat
“Telegram orqali kirish (@username)” tugmasi ko‘rsatiladi. `next.config.ts` `Content-Security-Policy:
frame-ancestors 'self' https://web.telegram.org` sarlavhasini qo‘yadi — boshqa sayt ilovani iframe’ga joylay olmaydi.

`initData` faqat serverda (`BOT_TOKEN` bilan) tekshiriladi; backend `.env` dagi `BOT_TOKEN` bo‘sh bo‘lsa
Telegram orqali kirish `401` qaytaradi.

## Sahifalar

| Yo‘l | Kim | Mazmuni |
|---|---|---|
| `/login` | hamma | login/parol, Telegram orqali avtomatik kirish |
| `/change-password` | hamma | parolni almashtirish; vaqtinchalik parol bilan kirilganda majburiy |
| `/` | hamma | A/W → `/dashboard`, O → `/my` |
| `/dashboard` | A, W | ko‘rsatkichlar, “So‘nggi 30 kun” (go‘sht, FCR, o‘rtacha vazn, o‘lim, hisobot intizomi — oldingi davrga nisbatan, “Batafsil →” `/stats`), 14 kunlik go‘sht/yem grafigi, xarita, kam qolgan mahsulotlar, hisobot bermaganlar, so‘nggi harakatlar |
| `/stats` | A, W | tahlil: davr tanlash, 10 ta KPI (delta bilan: go‘sht, FCR, go‘sht / parranda, o‘rtacha vazn, yem, yem / parranda / kun, nobud, o‘lim, intizom, hisobotlar), go‘sht / FCR / yem / o‘rtacha vazn / nobud / hisobotlar / tarqatish grafiklari, parranda turlari (donut + jadval), tumanlar, hisobot intizomi, eng yaxshi va eng past 5 xonadon (FCR bo‘yicha, past — yaxshi), yuqori o‘lim (chegara bilan), ombor bo‘limi |
| `/households` | A, W | qidiruv/filtr, jadval; A: “Yangi xonadon” (vaqtinchalik parol bir marta ko‘rsatiladi) |
| `/households/[id]` | A, W | profil, joylashuv (A xaritani bosib o‘rnatadi), partiyalar, **Statistika** (KPI, parranda soni, go‘sht, o‘rtacha vazn, yem, hisobot kalendari va hisobotsiz kunlar), harakatlar, hisobotlar, berilgan mahsulotlar; parranda harakati; A: tahrirlash, faollik, hisobot kiritish, egasining hisobi |
| `/batches` | A, W | partiyalar (qator → `/batches/[id]`), yangi partiya, “Amal” (tarqatish / qaytarish / nobud / chiqim), harakatlar tarixi |
| `/batches/[id]` | A, W | partiya: yosh, KPI, “Tarkib” donut (markaz + xonadonlar + nobud + chiqim = boshlang‘ich), dinamika (standart davr — butun davr), xonadonlar bo‘yicha taqsimot, harakatlar; “Amal”, “Tahrirlash” (faqat sog‘lig‘i holati va yetkazib beruvchi — `PATCH`) |
| `/warehouse` | A, W | ombor ko‘rsatkichlari (mahsulotlar, kam qolgan, yem qoldig‘i, necha kunga yetadi), mahsulotlar (qoldiq, “Kam”, “Yetadi”; qator → `/warehouse/[id]`), yangi/tahrirlash, kirim/chiqim, operatsiyalar tarixi |
| `/warehouse/[id]` | A, W | mahsulot: qoldiq, o‘rtacha kunlik chiqim, yetadi (7 kundan kam — ogohlantirish rangi), kirim/chiqim; qoldiq grafigi (minimal zaxira chizig‘i bilan), kunlik kirim/chiqim, eng ko‘p oluvchilar, operatsiyalar tarixi |
| `/map` | A, W | barcha xonadonlar xaritasi |
| `/users` | A | foydalanuvchilar, yangi xodim, bloklash, parolni tiklash, Telegramni uzish |
| `/audit` | A | audit jurnali: bo‘lim, amal, foydalanuvchi, manba, sana va qidiruv (300 ms) filtrlari URL’da; qator ochilsa “Maydon / Oldin / Keyin” jadvali |
| `/my` | O | o‘z xonadoni: ko‘rsatkichlar, bugungi hisobot, partiyalar, **Statistika** (7 / 30 / 90 kun), nobudni qayd etish, hisobotlar, olingan mahsulotlar |

Ruxsat bo‘lmagan sahifaga kirilsa (masalan, omborchi `/audit` ni ochsa), foydalanuvchi o‘z bosh sahifasiga
yo‘naltiriladi (`/users` bilan bir xil). Menyuda faqat rolga ruxsat etilgan bo‘limlar ko‘rinadi. Telefonda pastki
menyuda ko‘pi bilan 5 ta joy bor: asosiy 4 bo‘lim + “Yana” (qolganlari pastdan ochiladigan oynada).

## Statistika: qanday ko‘rsatiladi

Barcha sonlar backend’da `API_CONTRACT_V2.md` 1-bo‘limidagi formulalar bo‘yicha hisoblanadi; Web App ularni qayta
hisoblamaydi, faqat ko‘rsatadi (`lib/stats.ts`):

- **Davr** URL’da: `?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` (havolani ulashish mumkin). Parametrsiz — backend
  standarti (30 kun; partiya sahifasida “Butun davr”). “Boshqa” — ikki sana; so‘rovdan oldin API bilan bir xil
  qoidalar tekshiriladi (`date_to ≤ bugun`, `date_from ≤ date_to`, `≥ 01.01.2000`, ≤ 366 kun). API `400` qaytarsa,
  xabar tanlagich yonida ko‘rsatiladi.
- **KPI kartasi**: qiymat API aniqligida (`81.3%`, `135.7 g`, `0.110 kg`), delta chipi `▲ 5.5%` / `▼ 2.3 p.p.`
  (foiz ko‘rsatkichlari uchun foiz punkti). Rang 1.2-jadvaldagi yo‘nalish bo‘yicha: yaxshi — yashil, yomon — qizil,
  neytral — kulrang. Strelka va ekran o‘quvchi uchun so‘z (“o‘sish / kamayish”, “yaxshi / yomon”) har doim bor —
  ma’no faqat rangga bog‘liq emas. Ostida “oldingi: …”, `title` da oldingi davr sanalari.
- `null` (nolga bo‘lish) — `—`. Hisobot kiritilmagan kunlar grafikda bo‘shliq (chiziq uziladi), nol emas.
- Ombor: “Yetadi” = joriy qoldiq ÷ o‘rtacha kunlik chiqim; 7 kundan kam bo‘lsa ogohlantirish rangi.

## Grafiklar (`components/charts`, kutubxonasiz SVG)

| Komponent | Vazifasi |
|---|---|
| `TimeChart` | kunlik qator: area, chiziq (pog‘onali ham), ustunlar; 3–4 “yumaloq” y belgisi, ≤ 6 ta `DD.MM` yorlig‘i; hover / bosish / ← → bilan kesishma chizig‘i va tooltip (`DD.MM.YYYY` + qiymat); `null` chiziqni uzadi; `ResizeObserver` bilan haqiqiy piksel kengligida chiziladi (telefonda ham tiniq); `role="img"` + yashirin jadval |
| `RankedBars` | tartiblangan gorizontal ustunlar (tumanlar, eng ko‘p oluvchilar), qiymat matn rangida |
| `Donut`, `ProgressRing` | ulushlar (2 px oraliq bilan) va bitta foiz (hisobot intizomi) |
| `Sparkline` | KPI kartasidagi kichik trend |
| `CalendarStrip` | hisobot kalendari: haftalar qator, Du–Ya ustun; kiritilgan / kiritilmagan / kutilmagan; bosilsa sana va sonlar |
| `KpiCard`, `StatKpiCard`, `PeriodPicker`, `ChartCard`, `Loadable` | `components/stats`: KPI, davr, karta, yuklanish / bo‘sh / xato holatlari |

Ranglar faqat brend palitrasidan: asosiy `#12372A`, aksent `#2F6B3F` (area 12 %), ogohlantirish `#E8B04A`,
xavf `#B42318`; parranda turlari BROILER `#E8B04A`, BREEDER `#9DBFDC`. Ikki va undan ko‘p qator
bo‘lsa — legenda; ma’lumot har doim jadval ko‘rinishida ham bor.

## Dizayn tizimi

- Tokenlar `app/globals.css` da (`@theme`): ranglar, `shadow-card`, animatsiyalar. Tailwind standart palitrasi o‘chirilgan.
- Shrift o‘lchamlari: sahifa sarlavhasi 22/26 px, karta sarlavhasi 15 px, matn 14 px, izoh 13 px, belgilar 11–12 px;
  sonlar `tabular-nums`. Oraliqlar: kartalar orasida 12/16 px (telefon) va 20/24 px (desktop).
- `PageHeader`: batafsil sahifalarda “non yo‘li” (breadcrumbs), sarlavha, bir qator izoh, amallar (telefonda to‘liq kenglik).
- Kartalar: `rounded-xl`, 1 px chegara, juda yengil soya. Jadvallar: zebra yo‘q, hover, 25 qatordan uzun bo‘lsa
  karta ichida aylanadi va sarlavha yopishib turadi; telefonda qatorlar kartochkaga aylanadi.
- Har bo‘limda skeleton, bo‘sh holat (ikonka + bir qator) va “Qayta urinish” bilan xato holati.
- Fokus halqasi barcha interaktiv elementlarda; `prefers-reduced-motion` da animatsiyalar o‘chadi.
- Telegram: balandlik `--tg-viewport-stable-height` (bo‘lmasa `100dvh`), xavfsiz hududlar `env(safe-area-inset-*)`
  va `--tg-safe-area-inset-*`; pastki menyu va toastlar shu chegaradan yuqorida.

## Shartnomaga oid izohlar

- Kasr ajratuvchi — nuqta (`135.7`, `310.5`), `API_CONTRACT_V2.md` 6.2 va botdagi format bilan bir xil
  (Phase 1 da Web App vergul ishlatgan edi). Minglik ajratuvchi — bo‘linmas bo‘sh joy (`61 200`).
- `/stats` dagi `mortality_threshold` ham URL’da saqlanadi (400 ms kechikish bilan yuboriladi; 0–100 dan tashqari
  qiymat yuborilmaydi va maydon yonida xato ko‘rsatiladi).
- Partiya sahifasida “1 yil” tayyor davri yo‘q: standart “Butun davr” uni qamraydi (backend chegarasi 366 kun).
- Audit jurnalidagi “Foydalanuvchi” filtri `GET /api/users` dagi barcha foydalanuvchilarni (egalarini ham) taklif qiladi.

## Tuzilma

```
app/                      sahifalar (App Router); (app)/ — himoyalangan qism (sidebar + pastki menyu)
components/ui/            kichik UI komponentlar (Button, Field, Modal, DataTable, Toast, Confirm, PageHeader ...)
components/charts/        SVG grafiklar (TimeChart, RankedBars, Donut, ProgressRing, Sparkline, CalendarStrip)
components/stats/         KpiCard, PeriodPicker, ChartCard, Loadable
components/layout/        AppShell, route guard, logo, login/parol oynasi
components/map/           react-leaflet xaritasi (dynamic import, ssr: false, CircleMarker)
features/                 bo‘limlarga oid modallar va jadval ustunlari
lib/api.ts                typed fetch: Bearer token, 401 da bitta umumiy refresh, ApiError (DRF xatolari)
lib/auth.tsx              AuthProvider (/api/auth/me), useAuth
lib/types.ts              kontraktdagi barcha obyektlar uchun TypeScript turlari
lib/format.ts             DD.MM.YYYY, “1 500”, foiz, sana hisobi, o‘zbekcha nomlar
lib/stats.ts              KPI nomlari, birliklari, aniqligi, yo‘nalishi (delta rangi), davr qoidalari
lib/audit.ts              audit bo‘lim / amal / manba nomlari, “Oldin / Keyin” farqi
lib/use-api.ts            GET ma’lumotlarini yuklash; har bir muvaffaqiyatli POST/PATCH dan so‘ng avtomatik yangilanadi
```

Tokenlar `localStorage` da: `nnp_access`, `nnp_refresh`. `401` bo‘lsa `/api/auth/refresh` bir marta
chaqiriladi (parallel so‘rovlar bitta refreshni kutadi), muvaffaqiyatsiz bo‘lsa sessiya tozalanadi va `/login` ochiladi.

## Kelishuvlar

- Barcha UI matnlari o‘zbek lotin yozuvida (`o‘`, `g‘`); sanalar `DD.MM.YYYY`, sonlar `1 500`, kasr `310.5`.
- Ombor va parranda operatsiyalari o‘zgarmas, shuning uchun har biri tasdiqlash oynasidan keyin yuboriladi.
- Tanlov maydonlari (xonadon, partiya, mahsulot) barcha sahifalarni `page_size=200` bilan ketma-ket yuklaydi
  (`useAllPages`), shuning uchun 200 tadan keyingi yozuvlar ham tanlanadi.
- Sahifalangan ro‘yxatlar `usePagedApi` dan foydalanadi: amaldan keyin joriy sahifa yo‘qolsa (`404 Sahifa topilmadi`),
  oldingi sahifaga o‘tiladi. Qayta yuklash xato bersa, eski qatorlar ustida “Ma’lumot yangilanmadi” ogohlantirishi chiqadi.
- `/users` faqat xodimlarni (`ADMIN`, `WAREHOUSE`) ko‘rsatadi (`GET /api/users?role=ADMIN,WAREHOUSE`); xonadon egalari
  hisoblari `/households/[id]` da boshqariladi. O‘z hisobi uchun “parolni tiklash” va “Telegramni uzish” tugmalari
  yo‘q (ular joriy sessiyani yakunlaydi) — “Parolni almashtirish” sahifasidan foydalaniladi.
- Parol almashtirilganda backend barcha tokenlarni bekor qiladi; ilova yangi parol bilan avtomatik qayta kiradi.
- `?next=` faqat shu origin ichidagi yo‘l bo‘lsa qabul qilinadi (URL parser bilan tekshiriladi; boshqaruv belgilari
  va `\` rad etiladi).

## 3-bosqich (V3) poydevori

- Rollar: `LOGISTICS` (bosh sahifa `/logistics`), `VET` (`/vet`); `user.is_super_admin` — `/settings` faqat unga.
  Navigatsiya va ruxsat: `lib/nav.ts` (`NAV_ITEMS`, `primaryFor`, `superOnly`, eng uzun prefiks qoidasi, `canAccess(user, path)`).
- Shell: qo‘ng‘iroqcha (`components/layout/notification-bell.tsx`, 60 s va fokusda), global qidiruv (`global-search.tsx`),
  hisob menyusi (`user-menu.tsx`: “Chiqish” → `POST /api/auth/logout`, “Barcha qurilmalardan chiqish”), kompaniya nomi `/api/settings` dan.
- Tayyor sahifalar: `/settings` (Kompaniya, Bildirishnomalar, Rollar), `/notifications` (monitor). Qolgan yangi yo‘llar —
  sarlavha + bo‘sh holat (modul jamoalari to‘ldiradi).
- Fayllar: `components/files/file-upload.tsx` (drag&drop, telefonda kamera, progress, 10 MB / JPG-PNG-WEBP-PDF),
  `attachment-list.tsx`; `lib/files.ts` (`uploadFile`, `useBlobUrl`), `lib/api.ts` (`apiBlob`, `apiDownload`, `uploadForm`).
- Proxy: `next.config.ts` → `experimental.proxyClientMaxBodySize: "11mb"` (Next 16 hujjati: standart 10MB).
- Turlar: `lib/types/<modul>.ts` (`lib/types.ts` oxirida qayta eksport), holatlar va ranglar: `lib/status.ts`.
- Test build: `$env:NEXT_DIST_DIR=".next-agent"; npx next build` (build `tsconfig.json`/`next-env.d.ts` ga `.next-agent`
  yo‘llarini yozadi — commitdan oldin qaytaring).

## Fix bosqichi (TZ to‘liq qamrovi, `docs/TZ_COVERAGE.md`)

- **Faqat go‘sht yo‘nalishi** (mijoz qarori): parranda turlari BROILER va BREEDER; kunlik hisobotda asosiy natija —
  go‘sht (kg, ixtiyoriy maydon, formada birinchi), o‘rtacha vazn, yem, nobud. Ko‘rsatkichlar: go‘sht, FCR = yem ÷ go‘sht
  (past — yaxshi, KPI rangi o‘lim kabi teskari), go‘sht / parranda, o‘rtacha vazn; eng yaxshi / past xonadonlar FCR bo‘yicha.
- **Dashboard** (`app/(app)/dashboard/page.tsx`, `features/dashboard/period-section.tsx`): “Jami parranda”, “Ombor qoldig‘i”
  (→ `/warehouse`), “Bugungi go‘sht” plitkalari; “Davr ko‘rsatkichlari” — `PeriodPicker` + viloyat, parranda turi,
  “Demo ma’lumotsiz” filtrlari (URL: `date_from/date_to/region/poultry_type/exclude_demo`, `/api/stats/overview`),
  go‘sht va o‘rtacha vazn grafiklari; “Oylik ishlab chiqarish” (`production_12m`, `MonthlyProductionCard`). `MiniBarChart`
  endi `windowLabel`/`formatLabel`/`formatTick` qabul qiladi.
- **Sana maydonlari** DD.MM.YYYY ko‘rinadi: `Input type="date"` → `DateInput` (`components/ui/field.tsx`, fokusda
  native tahrirlash, qiymat ISO bo‘lib qoladi).
- **Xonadon sahifasi**: “Buyurtmalar”, “Yetkazishlar”, “Faoliyat” (ADMIN, `/api/audit-logs?household=`) tablar
  (`features/households/household-activity.tsx`), “Qabul qilingan” ustuni, Telegram ID (`•••4567`), “Demo” belgisi;
  tahrirlashda “Ma’lumot turi” (real / demo). Ro‘yxatda demo filtri.
- **Egasi**: `/my` dagi partiya kodi → `OwnerBatchModal` (`/api/my/batches/{id}`: yosh, yetkazib beruvchi, sog‘liq,
  emlash tarixi); 7 kunlik go‘sht va FCR.
- **Ombor**: “Parranda (markazda)” kartasi (`features/stock/center-birds-card.tsx`); kirim/chiqim formasida hujjat fayli
  (`STOCK_DOCUMENT`), jadvalda 📎 (`features/stock/document-files.tsx`).
- **Logistika**: yetkazish oynasida ekrandagi imzo (`components/files/signature-pad.tsx` → PNG `DELIVERY_PROOF`).
- **Bildirishnoma sozlamalari**: qo‘ng‘iroqcha → ⚙️ (`components/layout/notification-preferences.tsx`).
- **Audit**: holat, xonadon, mahsulot filtrlari; “Rad etildi” belgisi. **Statistika**: go‘sht grafigi.
- **Fayllar**: `VET_REQUEST` uchun faqat rasm (`acceptAttributeFor`, `validateFile(file, purpose)`).
- VET uchun partiya kodlari havola emas (`movementColumns({ linkBatches })`). Buyurtmani tasdiqlashda o‘tgan
  `desired_date` reja sanasiga qo‘yilmaydi. Sessiyalarni yakunlash oynasi Telegram Web App haqida ogohlantiradi.
- `eslint.config.mjs` boshqa agent build papkalarini (`.next-*/**`) ham e’tiborsiz qoldiradi.

## Docker (server)

Bu papkada o‘z `Dockerfile` va `docker-compose.yml` bor. U `parranda_backend` yaratadigan `nnp_net` tarmog‘iga ulanadi, shuning uchun backend birinchi ishga tushiriladi.
To‘liq yo‘riqnoma: `parranda_backend/DEPLOY.md`.

```bash
docker compose build
docker compose up -d
```
