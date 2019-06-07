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
      -s -S \
      --connect-timeout 60 \
      --max-time 120 \
      -XPUT '$STEP_ARTIFACT_URL' \
      -o /dev/null \
      -w \"%{http_code}\" \
      -T $archive_file"

  if [ ! -z "$STEP_ARTIFACT_URL_OPTS" ]; then
    put_cmd="curl \
      -s -S \
      --connect-timeout 60 \
      --max-time 120 \
      $STEP_ARTIFACT_URL_OPTS \
      -XPUT '$STEP_ARTIFACT_URL' \
      -o /dev/null \
      -w \"%{http_code}\" \
      -T $archive_file"
  fi

  local put_status_code=$(eval "$put_cmd")

  if [ "$put_status_code" -ge 200 ] && [ "$put_status_code" -le 299 ]; then
    echo 'Saved step artifacts'
  else
    echo "Failed to save step artifacts. Status code $put_status_code."
    return 1
  fi

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
      -s -S \
      --connect-timeout 60 \
      --max-time 120 \
      -XPUT '$RUN_ARTIFACT_URL' \
      -o /dev/null \
      -w \"%{http_code}\" \
      -T $archive_file"

  if [ ! -z "$RUN_ARTIFACT_URL_OPTS" ]; then
    put_cmd="curl \
      -s -S \
      --connect-timeout 60 \
      --max-time 120 \
      $RUN_ARTIFACT_URL_OPTS \
      -XPUT '$RUN_ARTIFACT_URL' \
      -o /dev/null \
      -w \"%{http_code}\" \
      -T $archive_file"
  fi

  local put_status_code=$(eval "$put_cmd")

  if [ "$put_status_code" -ge 200 ] && [ "$put_status_code" -le 299 ]; then
    echo 'Saved run state'
  else
    echo "Failed to save run state. Status code $put_status_code."
    return 1
  fi

  rm $archive_file
}

upload_pipeline_state() {
  if [ -f "$STEP_WORKSPACE_DIR/pipelineArtifactName.txt" ]; then
    rm "$STEP_WORKSPACE_DIR/pipelineArtifactName.txt"
  fi

  if [ -z "$PIPELINE_ARTIFACT_URL" ]; then
    echo "No pipeline state storage available."
    return 0
  fi

  local archive_file="$STEP_WORKSPACE_DIR/$PIPELINE_ARTIFACT_NAME"

  if [ -z "$(ls -A $PIPELINE_WORKSPACE_DIR)" ]; then
    echo "Pipeline state is empty."
  else
    for file in $PIPELINE_WORKSPACE_DIR/*; do
      md5sum $file
    done > $STEP_WORKSPACE_DIR/checksums.txt

    cat $STEP_WORKSPACE_DIR/checksums.txt | sort > $STEP_WORKSPACE_DIR/pipelineStateChecksumsFinal.txt
    rm $STEP_WORKSPACE_DIR/checksums.txt
  fi

  local final_state_checksum=""
  local original_state_checksum=""
  if [ -f $STEP_WORKSPACE_DIR/pipelineStateChecksums.txt ]; then
    original_state_checksum=$(md5sum < $STEP_WORKSPACE_DIR/pipelineStateChecksums.txt)
  fi
  if [ -f $STEP_WORKSPACE_DIR/pipelineStateChecksumsFinal.txt ]; then
    final_state_checksum=$(md5sum < $STEP_WORKSPACE_DIR/pipelineStateChecksumsFinal.txt)
  fi

  if [ "$original_state_checksum" == "$final_state_checksum" ]; then
    echo "Pipeline state unchanged"
  else

    tar -czf $archive_file -C $PIPELINE_WORKSPACE_DIR .

    echo 'Saving pipeline state'

    local put_cmd="curl \
        -s -S \
        --connect-timeout 60 \
        --max-time 120 \
        -XPUT '$PIPELINE_ARTIFACT_URL' \
        -o /dev/null \
        -w \"%{http_code}\" \
        -T $archive_file"

    if [ ! -z "$PIPELINE_ARTIFACT_URL_OPTS" ]; then
      put_cmd="curl \
        -s -S \
        --connect-timeout 60 \
        --max-time 120 \
        $PIPELINE_ARTIFACT_URL_OPTS \
        -XPUT '$PIPELINE_ARTIFACT_URL' \
        -o /dev/null \
        -w \"%{http_code}\" \
        -T $archive_file"
    fi

    local put_status_code=$(eval "$put_cmd")

    if [ "$put_status_code" -ge 200 ] && [ "$put_status_code" -le 299 ]; then
      echo 'Saved pipeline state'
    else
      echo "Failed to save pipeline state. Status code $put_status_code."
      return 1
    fi

    echo "$PIPELINE_ARTIFACT_NAME" > "$STEP_WORKSPACE_DIR/pipelineArtifactName.txt"

    rm $archive_file
  fi
}

upload_step_artifacts
upload_run_state
upload_pipeline_state
