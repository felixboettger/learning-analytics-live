# syntax=docker/dockerfile:1

FROM node:18-alpine as base

ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]

from base as npm

RUN npm install --production

COPY . .

CMD ["node", "server.js"]