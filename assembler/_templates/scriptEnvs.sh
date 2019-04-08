<% _.each(envs, function (value, key) { %>
export %%key%%='%%value%%'
<% }); %>
