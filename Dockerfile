FROM node:14

WORKDIR /usr/src/short

COPY . .
RUN npm install
RUN npm run compile

EXPOSE 9000

CMD [ "node", "dist/index.js" ]
