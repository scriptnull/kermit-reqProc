#!/bin/bash -e

export ARTIFACT_URL="%%artifactUrl%%"
export ARTIFACT_NAME="%%artifactName%%"
export STEP_WORKSPACE_DIR="%%stepWorkspaceDir%%"

upload_report_files() {
  local ARCHIVE_FILE="$STEP_WORKSPACE_DIR/$ARTIFACT_NAME"

  tar -czf $ARCHIVE_FILE -C $STEP_WORKSPACE_DIR/upload .

  echo 'Saving artifacts'
  curl \
    -s \
    --connect-timeout 60 \
    --max-time 120 \
    -XPUT "$ARTIFACT_URL" \
    -T "$ARCHIVE_FILE"
}

upload_report_files
