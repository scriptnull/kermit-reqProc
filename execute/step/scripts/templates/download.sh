#!/bin/bash -e

export STEP_ARTIFACT_URL="%%stepArtifactUrl%%"
export STEP_ARTIFACT_URL_OPTS="%%stepArtifactUrlOpts%%"
export STEP_ARTIFACT_NAME="%%stepArtifactName%%"
export STEP_WORKSPACE_DIR="%%stepWorkspaceDir%%"
export RUN_ARTIFACT_URL="%%runArtifactUrl%%"
export RUN_ARTIFACT_URL_OPTS="%%runArtifactUrlOpts%%"
export RUN_ARTIFACT_HEAD_URL="%%runArtifactHeadUrl%%"
export RUN_ARTIFACT_HEAD_URL_OPTS="%%runArtifactHeadUrlOpts%%"
export RUN_ARTIFACT_NAME="%%runArtifactName%%"
export RUN_WORKSPACE_DIR="%%runWorkspaceDir%%"
export PIPELINE_ARTIFACT_URL="%%pipelineArtifactUrl%%"
export PIPELINE_ARTIFACT_URL_OPTS="%%pipelineArtifactUrlOpts%%"
export PIPELINE_ARTIFACT_NAME="%%pipelineArtifactName%%"
export PIPELINE_WORKSPACE_DIR="%%pipelineWorkspaceDir%%"

download_step_artifacts() {
  if [ -z "$STEP_ARTIFACT_URL" ]; then
    echo "No step artifacts found."
    return 0
  fi
  local archive_file="$STEP_WORKSPACE_DIR/$STEP_ARTIFACT_NAME"

  echo 'Downloading step artifacts'

  local get_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -XGET '$STEP_ARTIFACT_URL' \
      -o $archive_file"

  if [ ! -z "$STEP_ARTIFACT_URL_OPTS" ]; then
    get_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      $STEP_ARTIFACT_URL_OPTS \
      -XGET '$STEP_ARTIFACT_URL' \
      -o $archive_file"
  fi

  eval "$get_cmd"

  tar -xzf $archive_file -C $STEP_WORKSPACE_DIR/download
  rm $archive_file
  echo 'Downloaded step artifacts'
}

download_run_state() {
  if [ -z "$RUN_ARTIFACT_URL" ]; then
    echo "No run state found."
    return 0
  fi

  local archive_file="$STEP_WORKSPACE_DIR/$RUN_ARTIFACT_NAME"

  if [ ! -z "$(ls -A $RUN_WORKSPACE_DIR)" ]; then
    echo "Clearing run state directory."
    rm -rf $RUN_WORKSPACE_DIR/*
  fi

  local check_artifact_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -o /dev/null \
      -w \"%{http_code}\" \
      --head '$RUN_ARTIFACT_HEAD_URL'"

  if [ ! -z "$RUN_ARTIFACT_HEAD_URL_OPTS" ]; then
    check_artifact_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -o /dev/null \
      -w \"%{http_code}\" \
      $RUN_ARTIFACT_HEAD_URL_OPTS \
      --head '$RUN_ARTIFACT_HEAD_URL'"
  fi

  local check_artifact=$(eval $check_artifact_cmd)

  if [ $check_artifact -eq 200 ]; then
    echo 'Downloading run state'

    local download_cmd="curl \
        -s \
        --connect-timeout 60 \
        --max-time 120 \
        -XGET '$RUN_ARTIFACT_URL' \
        -o $archive_file"

    if [ ! -z "$RUN_ARTIFACT_URL_OPTS" ]; then
      download_cmd="curl \
        -s \
        --connect-timeout 60 \
        --max-time 120 \
        $RUN_ARTIFACT_URL_OPTS \
        -XGET '$RUN_ARTIFACT_URL' \
        -o $archive_file"
    fi

    eval "$download_cmd"

    tar -xzf $archive_file -C $RUN_WORKSPACE_DIR
    rm $archive_file
    echo 'Downloaded run state'
  else
    echo 'No previous run state'
  fi
}

download_pipeline_state() {
  if [ -z "$PIPELINE_ARTIFACT_URL" ]; then
    echo "No pipeline state found."
    return 0
  fi

  local archive_file="$STEP_WORKSPACE_DIR/$PIPELINE_ARTIFACT_NAME"

  if [ ! -z "$(ls -A $PIPELINE_WORKSPACE_DIR)" ]; then
    echo "Clearing pipeline state directory."
    rm -rf $PIPELINE_WORKSPACE_DIR/*
  fi

  echo 'Downloading pipeline state'

  local download_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      -XGET '$PIPELINE_ARTIFACT_URL' \
      -o $archive_file"

  if [ ! -z "$PIPELINE_ARTIFACT_URL_OPTS" ]; then
    download_cmd="curl \
      -s \
      --connect-timeout 60 \
      --max-time 120 \
      $PIPELINE_ARTIFACT_URL_OPTS \
      -XGET '$PIPELINE_ARTIFACT_URL' \
      -o $archive_file"
  fi

  eval "$download_cmd"

  tar -xzf $archive_file -C $PIPELINE_WORKSPACE_DIR
  rm $archive_file
  echo 'Downloaded pipeline state'

  if [ -z "$(ls -A $PIPELINE_WORKSPACE_DIR)" ]; then
    echo "Pipeline state is empty."
  else
    for file in $PIPELINE_WORKSPACE_DIR/*; do
      md5sum $file
    done > $STEP_WORKSPACE_DIR/checksums.txt

    cat $STEP_WORKSPACE_DIR/checksums.txt | sort > $STEP_WORKSPACE_DIR/pipelineStateChecksums.txt
    rm $STEP_WORKSPACE_DIR/checksums.txt
  fi
}

download_step_artifacts
download_run_state
download_pipeline_state
