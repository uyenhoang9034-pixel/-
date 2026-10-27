FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=384 --expose-gc"

RUN apk add --no-cache fontconfig ttf-dejavu

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "--optimize-for-size", "src/app.js"]
