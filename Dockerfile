# Imagen del simulador: Node ejecuta el TypeScript sin compilar (≥ 22.18), así
# que basta con las dependencias y el código. Nada de claves dentro: llegan por
# entorno al arrancar (ver compose.yaml).
FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY test ./test

# Sin root: el simulador no necesita más que red.
USER node

CMD ["npm", "start"]
