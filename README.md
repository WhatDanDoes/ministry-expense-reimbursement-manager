basic-photo-server
==================

`node`/`express` backend for receiving photos sent by the [BasicPhotoEconomizer](https://github.com/WhatDanDoes/basic-photo-economizer) (my first `react-native` Android app).

## System dependencies:

### Python

```
sudo apt update
sudo apt install python3
```

### csv2odf

From https://sourceforge.net/p/csv2odf/wiki/Main_Page/

```
cd ~
wget https://sourceforge.net/projects/csv2odf/files/csv2odf-2.09/csv2odf_2.09-1.deb
sudo dpkg -i csv2odf_2.09-1.deb
```

This may require `python` 2.6. I finally managed to successfully install `csv2odf` with:

```
sudo apt --fix-broken install
```

## Setup

```
cp .env.example .env
npm install
```

## Test

Start a MongoDB development server:

```
docker run --name dev-mongo -p 27017:27017 -d mongo
```

Alternatively, to mount a host volume:

```
docker run --volume /path/to/backups:/backups --name dev-mongo -p 27017:27017 -d mongo
```

I use `jasmine` and `zombie` for testing. These are included in the package's development dependencies.

Run all the tests:

```
npm test
```

Run one set of tests:

```
NODE_ENV=test npx jasmine spec/models/agentSpec.js
```

## Development

Start a MongoDB development server:

```
docker run --name dev-mongo -p 27017:27017 -d mongo
```

Once created, you can start and stop the container like this:

```
docker stop dev-mongo
docker start dev-mongo
```

Seed database:

```
node seed.js
```

Start `maildev`:

```
docker run -d --name maildev -p 1080:80 -p 25:25 -p 587:587 djfarrelly/maildev
```

Run server:

```
npm start
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

### Upload APK

Put the BasicPhotoEconomizer app in `public/app/app-release.apk`.

### Seed database:

```
docker-compose -f docker-compose.prod.yml run --rm node node seed.js NODE_ENV=production
```

### Database backup and recovery

Backup:

```
docker-compose -f docker-compose.prod.yml exec merman_mongo mongodump --host merman_mongo --db merman_production --gzip --out ./backups
tar zcvf merman_production.tar.gz backups/merman_production/
tar zcvf uploads.tar.gz uploads/
```

Restore:

```
tar zxvf merman_production.tar.gz
tar zxvf uploads.tar.gz
docker-compose -f docker-compose.prod.yml exec merman_mongo mongorestore --gzip --db merman_production backups/merman_production
```

Restore to dev:

```
docker exec -it dev-mongo mongorestore -d basic_photo_server_development --gzip backups/merman_production
```

#### Database Operations

Connect to DB container like this:

```
docker-compose -f docker-compose.prod.yml exec mongo mongo basic_photo_server_production
```

Show databases:

```
show dbs
```

Use database:

```
use merman_production
```

Show collections:

```
show collections
```

#### Give an agent album reading permission

```
db.agents.update({ email: 'daniel@example.com' }, { $addToSet: { "canRead": db.agents.findOne({ email: 'lyndsay@example.com' })._id } })
```

## Notes

`Merman` logo obtained from [here](http://heraldicart.org/merman/) on 2019-8-26. Artist unknown.

