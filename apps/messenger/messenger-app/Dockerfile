FROM nginx:alpine

# 1. Install envsubst for config injection
RUN apk add --no-cache gettext

# 2. Copy the Template for NGINX Variable Injection
COPY apps/messenger/messenger-app/nginx.conf.template /etc/nginx/templates/default.conf.template

# 3. Copy the PRE-BUILT artifacts
# We use the path defined in your project.json's "serve-static" target
COPY dist/apps/messenger/messenger-app/browser /usr/share/nginx/html

EXPOSE 8080

# 4. Startup Command
# Injects env vars into the template and writes the final config
# CMD ["/bin/sh", "-c", "envsubst '${IDENTITY_SERVICE_URL} ${KEY_SERVICE_URL} ${ROUTING_SERVICE_URL} ${WSS_URL} ${NOTIFICATION_SERVICE_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
# 4. Startup Command
# Added: ${NGINX_LOG_LEVEL}
CMD ["/bin/sh", "-c", "envsubst '${IDENTITY_SERVICE_URL} ${KEY_SERVICE_URL} ${ROUTING_SERVICE_URL} ${WSS_URL} ${NOTIFICATION_SERVICE_URL} ${NGINX_LOG_LEVEL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]