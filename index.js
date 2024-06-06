const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.szh9b4v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const userCollection = client.db('diagnosticDB').collection('users');
        const bannerCollection = client.db('diagnosticDB').collection('banners');
        const testCollection = client.db('diagnosticDB').collection('tests');

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ token })
        })

        // middleware
        const verifyToken = (req, res, next) => {
            console.log('inside verify token :', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        // user related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            // if exist, don't insert in database
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            // inset user
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // change admin role 
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        // blocked user
        app.patch('/users/blocked/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'blocked'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result)
        });

        // test/service related api
        app.get('/tests', async (req, res) => {
            const result = await testCollection.find().toArray();
            res.send(result);
        })

        app.get('/tests/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await testCollection.findOne(query);
            res.send(result);
        })

        app.post('/tests', verifyToken, verifyAdmin, async (req, res) => {
            const test = req.body;
            const result = await testCollection.insertOne(test);
            res.send(result);
        })

        app.put('/tests/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const test = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: test.name,
                    image: test.image,
                    price: test.price,
                    date: test.date,
                    details: test.details,
                    slots: test.slots
                }
            }
            const result = await testCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        app.delete('/tests/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await testCollection.deleteOne(query);
            res.send(result)
        })

        // banner related api
        app.get('/banners', async (req, res) => {
            const result = await bannerCollection.find().toArray();
            res.send(result)
        })

        app.get('/banners/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bannerCollection.findOne(query);
            res.send(result)
        })

        app.post('/banners', verifyToken, verifyAdmin, async (req, res) => {
            const banner = req.body;
            const result = await bannerCollection.insertOne(banner);
            res.send(result);
        })

        app.patch('/banners/active/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDocAll = {
                $set: {
                    isActive: 'false'
                }
            }
            await bannerCollection.updateMany({}, updatedDocAll);
            const updatedDoc = {
                $set: {
                    isActive: 'true'
                }
            }
            const result = await bannerCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        app.delete('/banners/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bannerCollection.deleteOne(query);
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('diagnostic is running')
})

app.listen(port, () => {
    console.log('diagnostic is running on port', port)
})
