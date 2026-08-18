# Web app. Needs ffprobe (not just ffmpeg's transcoding half) for
# upload-time duration probing — see CLAUDE.md "Decided: token
# enforcement & expiry extension".
FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars are inlined at build time, not read at runtime.
# Railway passes service variables into `docker build` as build-args,
# but Docker silently discards any build-arg that isn't explicitly
# declared with ARG here — without this, the value never reaches
# `npm run build` even though it's genuinely set on the service, and
# Next.js quietly inlines `undefined` instead. Confirmed this was
# happening for real: a from-scratch rebuild (deleted deployment, no
# cache) still baked in `undefined` for NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# until this ARG was added, despite the var being correctly set on the
# Railway service the whole time.
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
