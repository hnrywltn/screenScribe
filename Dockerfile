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

# NEXT_PUBLIC_* vars are inlined at build time, not read at runtime — so
# these must already be set on the Railway service before this step
# runs, not just present at container start.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
