FROM node:20-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY websocket/package*.json ./websocket/
WORKDIR /app/websocket
RUN npm install
WORKDIR /app
COPY websocket ./websocket
COPY shared ./shared
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/websocket
EXPOSE 3007
CMD ["npm", "start"]
