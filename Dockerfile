FROM node:17

RUN mkdir /src
RUN chown -R node /src
WORKDIR /src

COPY --chown=node package.json package-lock.json /src/
USER node
RUN lock_hash="$(shasum -a 256 package-lock.json)" && \
    npm install && \
    echo "$lock_hash" | shasum -c
COPY index.js /src/

CMD ["node", "index.js"]
