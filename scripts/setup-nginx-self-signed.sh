#!/bin/bash
# Example Run: export DOMAIN_NAME="example.com" && sudo ./scripts/setup-nginx-self-signed.sh

set -e

CERT_DIR="/etc/ssl/private"
CERT_NAME="nginx-selfsigned-$(date +%F)"
CERT_DAYS=365
NGINX_SNIPPETS_DIR="/etc/nginx/snippets"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
DEFAULT_SITE_CONF="${NGINX_SITES_AVAILABLE}/default"
SSL_CERT_PATH="${CERT_DIR}/${CERT_NAME}.crt"
SSL_KEY_PATH="${CERT_DIR}/${CERT_NAME}.key"
DHPARAM_PATH="${CERT_DIR}/dhparam.pem"
DHPARAM_BITS=2048

if [ -z "$DOMAIN_NAME" ]; then
    echo "[ERROR] DOMAIN_NAME environment variable is not set. Please set it (e.g., export DOMAIN_NAME=\"example.com\")." >&2
    exit 1
fi
TARGET_DOMAIN_NAME="${DOMAIN_NAME}"
NGINX_SN="${NGINX_SERVER_NAME:-$TARGET_DOMAIN_NAME}"
PROXY_PASS_URL="${PROXY_TARGET:-http://127.0.0.1:8085}"
CERT_C="${CERT_COUNTRY:-US}"
CERT_ST="${CERT_STATE:-State}"
CERT_L="${CERT_LOCALITY:-City}"
CERT_O="${CERT_ORG:-Organization}"
CERT_OU="${CERT_OU:-OrgUnit}"

log_info() {
    echo "[INFO] $1"
}

log_warning() {
    echo "[WARNING] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Command '$1' not found. Please install it."
        return 1
    fi
    return 0
}

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        log_error "This script must be run as root. Use sudo."
        exit 1
    fi
}

install_package() {
    local package_name="$1"
    if ! dpkg -s "$package_name" &> /dev/null; then
        log_info "'$package_name' not found. Attempting installation..."
        log_info "Note: Ensure HTTP_PROXY/HTTPS_PROXY and DEBIAN_FRONTEND=noninteractive environment variables are set if required."
        export DEBIAN_FRONTEND=${DEBIAN_FRONTEND:-noninteractive}
        apt-get update -q || { log_error "apt-get update failed."; exit 1; }
        apt-get install -y -q "$package_name" || { log_error "Failed to install '$package_name'."; exit 1; }
        log_info "'$package_name' installed successfully."
    else
        log_info "'$package_name' is already installed."
    fi
}

check_root

log_info "Starting Nginx self-signed cert & reverse proxy setup..."
log_info "Target Domain (for Cert CN): ${TARGET_DOMAIN_NAME}"
log_info "Nginx Server Name:           ${NGINX_SN}"
log_info "Proxy Target:                ${PROXY_PASS_URL}"

install_package "openssl"
install_package "nginx"

if [ ! -d "$CERT_DIR" ]; then
    log_info "Creating certificate directory: ${CERT_DIR}"
    mkdir -p "$CERT_DIR"
    chmod 700 "$CERT_DIR"
fi

if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
    log_warning "Certificate and key files exist for today's date: ${CERT_NAME}.*"
    log_warning "Skipping generation. Delete manually to regenerate."
else
    log_info "Generating self-signed certificate and private key..."
    SUBJECT="/C=${CERT_C}/ST=${CERT_ST}/L=${CERT_L}/O=${CERT_O}/OU=${CERT_OU}/CN=${TARGET_DOMAIN_NAME}"
    log_info "Using certificate subject: ${SUBJECT}"
    openssl req -x509 -nodes -days "$CERT_DAYS" -newkey rsa:2048 \
        -keyout "$SSL_KEY_PATH" \
        -out "$SSL_CERT_PATH" \
        -subj "${SUBJECT}" || \
        { log_error "Failed to generate certificate/key."; exit 1; }
    chmod 600 "$SSL_KEY_PATH"
    log_info "Certificate and key generated successfully."
fi

if [ -f "$DHPARAM_PATH" ]; then
    log_warning "DH parameters file already exists at ${DHPARAM_PATH}. Skipping generation."
else
    log_info "Generating Diffie-Hellman parameters (${DHPARAM_BITS} bits)... This may take a while."
    openssl dhparam -out "$DHPARAM_PATH" "$DHPARAM_BITS" || \
        { log_error "Failed to generate DH parameters."; exit 1; }
    log_info "DH parameters generated successfully."
fi

log_info "Creating Nginx SSL snippets..."
mkdir -p "$NGINX_SNIPPETS_DIR"

cat > "${NGINX_SNIPPETS_DIR}/self-signed.conf" << EOF
ssl_certificate ${SSL_CERT_PATH};
ssl_certificate_key ${SSL_KEY_PATH};
EOF
log_info "Created ${NGINX_SNIPPETS_DIR}/self-signed.conf"

cat > "${NGINX_SNIPPETS_DIR}/ssl-params.conf" << EOF
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_dhparam ${DHPARAM_PATH};
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
EOF
log_info "Created ${NGINX_SNIPPETS_DIR}/ssl-params.conf"

log_info "Configuring default Nginx site (${DEFAULT_SITE_CONF}) as HTTPS reverse proxy..."

if [ -f "$DEFAULT_SITE_CONF" ]; then
    cp "$DEFAULT_SITE_CONF" "${DEFAULT_SITE_CONF}.bak_$(date +%F_%T)"
    log_info "Backed up original config to ${DEFAULT_SITE_CONF}.bak_$(date +%F_%T)"
fi

cat > "$DEFAULT_SITE_CONF" << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${NGINX_SN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name ${NGINX_SN};

    include ${NGINX_SNIPPETS_DIR}/self-signed.conf;
    include ${NGINX_SNIPPETS_DIR}/ssl-params.conf;

    location / {
        proxy_pass ${PROXY_PASS_URL};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
EOF
log_info "Configured ${DEFAULT_SITE_CONF} for HTTPS reverse proxy."

if [ ! -L "${NGINX_SITES_ENABLED}/default" ]; then
    log_info "Enabling default site..."
    rm -f "${NGINX_SITES_ENABLED}/default"
    ln -s "$DEFAULT_SITE_CONF" "${NGINX_SITES_ENABLED}/default" || \
        { log_error "Failed to symbolically link default site."; exit 1; }
else
    log_info "Default site already enabled."
fi

log_info "Testing Nginx configuration..."
nginx -t || { log_error "Nginx configuration test failed. Please check config files."; exit 1; }
log_info "Nginx configuration test successful."

log_info "Reloading Nginx service..."
systemctl reload nginx || { log_error "Failed to reload Nginx."; exit 1; }
log_info "Nginx reloaded successfully."

log_info "-----------------------------------------------------"
log_info "Setup complete! Nginx should be acting as an HTTPS reverse proxy."
log_info "Domain:      https://${TARGET_DOMAIN_NAME}"
log_info "Proxy Target: ${PROXY_PASS_URL}"
log_info "Certificate:  ${SSL_CERT_PATH}"
log_info "Key:          ${SSL_KEY_PATH}"
log_info "Nginx Conf:   ${DEFAULT_SITE_CONF}"
log_warning "Browsers will show a warning for self-signed certificates. This is expected."
log_warning "Ensure your application is running on ${PROXY_PASS_URL}."
log_warning "Ensure DNS or your local hosts file points '${TARGET_DOMAIN_NAME}' to this server's IP address."
log_info "-----------------------------------------------------"

exit 0