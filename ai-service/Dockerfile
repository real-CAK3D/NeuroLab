FROM node:20-bookworm-slim

WORKDIR /app/ai-service
COPY ai-service/package*.json ./
RUN npm install
COPY ai-service ./
COPY shared ../shared
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/ai-service
EXPOSE 3008
CMD ["npm", "start"]
