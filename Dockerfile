# Use the official Node.js 20 LTS slim image as a base, which is optimized for size
FROM node:20-slim

# Create a directory inside the container and make it the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the rest of the application source code
COPY . .

# Expose the default port for Cloud Run (8080)
EXPOSE 8080

# Define the command to run the application
CMD [ "npm", "start" ]
