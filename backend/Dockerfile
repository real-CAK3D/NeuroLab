FROM node:20-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install
WORKDIR /app
COPY backend ./backend
COPY shared ./shared
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/backend
EXPOSE 3006
CMD ["npm", "start"]
