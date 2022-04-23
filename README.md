ministry-expense-reimbursement-manager
======================================

`node`/`express` backend for receiving and cataloguing receipt photos sent by the in-built progressive camera application. Authentication is handled by [Auth0](https://auth0.com).

## System dependencies:

### Python

```
sudo apt update
sudo apt install python-dev
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
cd ministry-expense-reimbursement-manager
NODE_ENV=production npm install
```

The _Dockerized_ production is meant to be deployed behind an `nginx-proxy`/`lets-encrypt` combo:

```
docker-compose -f docker-compose.prod.yml up -d
```

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
docker exec -it dev-mongo mongorestore -d ministry-expense-reimbursement-manager_development --gzip backups/merman_production
```

#### Database Operations

Connect to DB container like this:

```
docker-compose -f docker-compose.prod.yml exec mongo mongo ministry-expense-reimbursement-manager_production
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

# Backup/Restore

## Backup

```
docker run --volumes-from ministryexpensereimbursementmanager_merman_mongo_1 -v $(pwd):/backup busybox tar cvf /backup/backup.tar /data/db
sudo chown user:user backup.tar
```

## Restore

```
tar -zxvf uploads.tar.gz
docker run --volumes-from ministryexpensereimbursementmanager_merman_mongo_1 -v $(pwd):/backup busybox tar xvf /backup/backup.tar
```

## Notes

`Merman` logo obtained from [here](http://heraldicart.org/merman/) on 2019-8-26. Artist unknown.



