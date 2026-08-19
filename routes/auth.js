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

const updateProfileHandler = async (req, res) => {
    const { roll_no, branch, semester, hostel_id, room_number } = req.body;
    const userId = req.user.userId;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get current user's profile details to handle partial updates and compare hostel_id
        const [userRows] = await connection.query(
            "SELECT roll_no, branch, semester, hostel_id, room_number FROM Users WHERE id = ?",
            [userId]
        );
        if (userRows.length === 0) {
            connection.release();
            return res.status(404).json({ message: "User not found" });
        }
        const currentUser = userRows[0];
        const oldHostelId = currentUser.hostel_id;

        const newRollNo = roll_no !== undefined ? roll_no : currentUser.roll_no;
        const newBranch = branch !== undefined ? branch : currentUser.branch;
        const newSemester = semester !== undefined ? semester : currentUser.semester;
        const newHostelId = hostel_id !== undefined ? (hostel_id ? parseInt(hostel_id, 10) : null) : oldHostelId;
        const newRoomNumber = room_number !== undefined ? room_number : currentUser.room_number;

        // 2. Update user profile details
        await connection.query(
            "UPDATE Users SET roll_no=?, branch=?, semester=?, hostel_id=?, room_number=? WHERE id=?",
            [
                newRollNo || null,
                newBranch || null,
                newSemester || null,
                newHostelId || null,
                newRoomNumber || null,
                userId
            ]
        );

        // 3. Handle hostel auto-join/leave if the hostel_id changed
        if (oldHostelId !== newHostelId) {
            // Remove user from all hostel groups they are currently in
            await connection.query(
                `DELETE gm FROM GroupMembers gm
                 JOIN ChatGroups cg ON gm.group_id = cg.id
                 WHERE gm.user_id = ? AND cg.type = 'hostel'`,
                [userId]
            );

            // Add user to the new hostel group if a new hostel_id is selected
            if (newHostelId) {
                const [hostelGroups] = await connection.query(
                    "SELECT id FROM ChatGroups WHERE type = 'hostel' AND reference_id = ?",
                    [newHostelId]
                );

                if (hostelGroups.length > 0) {
                    const newGroupId = hostelGroups[0].id;
                    await connection.query(
                        "INSERT IGNORE INTO GroupMembers (group_id, user_id) VALUES (?, ?)",
                        [newGroupId, userId]
                    );
                } else {
                    // Check if the hostel exists in Hostels table first
                    const [hostelRows] = await connection.query(
                        "SELECT name FROM Hostels WHERE id = ?",
                        [newHostelId]
                    );
                    if (hostelRows.length > 0) {
                        const hostelName = hostelRows[0].name;
                        const [newGroupResult] = await connection.query(
                            "INSERT INTO ChatGroups (type, reference_id, name) VALUES ('hostel', ?, ?)",
                            [newHostelId, hostelName]
                        );
                        const newGroupId = newGroupResult.insertId;
                        await connection.query(
                            "INSERT INTO GroupMembers (group_id, user_id) VALUES (?, ?)",
                            [newGroupId, userId]
                        );
                    }
                }
            }
        }

        await connection.commit();
        res.json({ message: "Profile updated successfully" });
    } catch (err) {
        await connection.rollback();
        console.error("Error updating profile:", err);
        res.status(500).json({ message: "Failed to update profile" });
    } finally {
        connection.release();
    }
};

router.put("/profile", verifyToken, updateProfileHandler);
router.patch("/me", verifyToken, updateProfileHandler);

module.exports = router;
