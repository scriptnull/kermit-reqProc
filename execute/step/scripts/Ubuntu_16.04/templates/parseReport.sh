#!/bin/bash -e
exec_cmd() {
  cmd=$@
  cmd_uuid=$(cat /proc/sys/kernel/random/uuid)
  cmd_start_timestamp=`date +"%s"`
  echo "__SH__CMD__START__|{\"type\":\"cmd\",\"sequenceNumber\":\"$cmd_start_timestamp\",\"id\":\"$cmd_uuid\"}|$cmd"
  eval "$cmd"
  cmd_status=$?
  if [ "$2" ]; then
    echo $2;
  fi

  cmd_end_timestamp=`date +"%s"`
  # If cmd output has no newline at end, marker parsing
  # would break. Hence force a newline before the marker.
  echo ""
  echo "__SH__CMD__END__|{\"type\":\"cmd\",\"sequenceNumber\":\"$cmd_start_timestamp\",\"id\":\"$cmd_uuid\",\"exitcode\":\"$cmd_status\"}|$cmd"
  return $cmd_status
}

export STEP_WORKSPACE_DIR="%%stepWorkspaceDir%%"

parse_test_reports() {
  exec_cmd "echo 'Parsing test reports'"

  local reports_dir=$STEP_WORKSPACE_DIR/upload/tests

  if [ ! -d $reports_dir ] || [ -z "$(ls -A $reports_dir)" ]; then
    echo "No test reports found."
    return 0
  fi

  local parse_tests="/pipelines/reports/reports \
    --destination $STEP_WORKSPACE_DIR \
    tests \
    --source $reports_dir"
  exec_cmd "$parse_tests"
}

exec_cmd parse_test_reports
