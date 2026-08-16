const express=require("express");
const pool = require("../db/connection");
const verifyToken=require("../middleware/middleware.auth");

const router= express.Router();
router.post("/",verifyToken,async(req , res)=>
{
    const {group_id,category,description}=req.body;
    const [result]=await pool.query(
        "INSERT INTO Complaints(group_id,user_id,category,description) VALUES(?,?,?,?)",[group_id,req.user.userId,category,description]
    );
    res.json({message:"Complaint raised",complaintId:result.insertId});
});
router.get("/:groupId",verifyToken,async(req ,res)=>
{
    const [complaints]=await pool.query(
        `SELECT Complaints.*,(SELECT COUNT(*)FROM ComplaintUpvotes WHERE complaint_id=Complaints.id)AS upvote_count FROM Complaints WHERE group_id=? ORDER BY upvote_count DESC`,[req.params.groupId]
    );
    res.json(complaints);
});

router.post("/:complaintId/upvote",verifyToken,async(req ,res)=>
{
    try{
        await pool.query(
            "INSERT INTO ComplaintUpvotes(complaint_id, user_id) VALUES(?,?)",
            [req.params.complaintId,req.user.userId]
        );
        res.json({message:"Upvoted"});
    }
    catch(err)
    {
        res.status(400).json({message:"Already upvoted or invalid complaint"});
    }

});
module.exports=router;