# Use the official Node.js image as the base image
FROM node:22-alpine

# Install cloudflared for Cloudflare Tunnel support
# Using the official cloudflared binary for Alpine Linux
RUN apk add --no-cache curl && \
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && \
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
