# Use the official Node.js image as the base image
FROM node:22

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port the server will run on
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
