#!/bin/bash -e

export STEP_ARTIFACT_URL="%%stepArtifactUrl%%"
export RUN_ARTIFACT_URL="%%runArtifactUrl%%"
export STEP_ARTIFACT_NAME="%%stepArtifactName%%"
export RUN_ARTIFACT_NAME="%%runArtifactName%%"
export STEP_WORKSPACE_DIR="%%stepWorkspaceDir%%"
export RUN_WORKSPACE_DIR="%%runWorkspaceDir%%"

upload_step_artifacts() {
  if [ -z "$STEP_ARTIFACT_URL" ]; then
    echo "No step artifact storage available."
    return 0
  fi

  local archive_file="$STEP_WORKSPACE_DIR/$STEP_ARTIFACT_NAME"

  tar -czf $archive_file -C $STEP_WORKSPACE_DIR/upload .

  echo 'Saving step artifacts'
  curl \
    -s \
    --connect-timeout 60 \
    --max-time 120 \
    -XPUT "$STEP_ARTIFACT_URL" \
    -T "$archive_file"

  echo 'Saved step artifacts'

  rm $archive_file
}

upload_run_state() {
  if [ -z "$RUN_ARTIFACT_URL" ]; then
    echo "No run state storage available."
    return 0
  fi

  local archive_file="$STEP_WORKSPACE_DIR/$RUN_ARTIFACT_NAME"

  if [ -z "$(ls -A $RUN_WORKSPACE_DIR)" ]; then
    echo "Run state is empty."
  fi

  tar -czf $archive_file -C $RUN_WORKSPACE_DIR .

  echo 'Saving run state'
  curl \
    -s \
    --connect-timeout 60 \
    --max-time 120 \
    -XPUT "$RUN_ARTIFACT_URL" \
    -T "$archive_file"

  echo 'Saved run state'

  rm $archive_file
}

upload_step_artifacts
upload_run_state
