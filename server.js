import express from 'express';
import session from 'express-session';
import { createServer } from 'http';
import { compare, hash } from 'bcrypt';
import { S3Client, PutObjectCommand, ListObjectsCommand,DeleteObjectCommand } from '@aws-sdk/client-s3'; 
import multer from 'multer';
import dbConn from './database.js';
import DbSelects from './select.js';
import fs from "fs";


const app = express();
app.use(express.json());
const httpServer = createServer(app);
const port = process.env.PORT || 5000;
const bucketName = 'journey-v1';

//session 
app.use(session({
    secret: 'keyboard cart',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24}
}));
// Initialize AWS S3 client
const s3 = new S3Client({
  region:process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Initialize multer middleware for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({storage}).array('videoFile');

//get user
app.get("/user", async(req,res)=>{
    const userData = await DbSelects.getAllData();
    res.json(userData);
});

//add user to the database
app.post("/addUser", async(res,req) =>{
    const email = req.body.email;
    const userId = req.body.userId;

    //check if the emai or user id exist
    const existingUserQuery = `SELECT COUNT (*) AS count FROM users WHERE email = ? OR userId = ?`;
    const existingUserValues =  [email, userId];

    try{
        const [existingUserData] = await dbConn().query(existingUserQuery, existingUserValues);
        const count = existingUserData[0].count;

        if(count > 0){
            return res.json({state: "error", message:"email already exist"})
        }

        //
        console.log(req.body);
        const password = await hash(req.body.password, 13);
        const insertQuery = `INSERT INTO users (firstName, lastName, phoneNumber, profileIMG, password) VALUES(?,?,?,?,?,?)`;
        const insertValues =[
            req.body.fname,
            req.body.lname,
            req.body.phoneNumber,
            req.body.profile,
            password
        ];
        const data = await dbConn().query(insertQuery,insertValues);
        return res.json({data, state: "success", message: "User added"});
    } catch (error){
        console.error("An error occured while adding a user", error);
        return res.json({ state: "error", message: "User not added"});
    }
});

//update the user
app.post("/updateUser/", async(req,res) =>{
    const sql = "UPDATE users SET `firstname` = ?, `lastname` = ?,  `poneNumber` = ?, `password` = ? WHERE `userId` = ?  ";
    const npass = await hash(re.body.password, 13);
    const values = [
        req.body.fname,
        req.body.lname,
        req.body.pone_number,
        npass,
        req.body.uid,
    ];
    try {
        await dbConn().query(sql,values);
        return res.json({
            state: "success",
            message: "User updated successfullly"
        })
    }catch(err){
        console.error(err);
        return res.json({
            state:"error",
            message:"Error updating user",
        });
    }
});

//delete the user
app.post("/deleteUser", async(req,res)=>{
    try {
        const {userID} = req.body;
        const sql = `DELETE FROM users WHERE userId = ?`;
        await dbConn().query(sql, [userID]);
        return res.json({
            state:"success",
            message:"User deleted successfully",
        });
    } catch(err){
        console.error(err);
        return res.json({
            state:"error",
            message:'Error deleting user',
        });
    }
});

//add video
app.post('/upload-video', upload, async (req, res) => {
    try {
        // Check if any file inputs are being submitted
        const fileInputs = req.files;
        if (!fileInputs.length) {
            return res.status(400).json({ error: 'No file inputs were submitted' });
        }
      
        // Get the video file 
        const videoFile = fileInputs[0];

        // Save the video file to  server
        const serverFilePath = `./uploads/${videoFile.originalname}`;
        fs.writeFileSync(serverFilePath, videoFile.buffer);

        // Upload the video to S3
        const params = {
            Bucket: bucketName,
            Key: videoFile.originalname,
            Body: fs.createReadStream(serverFilePath),
            ContentType: videoFile.mimetype
        };

        const command = new PutObjectCommand(params);
        await s3.send(command);

        // Delete the video file 
        fs.unlinkSync(serverFilePath);
        console.log(typeof{calories});
        // Store the video file info
        const query = 'INSERT INTO videos(title, category, description, calories, duration, s3Key) VALUES (?, ?, ?, ?, ?, ?)';
        const s3Key = videoFile.originalname;
        await dbConn().execute(query, [req.body.title, req.body.category, req.body.description, req.body.calories, req.body.duration, s3Key]);

        // Return a success message
        res.status(200).json({ message: 'Video uploaded successfully to server and S3' });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ error: 'An error occurred while uploading the video' });
    }
});


