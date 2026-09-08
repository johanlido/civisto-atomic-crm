FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S civisto && adduser -S civisto -G civisto
COPY --from=build --chown=civisto:civisto /app/package.json ./
COPY --from=build --chown=civisto:civisto /app/node_modules ./node_modules
COPY --from=build --chown=civisto:civisto /app/dist ./dist

USER civisto
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/index.js"]
