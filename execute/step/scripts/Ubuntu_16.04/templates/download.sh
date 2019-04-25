#!/bin/bash -e

export ARTIFACT_URL="%%artifactUrl%%"
export ARTIFACT_NAME="%%artifactName%%"
export STEP_WORKSPACE_DIR="%%stepWorkspaceDir%%"

download_artifacts() {
  local ARCHIVE_FILE="$STEP_WORKSPACE_DIR/$ARTIFACT_NAME"

  echo 'Downloading artifacts'
  curl \
    -s \
    --connect-timeout 60 \
    --max-time 120 \
    -XGET "$ARTIFACT_URL" \
    -o "$ARCHIVE_FILE"

  tar -xzf $ARCHIVE_FILE -C $STEP_WORKSPACE_DIR/download
  rm $ARCHIVE_FILE
}

download_artifacts
