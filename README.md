basic-photo-server
==================

`node`/`express` backend for receiving photos sent by the [BasicPhotoEconomizer](https://github.com/WhatDanDoes/basic-photo-economizer) (my first `react-native` Android app).

## Setup

```
cp .env.example .env
npm install
```

## Test

```
npm test
```

## Production

In the application directory:

```
cd basic-photo-server 
NODE_ENV=production npm install
```

The _Dockerized_ production is meant to be deployed behind an `nginx-proxy`/`lets-encrypt` combo:

```
docker-compose -f docker-compose.prod.yml up -d
```

