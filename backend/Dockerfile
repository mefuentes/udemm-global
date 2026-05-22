FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* tsconfig.json tsconfig.build.json ./
RUN npm install

COPY prisma ./prisma
COPY src ./src

RUN npm run build

EXPOSE 5000
CMD ["node", "dist/main.js"]
