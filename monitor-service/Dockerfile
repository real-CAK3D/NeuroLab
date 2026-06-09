FROM node:20-bookworm-slim

WORKDIR /app/monitor-service
COPY monitor-service/package*.json ./
RUN npm install
COPY monitor-service ./
COPY shared ../shared
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/monitor-service
EXPOSE 3009
CMD ["npm", "start"]
