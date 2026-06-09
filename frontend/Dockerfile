FROM node:20-bookworm-slim

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
COPY shared ../shared
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/frontend
EXPOSE 3005
CMD ["npm", "start"]
