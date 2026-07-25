FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY server/package.json server/package.json
RUN npm ci --workspace=server
COPY server ./server
RUN npx prisma generate --schema=server/prisma/schema.prisma
RUN npm run build --workspace=server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY server/package.json server/package.json
RUN npm ci --omit=dev --workspace=server
COPY server/prisma ./server/prisma
RUN npx prisma generate --schema=server/prisma/schema.prisma
COPY --from=build /app/server/dist ./server/dist
WORKDIR /app/server
EXPOSE 8085
CMD ["node", "dist/index.js"]
