#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$project_root/llama.cpp"
build_dir="$source_dir/build-folio-macos-arm64"
runtime_dir="$project_root/resources/llama/darwin-arm64"

cmake -S "$source_dir" -B "$build_dir" \
  -DGGML_METAL=ON \
  -DGGML_METAL_EMBED_LIBRARY=ON \
  -DGGML_NATIVE=OFF \
  -DLLAMA_OPENSSL=OFF \
  -DLLAMA_BUILD_UI=OFF \
  -DBUILD_SHARED_LIBS=OFF
cmake --build "$build_dir" --target llama-server --config Release -j 4

mkdir -p "$runtime_dir"
cp "$build_dir/bin/llama-server" "$runtime_dir/llama-server"
chmod +x "$runtime_dir/llama-server"
