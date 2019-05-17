#!/bin/bash -e

export STEP_ARTIFACT_URL="%%stepArtifactUrl%%"
export STEP_ARTIFACT_URL_OPTS='%%stepArtifactUrlOpts%%'
export RUN_ARTIFACT_URL="%%runArtifactUrl%%"
export RUN_ARTIFACT_URL_OPTS='%%runArtifactUrlOpts%%'
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

  env
  echo "----"
  echo "$STEP_ARTIFACT_URL_OPTS"
  if [ -z "$STEP_ARTIFACT_URL_OPTS" ]; then
    echo "uploading with basic auth"
    curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -XPUT "$STEP_ARTIFACT_URL" \
      -T "$archive_file"
  else
    echo "uploading with artifactory creds"
    curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      "$STEP_ARTIFACT_URL_OPTS" \
      -XPUT "$STEP_ARTIFACT_URL" \
      -T "$archive_file"
  fi

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

  if [ -z "$RUN_ARTIFACT_URL_OPTS" ]; then
    echo "uploading with basic auth"
    curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -XPUT "$RUN_ARTIFACT_URL" \
      -T "$archive_file"
  else
    echo "uploading with artifactory creds"
    curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      "$RUN_ARTIFACT_URL_OPTS" \
      -XPUT "$RUN_ARTIFACT_URL" \
      -T "$archive_file"
  fi

  echo 'Saved run state'

  rm $archive_file
}

upload_step_artifacts
upload_run_state
