#!/usr/bin/with-contenv bashio

# Projects and their items are kept in the add-on's persistent /data folder
export STATE_FILE="/data/tracker.json"
# Must match ingress_port in config.yaml
export PORT=3200

bashio::log.info "Starting Project Tracker on port ${PORT}..."
exec node /app/src/server.js
