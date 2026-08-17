# Worker. Runs ffmpeg directly (transcode + scene detection) — see
# CLAUDE.md "Decided: pipeline orchestration" -> "ffmpeg wired up" — and
# whisper.cpp for transcription (see "Decided: transcription"). No
# Metal acceleration for either on this Linux container, unlike the Mac
# dev machine — CPU-only.
#
# whisper.cpp isn't apt-installable, so it's compiled from source in its
# own stage (build-essential/cmake/git only needed to build it, not at
# runtime) and only the resulting binary + model file get copied into
# the final image. Both stages use the same node:22-slim base so the
# compiled binary's glibc/libstdc++ dependencies match what's actually
# present at runtime.
FROM node:22-slim AS whisper-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp /whisper.cpp
WORKDIR /whisper.cpp
# Static linking (BUILD_SHARED_LIBS=OFF) so the final stage only needs
# to copy one binary, not hunt down libggml/libwhisper .so files too.
RUN cmake -B build -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release -j

# q5_0-quantized `medium` — see CLAUDE.md "Decided: transcription" for
# why this size/quantization (compared against q4_0 for accuracy before
# picking this one, both meeting the "faster than real-time" bar).
RUN mkdir -p /models \
    && curl -L -o /models/ggml-medium-q5_0.bin \
       https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin

FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=whisper-builder /whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper-builder /models/ggml-medium-q5_0.bin /app/models/ggml-medium-q5_0.bin

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV WHISPER_MODEL_PATH=/app/models/ggml-medium-q5_0.bin
CMD ["npm", "start"]
