FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npx prisma generate
EXPOSE 8085
CMD ["npx", "tsx", "src/index.ts"]
