FROM node:20-alpine

WORKDIR /app

COPY package.json .

RUN npm install

COPY server.js .
COPY seed.js .

EXPOSE 5000

CMD ["npm", "start"]
