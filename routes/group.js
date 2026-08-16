const express=require("express");
const pool=require("../db/connection");
const verifyToken = require("../middleware/middleware.auth");

const router=express.Router();

router.get("/my-groups", verifyToken, async (req, res) => {
  const [groups] = await pool.query(
    `SELECT cg.id, cg.type,
      CASE
        WHEN cg.type = 'dm' THEN (
          SELECT u2.name FROM GroupMembers gm2
          JOIN Users u2 ON gm2.user_id = u2.id
          WHERE gm2.group_id = cg.id AND gm2.user_id != ?
          LIMIT 1
        )
        ELSE cg.name
      END AS name
     FROM GroupMembers gm
     JOIN ChatGroups cg ON gm.group_id = cg.id
     WHERE gm.user_id = ?`,
    [req.user.userId, req.user.userId]
  );
  res.json(groups);
});

router.post("/create",verifyToken,async(req,res)=>
{
    const {name,memberIds}=req.body;

    const[groupResult]=await pool.query(
        "INSERT INTO ChatGroups(type,reference_id,name)VALUES('custom',NULL,?)",[name]
    );
    const groupId=groupResult.insertId;
    const allMembers=[...new Set([...memberIds,req.user.userId])];

    const values=allMembers.map((uid)=>[groupId,uid]);
    await pool.query("INSERT INTO GroupMembers(group_id,user_id)VALUES ?",[values]);

    res.json({message:"Group created",groupId});
});

router.get("/:groupId/messages",verifyToken,async(req , res)=>
{
    const groupId=req.params.groupId;
    const[membership]=await pool.query(
        "SELECT * FROM GroupMembers WHERE group_id=? AND user_id=?",
        [groupId,req.user.userId]
    );
    if(membership.length==0)
    {
        return res.status(403).json({message:"Not a member of this group"});
    }
    const [messages]=await pool.query(
        "SELECT Messages.content, Messages.created_at, Users.name AS username FROM Messages JOIN Users ON Messages.user_id=Users.id WHERE Messages.group_id=? ORDER BY Messages.created_at ASC",
        [groupId]
    );
    res.json(messages);
})
router.get("/:groupId/members", verifyToken, async (req, res) => {
  const groupId = req.params.groupId;

  const [membership] = await pool.query(
    "SELECT * FROM GroupMembers WHERE group_id = ? AND user_id = ?",
    [groupId, req.user.userId]
  );
  if (membership.length === 0) {
    return res.status(403).json({ message: "Not a member of this group" });
  }

  const [members] = await pool.query(
    "SELECT Users.id, Users.name, Users.role FROM GroupMembers JOIN Users ON GroupMembers.user_id = Users.id WHERE GroupMembers.group_id = ?",
    [groupId]
  );
  res.json(members);
});
module.exports=router;