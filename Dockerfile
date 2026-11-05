# NNP frontend — Next.js 16 (standalone)
#
# Uch bosqich: kutubxonalar -> build -> ishga tushirish.
# Yakuniy obrazga faqat build natijasi tushadi.

# ---------------------------------------------------------------- 1. deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` emas: lock fayl Windows'da yaratilgan, Linux uchun ixtiyoriy paketlar unda yo'q
RUN npm install --no-audit --no-fund

# ---------------------------------------------------------------- 2. build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `/api/*` rewrite manzili BUILD paytida yoziladi. Production'da nginx /api ni
# to'g'ridan-to'g'ri backendga yuboradi, bu faqat zaxira yo'l.
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p public && npm run build

# ---------------------------------------------------------------- 3. runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
