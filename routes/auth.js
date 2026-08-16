const express=require("express");
const bcrypt= require("bcrypt");
const pool = require("../db/connection");
const jwt=require("jsonwebtoken");
const verifyToken = require("../middleware/middleware.auth");

const JWT_SECRET=process.env.JWT_SECRET;

const router = express.Router();
router.post("/signup",async (req ,res)=>
{
    const {name,email,password,role,batch_id}=req.body;

    const password_hash =await bcrypt.hash(password,10);
    const [result]=await pool.query(
        "INSERT INTO Users (name , email,password_hash,role,batch_id) VALUES(?,?,?,?,?)",
        [name,email,password_hash,role,batch_id || null]
    );
    const userId=result.insertId;
    //Auto -provision: add student to all subject groups for their batch
    if(role==="student" && batch_id)
    {
        const[batchSubjects]=await pool.query(
            "SELECT id FROM BatchSubjects WHERE batch_id=?",
            [batch_id]
        );
        for(const bs of batchSubjects)
        {
            let [groupRows]=await pool.query(
                "SELECT id FROM ChatGroups WHERE type='subject' AND reference_id=?",
                [bs.id]
            );
            let groupId;
            if(groupRows.length===0)
            {
                const[groupResult]=await pool.query(
                    "INSERT INTO ChatGroups (type,reference_id,name) VALUES ('subject',?,?)",
                    [bs.id,`Batch${batch_id}-Subject Group`]
                );
                groupId=
                groupResult.insertId;
                
            }
            else 
            {
                groupId=groupRows[0].id;
            }
            await pool.query(
                "INSERT INTO GroupMembers (group_id,user_id) VALUES(?,?)",
                [groupId,userId]
            );
        }
    }

    res.json({message:"User created",userId});
    

});

router.post("/login",async(req ,res)=>
{
    const{email,password}=req.body;
    
    const[rows]=await pool.query("SELECT * FROM Users WHERE email=?",[email]);

    if(rows.length===0)
    {
        return res.status(401).json({message:"Invalid email or password"});

    }
    const user = rows[0];
    const passwordMatches=await bcrypt.compare(password,user.password_hash);
    if(!passwordMatches)
    {
        return res.status(401).json({message:"Invalid email or password"});
    }
    const token=jwt.sign({userId: user.id, role :user.role},
        JWT_SECRET,
        {expiresIn:"24h"}
    );
    res.json({message:"Login successful", token });
});

router.get("/me",verifyToken,async(req ,res)=>
{
    const [rows]=await pool.query(
        "SELECT id, name,email,role ,roll_no,branch,semester,batch_id,hostel_id,room_number FROM Users WHERE id=?",
        [req.user.userId]
    );
    res.json(rows[0]);
})

router.put("/profile",verifyToken,async(req,res)=>
{
    const {roll_no,branch,semester,hostel_id,room_number}=req.body;
    try {
        await pool.query(
            "UPDATE Users SET roll_no=?, branch=?, semester=?, hostel_id=?, room_number=? WHERE id=?",
            [
                roll_no || null,
                branch || null,
                semester || null,
                hostel_id || null,
                room_number || null,
                req.user.userId
            ]
        );
        res.json({message:"Profile updated successfully"});
    } catch(err) {
        console.error("Error updating profile:", err);
        res.status(500).json({message:"Failed to update profile"});
    }
});

module.exports= router;