//get all videos
app.get("/allVideos", async (req, res) => {
    try {
        // Perform a database 
        const dbQuery = 'SELECT title, category, calories, duration, description, s3Key FROM videos';
        const [dbRows] = await dbConn().query(dbQuery);

        // Create the  S3 bucket
        const s3Command = new ListObjectsCommand({ Bucket: bucketName });

        // Send 
        const s3Response = await s3.send(s3Command);

        // Map the S3 
        const allVideos = dbRows.map(dbItem => {
            const s3Item = s3Response.Contents.find(s3Obj => s3Obj.Key === dbItem.s3Key);
            return {
                title: dbItem.title,
                category: dbItem.category,
                calories: dbItem.calories,
                duration: dbItem.duration,
                description: dbItem.description,
                s3Key: dbItem.s3Key,
                size: s3Item ? s3Item.Size : null,
                lastModified: s3Item ? s3Item.LastModified : null,
            };
        });

        res.json(allVideos);
    } catch (error) {
        console.error('Error retrieving video list:', error);
        res.status(500).json({ error: 'An error occurred while retrieving video list' });
    }
});



//get single video
app.get("/video/:id", async (req, res) => {
    const videoId = req.params.id;
    try {
        const videoData = await DbSelects.getVideoDataById(videoId);
        if (!videoData) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const s3Key = videoData.s3Key; 

        const params = {
            Bucket: bucketName,
            Key: s3Key,
            Expires: 3600, 
        };
        const url = await s3.getSignedUrlPromise('getObject', params);

        res.json({ url });
    } catch (error) {
        console.error('Error retrieving video data:', error);
        res.status(500).json({ error: 'An error occurred while retrieving video data' });
    }
});

  // Updated 
  app.put('/updateVideo/:id', async (req, res) => {
    const videoId = req.params.id;
    const { title, category, calories, description } = req.body;
    try {
        // Fetch video 
        const videoData = await DbSelects.getVideoDataById(videoId);
        if (!videoData) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        // Update 
        const updateQuery = 'UPDATE videos SET title = ?, category = ?, calories = ?, description = ? WHERE id = ?';
        await dbConn().execute(updateQuery, [title, category, calories, description, videoId]);

        res.status(200).json({ message: 'Video details updated successfully' });
    } catch (error) {
        console.error('Error updating the video:', error);
        res.status(500).json({ error: 'An error occurred while updating the video' });
    }
});
  
//delete video
app.delete('/delete-video/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
        const videoData = await DbSelects.getVideoDataById(videoId); 
        if (!videoData) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Delete
        const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: videoData.s3Key,
        });
        await s3.send(deleteCommand);

        // Delete 
        const deleteSql = 'DELETE FROM videos WHERE id = ?';
        await dbConn().execute(deleteSql, [videoId]);

        return res.status(200).json({ message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Error deleting video:', error);
        return res.status(500).json({ error: 'An error occurred while deleting the video' });
    }
});


//=============ADMIN=============
//Login route
app.post('/login', async (req, res)=> {
    const { uname, password } = req.body;
    try{
        const query = "SELECT * FROM admin WHERE userName= ?";
        const [result] = await dbConn().query(query, [uname]);
        if(result.length === 0){
            return res.json({
                state: 'error',
                message: 'Invalid username or password',
            });
        }
        const user = result[0];
        const dbPassword = user.Password;

        //compare the password 
        const passwordMatch = await compare(password,dbPassword);

        if (!passwordMatch){
            return res.json({
                state:'error',
                message:'Invalid username or password'
            });
        }
        //store user id in the session
        req.session.user = user.id;
        //Auth is sucessfull
        return res.json({
            state:'success',
            message:'Logged in successfully',
        });
    }catch (error){

        console.error(error);
        return res.json({
            state:'error',
            message:'An error occurred'
        });
    }
});

//retrieve data to the database 
app.get("/video", async (req, res) => {
    const videodata = await DbSelects.getVideodata();
    res.json(videodata);
});

//get all the data from the database
app.get("/getdata", async (req, res) =>{
    const allData = await DbSelects.getAllData();
    res.json(allData);
});

//add root user 
app.post('/addAdmin', async (req, res) => {
    const sql = 'INSERT INTO admin(userName, Password) VALUES (?, ?)';
    const { uname, password } = req.body;
    try {
        // Ensure the uname and password
        if (!uname || !password) {
            return res.json({ success: false, message: 'Username and password are required' });
        }
        // Hash 
        const hashedPassword = await hash(password, 13);
        console.log(hashedPassword)
        await dbConn().query(sql, [uname, hashedPassword]);
        return res.json({ success: true, message: 'User added successfully' });
    } catch (err) {
        console.error(err);
        console.log(err)
        return res.json({ success: false, message: 'Error adding user' });
    }
});


//admin
app.get("/admin", async (req, res) => {
    if(req.session.user){
        const id = req.session.user;
        const sql = "SELECT * FROM admin WHERE id=?";
        const [data] = await dbConn().query(sql, [id]);
        return res.json({ valid: true, user:data[0] });
    }
    else {
        return res.json({ valid: false });
    }
});

//error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        state: 'error',
        message: 'Something went wrong',
    });
});

httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});