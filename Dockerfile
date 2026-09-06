FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev --no-audit

COPY dist ./dist
COPY index.html ./
COPY openapi.yaml ./
COPY public ./public

EXPOSE 3000
CMD ["node", "dist/server.js"]
