# Use the official Node.js image as the base image
FROM node:22-alpine

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

# Expose the port the server will run on
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
