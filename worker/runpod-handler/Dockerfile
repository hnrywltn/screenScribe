# RunPod Serverless image — GPU-accelerated replacement for the relevant
# half of ../Dockerfile (transcode + scene detection + transcription
# only; no Postgres/pg-boss/email here, see handler.py's header comment).
#
# Neither ffmpeg's apt package nor whisper.cpp support what's needed out
# of the box (Ubuntu's ffmpeg build isn't compiled with NVENC/CUVID;
# whisper.cpp isn't apt-installable at all, same reason ../Dockerfile
# already compiles it from source) — both are built from source here
# against the CUDA toolkit instead.
#
# Base images are NVIDIA's official CUDA images, not node:22-slim like
# ../Dockerfile — this container only needs Python (the RunPod SDK is
# Python-first) plus compiled binaries, no Node runtime at all.
#
# NOT YET VERIFIED against a real RunPod GPU build — no NVIDIA GPU on the
# dev machine to test the CUDA/NVENC path locally. Treat the first real
# RunPod build+invocation as the actual test.

FROM nvidia/cuda:12.4.1-devel-ubuntu22.04 AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential cmake git pkg-config yasm nasm curl ca-certificates zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# nv-codec-headers: just the headers ffmpeg's ./configure needs to detect
# NVENC/NVDEC/CUVID support. The actual encode/decode libraries
# (libnvidia-encode.so etc.) ship with the host's NVIDIA driver and get
# mounted into the container by RunPod at runtime — nothing to install
# for those here.
RUN git clone --depth 1 --branch n12.2.72.0 \
       https://github.com/FFmpeg/nv-codec-headers.git /nv-codec-headers \
    && make -C /nv-codec-headers install

# Installed to its own prefix (not /usr/local, which the base image
# already partially populates with CUDA toolkit files) so the whole
# directory can be copied cleanly into the runtime stage in one COPY,
# shared libs included, rather than hunting down every .so ffmpeg needs.
RUN git clone --depth 1 --branch n7.1 https://github.com/FFmpeg/FFmpeg.git /ffmpeg
WORKDIR /ffmpeg
RUN ./configure \
      --prefix=/opt/ffmpeg \
      --enable-nonfree \
      --enable-cuda-nvcc \
      --enable-nvenc \
      --enable-cuvid \
      --enable-libnpp \
      --enable-zlib \
      --extra-cflags=-I/usr/local/cuda/include \
      --extra-ldflags=-L/usr/local/cuda/lib64 \
      --disable-doc \
    && make -j"$(nproc)" \
    && make install

# Static linking (BUILD_SHARED_LIBS=OFF) so the runtime stage only needs
# one binary for whisper.cpp — same reasoning ../Dockerfile already uses.
# GGML_CUDA=ON is the actual point: whisper.cpp offloads to the GPU
# automatically once built this way, no extra runtime flag needed.
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp /whisper.cpp
WORKDIR /whisper.cpp
RUN cmake -B build -DGGML_CUDA=ON -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release -j"$(nproc)"

# Same q5_0-quantized `medium` model as the CPU worker — see CLAUDE.md
# "Decided: transcription". Not re-evaluating model/quantization choice
# here, just carrying it over to the GPU path.
RUN mkdir -p /models \
    && curl -L -o /models/ggml-medium-q5_0.bin \
       https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin

FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 python3-pip ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Whole ffmpeg install tree (bin + the shared libs it built against,
# libavcodec etc.) — it wasn't built statically, unlike whisper.cpp,
# since a fully static NVENC/CUVID build is a much deeper rabbit hole
# than this needed to go down for a first working version.
COPY --from=builder /opt/ffmpeg /usr/local
RUN ldconfig

COPY --from=builder /whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=builder /models/ggml-medium-q5_0.bin /app/models/ggml-medium-q5_0.bin

WORKDIR /app
# RunPod's GitHub-deploy build uses the repo root as the build context,
# not this directory — even though the Dockerfile itself lives here —
# so these paths have to be spelled out from the repo root, unlike
# ../Dockerfile's plain `COPY . .` (Railway lets you set worker/ as the
# service's own root directory, so its context really is worker/).
# Confirmed empirically: the bare `COPY handler.py .` version failed
# RunPod's build with "/handler.py": not found.
COPY worker/runpod-handler/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt
COPY worker/runpod-handler/handler.py .

ENV WHISPER_MODEL_PATH=/app/models/ggml-medium-q5_0.bin
ENV WHISPER_BINARY=whisper-cli

CMD ["python3", "-u", "handler.py"]
