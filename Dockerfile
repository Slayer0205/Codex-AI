FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=network_ca \
    if [ -s /run/secrets/network_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/network_ca; fi; npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY package*.json ./
# tsx is required at runtime for the typed API and bot.
RUN --mount=type=secret,id=network_ca \
    if [ -s /run/secrets/network_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/network_ca; fi; npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/bot ./bot
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3001 3002
CMD ["npm", "start"]
