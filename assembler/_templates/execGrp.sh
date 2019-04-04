%%grp%%() {
ret=0
is_success=false

%%grpBody%%

[ "$ret" != 0 ] && return $ret;

is_success=true
}

trap before_exit EXIT
exec_grp "%%grp%%" "%%grpDesc%%" "%%grpVisibility%%"
