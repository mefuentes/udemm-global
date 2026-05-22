FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* tsconfig.json next.config.mjs tailwind.config.ts postcss.config.js ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
