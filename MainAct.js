import dbConn from "../database";

//function to check user state
export async function getUserState() {
    try {
        const sql = "SELECT * FROM `video` WHERE isLoggedIn =1 AND isActive = 1 AND isWorking = 0";
        const [data] = await dbConn().query(sql);
        if (data === undefined || data.length == 0) {
            return ({ state: 'error', message: 'video is working'});
        }
        console.log(data);
        return ({ state: 'error', message: 'Sucessful selected', data});
    } catch (err) {
        console.log(err);
        const erro = { state: 'error', message: 'An error occured'};
        return (erro);
    }
    
}