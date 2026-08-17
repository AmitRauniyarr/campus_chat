/**
 * seed.js — populates the database with realistic demo data for a LinkedIn video.
 *
 * HOW TO RUN:
 *   1. Make sure your server is running (`node server.js`) in another terminal —
 *      this script calls your real API endpoints (signup, login, settings, etc.)
 *      so the actual auto-provisioning logic runs, not a shortcut.
 *   2. In a NEW terminal, from your project root, run: node seed.js
 *   3. It will take a minute or two — it's making dozens of real HTTP requests.
 *
 * All demo accounts use the password: Campus@123
 * DOSA/admin login: dosa@bitmesra.ac.in / Campus@123
 */

const { createPool } = require("mysql2/promise");

require("dotenv").config();
const pool = require("./db/connection").default;

const BASE = "http://localhost:3001";
const PASSWORD = "Campus@123";

// ---------- DATA ----------

const BRANCHES = [
  {
    code: "CSE", batchName: "CSE-5A",
    subjects: ["Data Structures & Algorithms", "Operating Systems", "Database Management Systems"],
    professors: ["Anil Sharma", "Rekha Nair", "Suresh Iyer"],
  },
  {
    code: "ECE", batchName: "ECE-5A",
    subjects: ["Digital Signal Processing", "Analog Electronics", "Communication Systems"],
    professors: ["Meera Krishnan", "Vinod Rao", "Ashok Verma"],
  },
  {
    code: "EE", batchName: "EE-5A",
    subjects: ["Power Systems", "Control Systems", "Electrical Machines"],
    professors: ["Deepak Malhotra", "Sunita Joshi", "Ramesh Gupta"],
  },
  {
    code: "MECH", batchName: "MECH-5A",
    subjects: ["Thermodynamics", "Fluid Mechanics", "Manufacturing Processes"],
    professors: ["Prakash Menon", "Anita Desai", "Manoj Tiwari"],
  },
  {
    code: "CIVIL", batchName: "CIVIL-5A",
    subjects: ["Structural Analysis", "Geotechnical Engineering", "Surveying"],
    professors: ["Kavita Reddy", "Rajesh Kumar", "Neha Bansal"],
  },
];

const STUDENTS_BY_BRANCH = {
  CSE: [
    { name: "Ravi Kumar", gender: "M" }, { name: "Priya Singh", gender: "F" },
    { name: "Aman Verma", gender: "M" }, { name: "Nisha Patel", gender: "F" },
    { name: "Karan Mehta", gender: "M" }, { name: "Simran Kaur", gender: "F" },
  ],
  ECE: [
    { name: "Arjun Nair", gender: "M" }, { name: "Divya Menon", gender: "F" },
    { name: "Rahul Saxena", gender: "M" }, { name: "Pooja Yadav", gender: "F" },
    { name: "Vikram Chauhan", gender: "M" }, { name: "Ananya Ghosh", gender: "F" },
  ],
  EE: [
    { name: "Rohit Malhotra", gender: "M" }, { name: "Kritika Sharma", gender: "F" },
    { name: "Siddharth Rao", gender: "M" }, { name: "Aditi Bhatt", gender: "F" },
    { name: "Harsh Vardhan", gender: "M" }, { name: "Sneha Kapoor", gender: "F" },
  ],
  MECH: [
    { name: "Aditya Joshi", gender: "M" }, { name: "Ishita Agarwal", gender: "F" },
    { name: "Nikhil Bose", gender: "M" }, { name: "Riya Chatterjee", gender: "F" },
    { name: "Yash Thakur", gender: "M" }, { name: "Tanvi Deshmukh", gender: "F" },
  ],
  CIVIL: [
    { name: "Abhishek Pandey", gender: "M" }, { name: "Shreya Iyer", gender: "F" },
    { name: "Gaurav Bisht", gender: "M" }, { name: "Meghna Sen", gender: "F" },
    { name: "Varun Khanna", gender: "M" }, { name: "Anjali Mishra", gender: "F" },
  ],
};

const HOSTELS = {
  boys1: { id: 1, name: "Ganga Hostel (Boys)", capacity: 12 },
  boys2: { id: 2, name: "Yamuna Hostel (Boys)", capacity: 12 },
  girls: { id: 3, name: "Saraswati Hostel (Girls)", capacity: 10 },
};

// ---------- HELPERS ----------

function slug(name) {
  return name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".");
}

async function signup(name, email, role, batch_id) {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password: PASSWORD, role, batch_id }),
  });
  const data = await res.json();
  if (!res.ok) console.error("Signup failed for", email, data);
  return data.userId;
}

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json();
  return data.token;
}

