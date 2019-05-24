#!/bin/bash -e

export STEP_WORKSPACE_DIR="%%stepWorkspaceDir%%"
export BASE_DIR="%%baseDir%%"

parse_test_reports() {
  echo 'Parsing test reports'

  local reports_dir=$STEP_WORKSPACE_DIR/upload/tests

  if [ ! -d $reports_dir ] || [ -z "$(ls -A $reports_dir)" ]; then
    echo "No test reports found."
    return 0
  fi

  $BASE_DIR/reports/reports \
    --destination $STEP_WORKSPACE_DIR \
    tests \
    --source $reports_dir
}

parse_test_reports
