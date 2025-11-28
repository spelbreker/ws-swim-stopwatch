# Use the official Node.js image as the base image
FROM node:22-alpine

# Install cloudflared for Cloudflare Tunnel support
# Detect architecture and download the appropriate binary
RUN apk add --no-cache curl && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
        x86_64) ARCH_NAME="amd64" ;; \
        aarch64) ARCH_NAME="arm64" ;; \
        armv7l) ARCH_NAME="armhf" ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH_NAME}" -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared && \
    apk del curl

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm ci

# Copy the rest of the application files
COPY . .

# build the application
RUN npm run build

# Copy the entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose the port the server will run on
EXPOSE 8080

# Use entrypoint script to handle both modes
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command (can be overridden)
CMD ["npm", "start"]
