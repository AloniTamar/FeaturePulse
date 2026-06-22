FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npx prisma generate && npm prune --omit=dev
EXPOSE 3000
CMD ["node", "dist/index.js"]
