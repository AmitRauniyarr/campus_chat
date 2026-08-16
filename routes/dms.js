const express=require("express");
const pool = require("../db/connection");
const verifyToken= require("../middleware/middleware.auth");
const { getRounds } = require("bcrypt");
const router=express.Router();

router.post("/start/:otherUserId",verifyToken,async(req , res)=>
{
    const myId=req.user.userId;
    const otherId= parseInt(req.params.otherUserId);

    //Look for an existing DM group containing exactly these two users
    const [existing]=await pool.query(
        `SELECT gm.group_id FROM GroupMembers gm
        JOIN ChatGroups g ON gm.group_id=g.id
        WHERE g.type='dm' AND gm.user_id IN(?,?) 
        GROUP BY gm.group_id
        HAVING COUNT (DISTINCT gm.user_id)=2
        AND SUM (gm.user_id=?)=1
        AND SUM (gm.user_id=?)=1 `,
        [myId,otherId,myId,otherId]
    );
    if(existing.length>0)
    {
        return res.json({groupId:existing[0].group_id});
    }
    const [groupResult]=await pool.query(
        "INSERT INTO ChatGroups (type,reference_id,name)VALUES ('dm',NULL,?)",
        [`DM-${myId}-${otherId}`]
    );
    const groupId=groupResult.insertId;
    await pool.query("INSERT INTO GroupMembers(group_id,user_id)VALUES(?,?),(?,?)",[groupId,myId,groupId,otherId]);
    res.json({groupId});
});
module.exports=router;