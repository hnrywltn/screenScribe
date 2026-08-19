# RunPod Serverless handler — the GPU-bound half of the pipeline only.
#
# Deliberately thin: this does NOT touch Postgres, charge/refund tokens,
# send email, or manage sessions.status — that orchestration stays in
# ../index.ts (see CLAUDE.md "Decided: pipeline orchestration"). This
# handler receives {"sessionId": "..."}, does the actual transcode/scene
# detection/transcription/zip/upload against B2, and returns success or
# raises — the TypeScript side is responsible for calling RunPod's API to
# kick this off and for interpreting the result (that dispatcher change
# is separate, not yet built).
#
# Required environment variables (set via the RunPod endpoint's template,
# not baked into the image — same B2 credentials the Node worker uses):
#   B2_ENDPOINT, B2_BUCKET_NAME, B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY
# WHISPER_MODEL_PATH / WHISPER_BINARY are set by the Dockerfile itself.
#
# Local test (no deploy needed): `python3 handler.py --test_input
# '{"input": {"sessionId": "..."}}'` — runpod's SDK supports this out of
# the box when the image is run locally with a GPU attached.
#
# NOT YET VERIFIED against a real RunPod GPU box — this Mac has no NVIDIA
# GPU to test the CUDA/NVENC path against locally, same "couldn't test
# ahead of the real deploy" position ../Dockerfile was in for whisper.cpp
# before its first real Railway build (see CLAUDE.md). Treat the first
# real RunPod invocation as the actual test, not this code review.

import glob
import os
import shutil
import subprocess
import zipfile

import boto3
import runpod
from botocore.config import Config

BUCKET = os.environ.get("B2_BUCKET_NAME", "")


def b2_client():
    endpoint = os.environ.get("B2_ENDPOINT", "")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{endpoint}" if endpoint else None,
        aws_access_key_id=os.environ.get("B2_APPLICATION_KEY_ID", ""),
        aws_secret_access_key=os.environ.get("B2_APPLICATION_KEY", ""),
        config=Config(s3={"addressing_style": "path"}),  # B2 needs path-style, not virtual-hosted
    )


def upload_prefix(session_id: str) -> str:
    return f"uploads/{session_id}/"


def download_zip_key(session_id: str) -> str:
    return f"downloads/{session_id}.zip"


def find_upload_key(s3, session_id: str) -> str:
    # Mirrors worker/lib/b2.ts's findUploadKey — the filename isn't known
    # ahead of time, so list the prefix instead of guessing the key.
    prefix = upload_prefix(session_id)
    res = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
    contents = res.get("Contents") or []
    if not contents:
        raise RuntimeError(f"no uploaded object found under {prefix}")
    return contents[0]["Key"]


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{cmd[0]} exited with {result.returncode}\n{result.stderr}")
    return result.stdout


def transcode_to_mp4(input_path: str, output_path: str) -> None:
    # h264_nvenc, not libx264 — the CPU worker's choice of libx264 was
    # specifically to keep encoder behavior identical between the Mac dev
    # machine and the (also CPU-only) Railway worker; that reasoning
    # doesn't apply here, and NVENC is the entire point of this handler
    # existing. -cq 23 is the NVENC analog of libx264's -crf 23, not
    # verified for visual-quality parity yet.
    run([
        "ffmpeg", "-y", "-i", input_path,
        "-c:v", "h264_nvenc", "-preset", "p4", "-cq", "23",
        "-c:a", "aac",
        "-movflags", "+faststart",
        output_path,
    ])


