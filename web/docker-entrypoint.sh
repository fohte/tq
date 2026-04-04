#!/bin/sh
set -eu

# Only substitute explicitly listed variables to avoid breaking nginx variables ($host, $uri, etc.)
# Single quotes are intentional; envsubst needs literal variable names
# shellcheck disable=SC2016
envsubst '${API_BACKEND_URL} ${NGINX_RESOLVER}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
