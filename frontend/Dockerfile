FROM node:20-bookworm-slim

# shared/ first so the production build can resolve ../shared imports.
WORKDIR /app/shared
COPY shared/package*.json ./
RUN npm install --omit=dev
COPY shared ./

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

EXPOSE 3005
CMD ["npm", "start"]
