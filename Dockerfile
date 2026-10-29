FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3000
# web: sincroniza o schema e sobe o site. (worker: sobrescreva o comando para "npm run worker")
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -p ${PORT:-3000}"]
