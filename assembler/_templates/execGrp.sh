%%grp%%() {
trap before_exit EXIT

%%grpBody%%

ret=$?
if [ "$ret" != 0 ]; then
  is_success=false
  return $ret;
fi

is_success=true
}

<% if (callMethod) { %>
%%grp%%
<% } %>
