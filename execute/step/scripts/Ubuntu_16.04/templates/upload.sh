#!/bin/bash -e

export STEP_ARTIFACT_URL="%%stepArtifactUrl%%"
export STEP_ARTIFACT_URL_OPTS="%%stepArtifactUrlOpts%%"
export STEP_ARTIFACT_NAME="%%stepArtifactName%%"
export STEP_WORKSPACE_DIR="%%stepWorkspaceDir%%"
export RUN_ARTIFACT_URL="%%runArtifactUrl%%"
export RUN_ARTIFACT_URL_OPTS="%%runArtifactUrlOpts%%"
export RUN_ARTIFACT_NAME="%%runArtifactName%%"
export RUN_WORKSPACE_DIR="%%runWorkspaceDir%%"
export PIPELINE_ARTIFACT_URL="%%pipelineArtifactUrl%%"
export PIPELINE_ARTIFACT_URL_OPTS="%%pipelineArtifactUrlOpts%%"
export PIPELINE_ARTIFACT_NAME="%%pipelineArtifactName%%"
export PIPELINE_WORKSPACE_DIR="%%pipelineWorkspaceDir%%"

upload_step_artifacts() {
  if [ -z "$STEP_ARTIFACT_URL" ]; then
    echo "No step artifact storage available."
    return 0
  fi

  local archive_file="$STEP_WORKSPACE_DIR/$STEP_ARTIFACT_NAME"

  tar -czf $archive_file -C $STEP_WORKSPACE_DIR/upload .

  echo 'Saving step artifacts'

  local put_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -XPUT '$STEP_ARTIFACT_URL' \
      -T $archive_file"

  if [ ! -z "$STEP_ARTIFACT_URL_OPTS" ]; then
    put_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      $STEP_ARTIFACT_URL_OPTS \
      -XPUT '$STEP_ARTIFACT_URL' \
      -T $archive_file"
  fi

  eval "$put_cmd"

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

  local put_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -XPUT '$RUN_ARTIFACT_URL' \
      -T $archive_file"

  if [ ! -z "$RUN_ARTIFACT_URL_OPTS" ]; then
    put_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      $RUN_ARTIFACT_URL_OPTS \
      -XPUT '$RUN_ARTIFACT_URL' \
      -T $archive_file"
  fi

  eval "$put_cmd"

  echo 'Saved run state'

  rm $archive_file
}

upload_pipeline_state() {
  if [ -z "$PIPELINE_ARTIFACT_URL" ]; then
    echo "No pipeline state storage available."
    return 0
  fi

  local archive_file="$STEP_WORKSPACE_DIR/$PIPELINE_ARTIFACT_NAME"

  if [ -z "$(ls -A $PIPELINE_WORKSPACE_DIR)" ]; then
    echo "Pipeline state is empty."
  fi

  tar -czf $archive_file -C $PIPELINE_WORKSPACE_DIR .

  echo 'Saving pipeline state'

  local put_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -XPUT '$PIPELINE_ARTIFACT_URL' \
      -T $archive_file"

  if [ ! -z "$PIPELINE_ARTIFACT_URL_OPTS" ]; then
    put_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      $PIPELINE_ARTIFACT_URL_OPTS \
      -XPUT '$PIPELINE_ARTIFACT_URL' \
      -T $archive_file"
  fi

  eval "$put_cmd"

  echo 'Saved pipeline state'

  rm $archive_file
}

upload_step_artifacts
upload_run_state
upload_pipeline_state
