# Worker. Runs ffmpeg directly (transcode + scene detection) — see
# CLAUDE.md "Decided: pipeline orchestration" -> "ffmpeg wired up". No
# Metal acceleration here, CPU-only, unlike the Mac dev machine.
FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
CMD ["npm", "start"]