def extract_scene_frames(input_path: str, output_dir: str, threshold: float = 0.3) -> list[str]:
    # Identical to worker/lib/ffmpeg.ts's extractSceneFrames — this stays
    # a CPU-bound decode/diff either way, GPU doesn't change it. eq(n,0)
    # always keeps the first frame (confirmed empirically in the Node
    # version — without it the first slide is silently missing).
    os.makedirs(output_dir, exist_ok=True)
    pattern = os.path.join(output_dir, "screenshot-%04d.png")
    run([
        "ffmpeg", "-y", "-i", input_path,
        "-vf", f"select='eq(n\\,0)+gt(scene\\,{threshold})'",
        "-fps_mode", "vfr",
        pattern,
    ])
    return sorted(glob.glob(os.path.join(output_dir, "screenshot-*.png")))


def extract_audio_wav(input_path: str, output_path: str) -> None:
    run([
        "ffmpeg", "-y", "-i", input_path,
        "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
        output_path,
    ])


def transcribe_audio(wav_path: str) -> str:
    model_path = os.environ["WHISPER_MODEL_PATH"]
    binary = os.environ.get("WHISPER_BINARY", "whisper-cli")
    # No -t/thread flag here — with GGML_CUDA=ON (see ../Dockerfile),
    # whisper.cpp offloads to the GPU automatically, unlike the CPU
    # worker's whisper.ts which tunes WHISPER_THREADS.
    stdout = run([binary, "-m", model_path, "-f", wav_path, "-np"])
    transcript = stdout.strip()
    if not transcript:
        raise RuntimeError("whisper-cli produced an empty transcript")
    return transcript


def zip_results(work_dir: str, screenshot_paths: list[str], output_zip_path: str) -> None:
    # Same layout the download route / existing zips already ship —
    # video.mp4, transcript.txt, screenshots/screenshot-NNNN.png.
    with zipfile.ZipFile(output_zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.write(os.path.join(work_dir, "video.mp4"), "video.mp4")
        zf.write(os.path.join(work_dir, "transcript.txt"), "transcript.txt")
        for p in screenshot_paths:
            zf.write(p, f"screenshots/{os.path.basename(p)}")


def handler(event):
    job_input = event["input"]
    session_id = job_input["sessionId"]

    s3 = b2_client()
    work = f"/tmp/work/{session_id}"
    screenshots_dir = os.path.join(work, "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)

    try:
        upload_key = find_upload_key(s3, session_id)
        filename = upload_key.split("/")[-1]
        input_dir = os.path.join(work, "input")
        os.makedirs(input_dir, exist_ok=True)
        input_path = os.path.join(input_dir, filename)
        s3.download_file(BUCKET, upload_key, input_path)

        output_mp4 = os.path.join(work, "video.mp4")
        transcode_to_mp4(input_path, output_mp4)

        screenshot_paths = extract_scene_frames(input_path, screenshots_dir)

        transcript_path = os.path.join(work, "transcript.txt")
        try:
            audio_path = os.path.join(work, "audio.wav")
            extract_audio_wav(input_path, audio_path)
            transcript = transcribe_audio(audio_path)
            with open(transcript_path, "w") as f:
                f.write(transcript + "\n")
        except Exception as err:
            # Same "don't fail the whole job over transcription, say so
            # honestly instead" principle as index.ts's TS path — the
            # video and screenshots are still worth delivering.
            print(f"transcription failed for session {session_id}: {err}")
            with open(transcript_path, "w") as f:
                f.write(
                    "Transcription failed for this video — this is a known-error case, not a fake transcript.\n\n"
                    "Screenshots and the converted video are still included in this download.\n"
                )

        local_zip_path = os.path.join(work, "output.zip")
        zip_results(work, screenshot_paths, local_zip_path)

        s3.upload_file(
            local_zip_path, BUCKET, download_zip_key(session_id),
            ExtraArgs={"ContentType": "application/zip"},
        )

        # Mirrors index.ts: the raw upload has no reason to survive past
        # packaging.
        s3.delete_object(Bucket=BUCKET, Key=upload_key)

        return {"status": "complete", "sessionId": session_id}
    finally:
        shutil.rmtree(work, ignore_errors=True)


runpod.serverless.start({"handler": handler})
