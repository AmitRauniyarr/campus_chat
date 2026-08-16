require("dotenv").config();

const express = require("express");

const http=require("http");
const{Server}=require("socket.io")
const app = express();
app.use(express.json());
const jwt =require("jsonwebtoken");

const pool=require("./db/connection");
const groupRoutes=require("./routes/group");
app.use("/group",groupRoutes);
const dmRoutes=require("./routes/dms");
app.use("/dms" , dmRoutes);
const userRoutes=require("./routes/users");
app.use("/users",userRoutes);



const authRoutes= require("./routes/auth");
app.use("/auth",authRoutes);
const complaintRoutes= require("./routes/complaints");
app.use("/complaints",complaintRoutes);

const server=http.createServer(app);
const io= new Server(server);

app.use(express.static("public"));

const verifyToken=require("./middleware/middleware.auth");
const { group } = require("console");

app.get("/api/me",verifyToken,(req ,res)=>
{
    res.json(({message: "You are authenticated",user:req.user}));
});

io.use((socket,next)=>
{
    const token =socket.handshake.auth.token;
    if(!token)
    {
        return next(new Error("No token provided"));
    }
    try{
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        socket.user=decoded;
        next();

    }
    catch(err)
    {
        next(new Error("Invalid or expired token"));
    }
});

io.on("connection",async(socket)=>
{
    
    const [userRows]=await pool.query("SELECT name FROM Users WHERE id=?",[socket.user.userId]);
    socket.user.name=userRows[0].name;
   
    socket.on("join_room",async(groupId)=>
    {
        const [membership]=await pool.query(
            "SELECT * FROM GroupMembers WHERE group_id=? AND user_id=?",
            [groupId,socket.user.userId]
        );
        if(membership.length==0)
        {
            socket.emit("join_error","You are not a member of this group");
            return;
        }
      socket.join(String(groupId));
      socket.currentGroupId=groupId;
      
    
    //Load and send message history for this room
    const [messageRows]=await pool.query(
        "SELECT Messages.content,Messages.created_at,Users.name AS username FROM Messages JOIN Users on Messages.user_id=Users.id WHERE Messages.group_id=? ORDER BY Messages.created_at ASC",[groupId]
    );
    socket.emit("message_history",messageRows);
});
    socket.on("client_hello",async(data)=>{

        const[groupInfo]=await pool.query("SELECT type FROM ChatGroups WHERE id=?",[socket.currentGroupId]);
        if(groupInfo[0].type==="announcement" && socket.user.role==="student")
        {
            socket.emit("permission_error","Only professors/admins can post announcements");
            return;
        }
        const payload={
            username:socket.user.name,
            message:data.message,
            room:data.groupId,

        };
        await pool.query(
            "INSERT INTO Messages(group_id,user_id,content) VALUES(?,?,?)",[socket.currentGroupId,socket.user.userId,data.message]
        );
        io.to(String(data.groupId)).emit("new_message",payload);
    
        
        
    });
});

server.listen(3001,()=>
{
    console.log("Server is running on http://localhost:3001");
});