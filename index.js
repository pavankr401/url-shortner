require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient } = require('mongodb');
const dns = require('dns');

// create the MongoClient instance
const client = new MongoClient(process.env.MONGO_URI);

// Basic Configuration
const port = process.env.PORT || 5000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));
// we have to use middleware for express.urlencoded 
// to get values from document in req.body
app.use(express.urlencoded({ extended: false }));

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function (req, res) {
  res.json({ greeting: 'hello API' });
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});

app.post('/api/shorturl', function (req, res) {
  let url = req.body.url;
  if (/^http?s:[/][/]/.test(url)) {
    let fullUrl = new URL(url);
    dns.lookup(fullUrl.hostname, async function (err, address) {
      let num = await insertDb(url);
      return res.json({ original_url: url, short_url: num })
    })
  }
  else {
    return res.json({ "error": "Invalid URL" });
  }
})

app.get('/api/shorturl/:websiteNumber', async function (req, res) {
  let { websiteNumber } = req.params;
  let webPage = await findWebpage(websiteNumber);
  console.log("**********" + webPage);
  if (webPage) {
    return res.redirect(301, `${webPage}`);
  }
  else {
    return res.send("<b>not found<b>");
  }
})

// mongodb
const serverCollection = client.db("url_shortner").collection("urlCollection");
const countersCollection = client.db("url_shortner").collection("counters");

async function insertDb(url) {
  let getId;
  try {
    await client.connect();
    getId = await findIp(url);
    // console.log(getId);
    if (getId) {

      return getId;
    }
    else {
      getId = await getSequenceId();
      let documentToInsert = { _id: getId, webUrl: url };
      await serverCollection.insertOne(documentToInsert);
      return getId;
    }
  }
  catch (error) {
    console.error(error);
  }
  finally {
    await client.close();
  }
}

async function getSequenceId() {
  let filterDoc = { _id: "server_id" };
  let updateDoc = { $inc: { sequence_id: 1 } };
  let optionsObj = { returnDocument: 'after' };
  let result = await countersCollection.findOneAndUpdate(filterDoc, updateDoc, optionsObj);

  return result.value.sequence_id;
}

async function findIp(url) {
  let result = await serverCollection.findOne({ webUrl: url });
  if (result) return result._id;
  else return false;
}

async function findWebpage(num) {
  try {
    await client.connect();
    let result = await serverCollection.findOne({ _id: Number(num) }); //console.log(result);
    if (result) return result.webUrl;
    else false;
  }
  catch (error) {
    console.error(error);
  }
  finally {
    await client.close();
  }
}