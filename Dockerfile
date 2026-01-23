FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY app/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY app/ ./

# Create data directory
RUN mkdir -p /data

ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["node", "server.js"]
