#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/web-ext-artifacts"

# 用法：
#   ./build_xpi.sh
#   ./build_xpi.sh ./src/manifest.json
#   ./build_xpi.sh /absolute/path/to/manifest.json
MANIFEST_PATH="${1:-${ROOT_DIR}/src/manifest.json}"

# 轉成絕對路徑
if [[ ! "${MANIFEST_PATH}" = /* ]]; then
    MANIFEST_PATH="${ROOT_DIR}/${MANIFEST_PATH}"
fi

MANIFEST_PATH="$(realpath "${MANIFEST_PATH}")"

if [[ ! -f "${MANIFEST_PATH}" ]]; then
    echo "Error: manifest.json not found: ${MANIFEST_PATH}" >&2
    exit 1
fi

if [[ "$(basename "${MANIFEST_PATH}")" != "manifest.json" ]]; then
    echo "Error: target file must be manifest.json: ${MANIFEST_PATH}" >&2
    exit 1
fi

SOURCE_DIR="$(dirname "${MANIFEST_PATH}")"
mkdir -p "${ARTIFACT_DIR}"

web-ext build \
    --overwrite-dest \
    --source-dir "${SOURCE_DIR}" \
    --artifacts-dir "${ARTIFACT_DIR}"

ZIP_PATH="$(ls -1t "${ARTIFACT_DIR}"/*.zip | head -n 1)"
if [[ -z "${ZIP_PATH}" ]]; then
    echo "Error: build succeeded but no zip artifact was found." >&2
    exit 1
fi

XPI_PATH="${ZIP_PATH%.zip}.xpi"
cp -f "${ZIP_PATH}" "${XPI_PATH}"

echo "Manifest: ${MANIFEST_PATH}"
echo "Source dir: ${SOURCE_DIR}"
echo "Built:"
echo "  ${ZIP_PATH}"
echo "  ${XPI_PATH}"
