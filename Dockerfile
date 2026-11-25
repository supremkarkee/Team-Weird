FROM node:lts-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

# DEV
# all deps, code mounted from machine, restarts on change
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# PROD
# runtime deps only, not root
FROM base AS prod
ENV NODE_ENV=production
RUN npm cli --omit=dev
COPY . .
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]