const express = require("express")
const cors = require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const app = express()
const port = process.env.PORT || 5000;


// middleware
app.use(express.json())
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://news-portal-b2631.web.app/",
        "https://news-portal-b2631.web.app",
        "http://news-hub-6830.surge.sh",
        "https://news-portal-b2631.firebaseapp.com/"
    ],
    credentials: true
}))
app.use(cookieParser())

// custom middleware
const verify = (req, res, next) => {
    const cookie = req?.cookies?.token;
    if (!cookie) {
        console.log('cookie not found')
        return res.status(401).send({ massage: 'unauthorized access' })
    }
    jwt.verify(cookie, process.env.PRIVATE_KEY, (err, decode) => {
        if (err) {
            return res.status(401).send({ massage: 'unauthorized access' })
        }
        req.user = decode
        next()
    })
}

// mongodb connection
const uri = process.env.DB_URI;

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

        // jwt authorization apis
        app.post('/api/v1/access', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.PRIVATE_KEY, { expiresIn: "1h" })
            console.log(token)
            res
                .cookie("token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    secure: true,
                    sameSite: "none",
                })
                .send({ success: true })
        })

        app.post('/api/v1/logout', async (req, res) => {
            const user = req.body;
            console.log(user)
            res
                .clearCookie('token', { maxAge: 0, sameSite: 'none', secure: true })
                .send({ success: true })
        })

        // users apis
        const userCollection = client.db(process.env.DB_NAME).collection("users")
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })
        app.get('/users',verify, async (req, res) => {
            const query ={}
            if(req.query.rol){
                query.rol=req.query.rol
            }
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })
        app.get(`/users/:email`,verify, async (req, res) => {
            const query = {email:req.params.email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })
        app.patch(`/users/:id`,async(req,res)=>{
            const query={_id:new ObjectId(req.params.id)}
            const updateUser = {
                $set: {
                    rol:req.body.rol,
                },
            }
            const result = await userCollection.updateOne(query, updateUser)
            res.send(result)
        })
        app.patch(`/premiumUser/:email`,async(req,res)=>{
            const query={email:req.params.email}
            const updateUser = {
                $set:req.body
            }
            const result = await userCollection.updateOne(query, updateUser)
            res.send(result)
        })

        // publisher apis
        const publisherCollection = client.db(process.env.DB_NAME).collection("publishers")
        app.get('/publishers', async (req, res) => {
            const result = await publisherCollection.find().toArray()
            res.send(result)
        })
        app.get(`/publishers/:name`, async (req, res) => {
            const query = {name:req.params.name }
            const result = await publisherCollection.findOne(query)
            res.send(result)
        })

        app.post('/publishers', async (req, res) => {
            const data = req.body;
            const result = await publisherCollection.insertOne(data)
            res.send(result)
        })

        // articles apis
        const articlesCollection = client.db(process.env.DB_NAME).collection("articles")
        app.get('/articles', async (req, res) => {

            let query = {}
            const limit = req.query.limit ? parseInt(req.query.limit) : 0;
            const sort = {view:req.query.sort ? parseInt(req.query.sort) : 1};
            if (req.query.title) {
                query.title = { $regex: new RegExp(req.query.title, 'i') }
            }
            if (req.query.tags) {
                query.tags = { $regex: new RegExp(req.query.tags, 'i') }
            }
            if (req.query.publisher) {
                query.publisher =  req.query.publisher
            }
            if (req.query.type) {
                query.type =  req.query.type
            }
            if (req.query.email) {
                query.email =  req.query.email
            }
            if (req.query.status) {
                query.status =  req.query.status
            }
            const result = await articlesCollection.find(query).sort(sort).limit(limit).toArray()
            res.send(result)
        })
        app.get(`/articles/:id`,verify, async (req, res) => {
            const id =req.params.id
            const query = {_id: new ObjectId(id) }
            const result = await articlesCollection.findOne(query)
            res.send(result)
        })
        app.get(`/articlesView/:id`, async (req, res) => {
            const id =req.params.id
            const query = {_id: new ObjectId(id) }
            const result = await articlesCollection.updateOne(query,{ $inc: { view: 1 } })
            res.send(result)
        })
        
        app.post('/articles', async (req, res) => {
            const data = req.body;
            const result = await articlesCollection.insertOne(data)
            res.send(result)
        })
        app.put('/articles/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateService = {
                $set: {
                    image:data.image,
                    title:data.title,
                    publisher:data.publisher,
                    description:data.description,
                    tags:data.tags,
                    email:data.email,
                    date:data.date,
                    status:data.status,
                    view:data.view,
                    type:data.type
                },
            }
            const result = await articlesCollection.updateOne(filter, updateService, options)
            res.send(result)
        })
        app.patch(`/articles/:id`,async(req,res)=>{
            const data = req.body
            const query={_id:new ObjectId(req.params.id)}
            const updateArticle = {
                $set: data
            }
            const result = await articlesCollection.updateOne(query, updateArticle)
            res.send(result)
        })
        app.delete("/articles/:id", async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id),
            };
            const result = await articlesCollection.deleteOne(query);
            res.send(result);
        });
        // articles tags apis
        const articlesTagCollection = client.db(process.env.DB_NAME).collection("articlesTags")
        app.get('/articlesTags', async (req, res) => {
            const result = await articlesTagCollection.find().toArray()
            res.send(result)
        })

        app.post('/articlesTags', async (req, res) => {
            const data = req.body;
            const result = await articlesTagCollection.insertOne(data)
            res.send(result)
        })

        app.put('/articlesTags/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateService = {
                $set: {
                    tags: data.tags,
                },
            }
            const result = await articlesTagCollection.updateOne(filter, updateService, options)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
       
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, (req, res) => {
    console.log(`server is running on the port of ${port}`)
})