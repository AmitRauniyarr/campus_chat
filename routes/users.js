const express=require("express");
const pool=require("../db/connection");
const verifyToken=require("../middleware/middleware.auth");

const router = express.Router();

router.get("/search",verifyToken,async(req ,res)=>{
    const q=req.query.q || "";
    const [users]=await pool.query("SELECT id, name, role FROM Users WHERE name LIKE ? AND id!=? LIMIT 20",[`%${q}%`,req.user.userId]);
    res.json(users);
});
module.exports=router;