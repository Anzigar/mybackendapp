import mysql from 'mysql2';
import dotenv from 'dotenv';
//cofig dotenv
dotenv.config()

// Create a MySQL connection pool
const dbConn = () => {
    const conn = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
    }).promise();
    return conn;
}



export default dbConn;