async function patchMe(token, fields) {
  await fetch(`${BASE}/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(fields),
  });
}

async function raiseComplaint(token, group_id, category, description) {
  const res = await fetch(`${BASE}/complaints`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ group_id, category, description }),
  });
  return (await res.json()).complaintId;
}

async function upvote(token, complaintId) {
  await fetch(`${BASE}/complaints/${complaintId}/upvote`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });
}

async function startDM(token, otherUserId) {
  const res = await fetch(`${BASE}/dms/start/${otherUserId}`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });
  return (await res.json()).groupId;
}

async function createGroup(token, name, memberIds) {
  const res = await fetch(`${BASE}/group/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ name, memberIds }),
  });
  return (await res.json()).groupId;
}

async function insertMessages(group_id, messages) {
  // messages: [{ user_id, content }]
  for (const m of messages) {
    await pool.query(
      "INSERT INTO Messages (group_id, user_id, content) VALUES (?, ?, ?)",
      [group_id, m.user_id, m.content]
    );
  }
}

// ---------- MAIN ----------

async function main() {
  console.log("Seeding batches...");
  const batchIds = {};
  for (const b of BRANCHES) {
    const [result] = await pool.query("INSERT INTO Batches (name) VALUES (?)", [b.batchName]);
    batchIds[b.code] = result.insertId;
  }

  console.log("Signing up professors...");
  const professorIds = {}; // { "CSE-Data Structures & Algorithms": userId }
  for (const b of BRANCHES) {
    for (let i = 0; i < b.subjects.length; i++) {
      const profName = b.professors[i];
      const email = `${slug(profName)}@bitmesra.ac.in`;
      const userId = await signup(profName, email, "professor", null);
      professorIds[`${b.code}-${b.subjects[i]}`] = userId;
    }
  }

  console.log("Seeding subjects + batch-subject mappings...");
  const batchSubjectGroupKey = {}; // "CSE-Data Structures & Algorithms" -> subject_id
  for (const b of BRANCHES) {
    for (const subjectName of b.subjects) {
      const [subResult] = await pool.query("INSERT INTO Subjects (name) VALUES (?)", [subjectName]);
      const subjectId = subResult.insertId;
      await pool.query(
        "INSERT INTO BatchSubjects (batch_id, subject_id, professor_id) VALUES (?, ?, ?)",
        [batchIds[b.code], subjectId, professorIds[`${b.code}-${subjectName}`]]
      );
    }
  }

  console.log("Signing up admin (DOSA)...");
  const adminId = await signup("Dean of Student Affairs", "dosa@bitmesra.ac.in", "admin", null);
  const adminToken = await login("dosa@bitmesra.ac.in");

  console.log("Signing up students (this also auto-provisions their subject groups)...");
  const students = []; // { userId, token, name, branch, gender }
  let hostelCounter = { boys1: 0, boys2: 0, girls: 0 };

  for (const b of BRANCHES) {
    const list = STUDENTS_BY_BRANCH[b.code];
    for (let i = 0; i < list.length; i++) {
      const { name, gender } = list[i];
      const email = `${slug(name)}@bitmesra.ac.in`;
      const userId = await signup(name, email, "student", batchIds[b.code]);
      const token = await login(email);

      // Assign hostel: alternate boys between the two boys hostels, respecting rough capacity;
      // leave every 5th student as a day scholar (no hostel) to show that case too.
      let hostel_id = null;
      const isDayScholar = i === list.length - 1 && b.code === "CIVIL"; // just one day scholar for variety
      if (!isDayScholar) {
        if (gender === "F") {
          hostel_id = HOSTELS.girls.id;
          hostelCounter.girls++;
        } else {
          hostel_id = hostelCounter.boys1 <= hostelCounter.boys2 ? HOSTELS.boys1.id : HOSTELS.boys2.id;
          if (hostel_id === HOSTELS.boys1.id) hostelCounter.boys1++; else hostelCounter.boys2++;
        }
      }

      await patchMe(token, {
        roll_no: `BTECH/${10000 + userId}/23`,
        branch: b.code,
        semester: 5,
        hostel_id,
        room_number: hostel_id ? `${Math.ceil(Math.random() * 3)}-${100 + userId}` : null,
      });

      students.push({ userId, token, name, branch: b.code, gender, hostel_id });
    }
  }

  console.log("Adding everyone to the announcements channel...");
  const [annRows] = await pool.query("SELECT id FROM ChatGroups WHERE type = 'announcement' LIMIT 1");
  let announcementGroupId;
  if (annRows.length === 0) {
    const [res] = await pool.query(
      "INSERT INTO ChatGroups (type, reference_id, name) VALUES ('announcement', NULL, 'Campus Announcements')"
    );
    announcementGroupId = res.insertId;
  } else {
    announcementGroupId = annRows[0].id;
  }
  const allUserIds = [adminId, ...Object.values(professorIds), ...students.map((s) => s.userId)];
  for (const uid of allUserIds) {
    try {
      await pool.query("INSERT INTO GroupMembers (group_id, user_id) VALUES (?, ?)", [announcementGroupId, uid]);
    } catch (e) { /* already a member, skip */ }
  }

  console.log("Posting DOSA announcements...");
  await insertMessages(announcementGroupId, [
    { user_id: adminId, content: "End-semester exam schedule for all branches has been released. Check the ERP portal for your slot allocation." },
    { user_id: adminId, content: "Reminder: Diwali break starts Nov 1st. Hostels will remain open for outstation students on request." },
    { user_id: adminId, content: "TnP Cell: Infosys and TCS campus drives scheduled next week. Registration closes Friday 5 PM." },
    { user_id: adminId, content: "Techno-cultural fest 'Kshitij' registrations are now open — check the TnP portal link for event details." },
  ]);

  console.log("Seeding subject-group conversations...");
  for (const b of BRANCHES) {
    const [groupRow] = await pool.query(
      `SELECT cg.id FROM ChatGroups cg
       JOIN BatchSubjects bs ON cg.reference_id = bs.id
       WHERE bs.batch_id = ? AND cg.type = 'subject' LIMIT 1`,
      [batchIds[b.code]]
    );
    if (groupRow.length === 0) continue;
    const groupId = groupRow[0].id;
    const profId = professorIds[`${b.code}-${b.subjects[0]}`];
    const branchStudents = students.filter((s) => s.branch === b.code);

    await insertMessages(groupId, [
      { user_id: profId, content: `Reminder: assignment 2 for ${b.subjects[0]} is due this Friday. Submit via the portal.` },
      { user_id: branchStudents[0].userId, content: "Sir, will the assignment cover last week's numericals too?" },
      { user_id: profId, content: "Yes, everything up to chapter 4 is included." },
      { user_id: branchStudents[1].userId, content: "Understood, thank you!" },
    ]);
  }

  console.log("Seeding hostel groups + complaints...");
  for (const [key, hostel] of Object.entries(HOSTELS)) {
    const [res] = await pool.query(
      "INSERT INTO ChatGroups (type, reference_id, name) VALUES ('hostel', ?, ?)",
      [hostel.id, hostel.name]
    );
    const groupId = res.insertId;
    const residents = students.filter((s) => s.hostel_id === hostel.id);
    for (const r of residents) {
      try {
        await pool.query("INSERT INTO GroupMembers (group_id, user_id) VALUES (?, ?)", [groupId, r.userId]);
      } catch (e) { }
    }
    if (residents.length >= 2) {
      const c1 = await raiseComplaint(residents[0].token, groupId, "water", "No water supply on the 2nd floor since this morning.");
      await upvote(residents[1].token, c1);
      if (residents[2]) await upvote(residents[2].token, c1);

      const c2 = await raiseComplaint(residents[1].token, groupId, "wifi", "Wifi has been extremely slow in the east wing for 3 days.");
      await upvote(residents[0].token, c2);
    }
  }

  console.log("Creating an ad-hoc group...");
  const placementMembers = students.filter((s) => ["CSE", "ECE", "EE"].includes(s.branch)).slice(0, 5);
  if (placementMembers.length > 1) {
    const groupId = await createGroup(
      placementMembers[0].token,
      "Placement Prep 2027",
      placementMembers.slice(1).map((s) => s.userId)
    );
    await insertMessages(groupId, [
      { user_id: placementMembers[0].userId, content: "Starting a prep group for placement season — sharing DSA sheets and mock interview slots here." },
      { user_id: placementMembers[1].userId, content: "Great idea, count me in!" },
    ]);
  }

  console.log("Seeding a couple of DMs...");
  if (students.length >= 4) {
    const dm1 = await startDM(students[0].token, students[1].userId);
    await insertMessages(dm1, [
      { user_id: students[0].userId, content: `Hey ${students[1].name.split(" ")[0]}, are you joining the study group tonight?` },
      { user_id: students[1].userId, content: "Yeah, 8 PM works for me!" },
    ]);

    const dm2 = await startDM(students[2].token, students[3].userId);
    await insertMessages(dm2, [
      { user_id: students[2].userId, content: "Did you submit the assignment yet?" },
      { user_id: students[3].userId, content: "Just submitted, cutting it close 😅" },
    ]);
  }

  console.log("\n✅ Seeding complete.");
  console.log(`Demo accounts — password for ALL of them: ${PASSWORD}`);
  console.log(`Admin/DOSA: dosa@bitmesra.ac.in`);
  console.log(`Sample student: ${students[0].name} — ${slug(students[0].name)}@bitmesra.ac.in`);
  console.log(`Sample professor: ${BRANCHES[0].professors[0]} — ${slug(BRANCHES[0].professors[0])}@bitmesra.ac.in`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
export const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
