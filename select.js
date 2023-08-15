import dbConn from "./database.js";
import { ListObjectsCommand } from '@aws-sdk/client-s3';

const bucketName = 'journey-v1';

export class DbSelectClass {
    cnn;
    constructor() {
        this.cnn = dbConn()
    }

    getUserdata = async () => {
        try {
            const sql = "SELECT * FROM users";
            const [data] = await dbConn().query(sql);
            return data;
        } catch (error) {
            const erro = "error";
            console.log(error);
            return erro;
        }
    }

    

    getVideodata = async () => {
        try {
            const videosql = "SELECT * FROM videos";
            const [dbData] = await dbConn().query(videosql);

            // Fetch the list of videos from S3 bucket
            const s3Command = new ListObjectsCommand({ Bucket: bucketName });
            const s3Response = await s3.send(s3Command); // You need to import 's3' from AWS SDK
            const s3Videos = s3Response.Contents.map(item => ({
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
            }));

            // Combine database and S3 video data
            const allVideos = dbData.map(video => ({
                id: video.id,
                title: video.title,
                category: video.category,
                description: video.description,
                calories: video.calories,
                duration: video.duration,
                s3Key: video.s3Key,
            })).concat(s3Videos);

            return allVideos;
        } catch (err) {
            console.error(err);
            return [];
        }
    };


    getAllData = async () => {
        try {
            const allData = {};
            allData.user = await this.getUserdata(); // Use 'this' to call class method
        
            const videosql = "SELECT * FROM videos";
            const [dbVideoData] = await dbConn().query(videosql);

            // Fetch the list of videos from S3 bucket
            const s3Command = new ListObjectsCommand({ Bucket: bucketName });
            const s3Response = await s3.send(s3Command); // You need to import 's3' from AWS SDK
            const s3Videos = s3Response.Contents.map(item => ({
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
            }));

            // Combine database and S3 video data
            const allVideos = dbVideoData.map(video => ({
                id: video.id,
                title: video.title,
                category: video.category,
                description: video.description,
                calories: video.calories,
                duration: video.duration,
                s3Key: video.s3Key,
            })).concat(s3Videos);

            allData.video = allVideos;

            return allData;
        } catch (err) {
            console.error(err);
            return {};
        }
    }
    getVideoDataById = async (VideoId) =>{
        try {
            const sql = "SELECT * FROM videos WHERE id = ?";
            const [videoData] = await dbConn().execute(sql, [VideoId]);

            if (videoData.length === 0){
                const video = "Video not found";
                return video;
            }
            const s3Command = new ListObjectsCommand({Bucket: bucketName, Prefix: videoData[0].s3Key});
            const s3Response = await s3.send(s3Command);
            const s3Video = s3Response.Contents[0];

            const video = {
                id: videoData[0].id,
                title:videoData[0].title,
                category:videoData[0].category,
                description:videoData[0].description,
                calories:videoData[0].calories,
                duration:videoData[0].duration,
                s3Key:videoData[0].s3Key,
                s3Size: s3Video.Size,
                s3LastModified: s3Video.LastModified,
            };
            return video

        }catch (error){
            console.error(error)
        }

    }
}

const DbSelects = new DbSelectClass();

export default DbSelects;
