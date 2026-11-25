FROM node:lts-alpine
WORKDIR /usr/src/gateway
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
USER node
EXPOSE 4000
CMD ["npm", "start"]