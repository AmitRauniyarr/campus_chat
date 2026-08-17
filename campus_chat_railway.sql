-- Campus Chat Database Schema
-- This file creates the database structure only.
-- Demo data will be added separately through seed.js.

CREATE TABLE Batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE Hostels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'professor', 'admin') NOT NULL,
    batch_id INT NULL,
    hostel_id INT NULL,
    room_number VARCHAR(20) NULL,
    roll_no VARCHAR(20) NULL,
    semester INT NULL,
    branch VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_batch
        FOREIGN KEY (batch_id)
        REFERENCES Batches(id),

    CONSTRAINT fk_users_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES Hostels(id)
);

CREATE TABLE Subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE BatchSubjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    subject_id INT NOT NULL,
    professor_id INT NOT NULL,

    CONSTRAINT fk_batchsubjects_batch
        FOREIGN KEY (batch_id)
        REFERENCES Batches(id),

    CONSTRAINT fk_batchsubjects_subject
        FOREIGN KEY (subject_id)
        REFERENCES Subjects(id),

    CONSTRAINT fk_batchsubjects_professor
        FOREIGN KEY (professor_id)
        REFERENCES Users(id)
);

CREATE TABLE ChatGroups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM(
        'subject',
        'hostel',
        'dm',
        'announcement',
        'custom'
    ) NOT NULL,
    reference_id INT NULL,
    name VARCHAR(150) NOT NULL
);

CREATE TABLE GroupMembers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_groupmembers_group
        FOREIGN KEY (group_id)
        REFERENCES ChatGroups(id),

    CONSTRAINT fk_groupmembers_user
        FOREIGN KEY (user_id)
        REFERENCES Users(id),

    UNIQUE (group_id, user_id)
);

CREATE TABLE Messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_messages_group
        FOREIGN KEY (group_id)
        REFERENCES ChatGroups(id),

    CONSTRAINT fk_messages_user
        FOREIGN KEY (user_id)
        REFERENCES Users(id)
);

CREATE TABLE Complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('open', 'in-progress', 'resolved') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_complaints_group
        FOREIGN KEY (group_id)
        REFERENCES ChatGroups(id),

    CONSTRAINT fk_complaints_user
        FOREIGN KEY (user_id)
        REFERENCES Users(id)
);

CREATE TABLE ComplaintUpvotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    user_id INT NOT NULL,

    CONSTRAINT fk_upvotes_complaint
        FOREIGN KEY (complaint_id)
        REFERENCES Complaints(id),

    CONSTRAINT fk_upvotes_user
        FOREIGN KEY (user_id)
        REFERENCES Users(id),

    UNIQUE (complaint_id, user_id)
);

-- Useful indexes for common queries

CREATE INDEX idx_users_batch
    ON Users(batch_id);

CREATE INDEX idx_users_hostel
    ON Users(hostel_id);

CREATE INDEX idx_batchsubjects_batch
    ON BatchSubjects(batch_id);

CREATE INDEX idx_groupmembers_group
    ON GroupMembers(group_id);

CREATE INDEX idx_groupmembers_user
    ON GroupMembers(user_id);

CREATE INDEX idx_messages_group_created
    ON Messages(group_id, created_at);

CREATE INDEX idx_complaints_group
    ON Complaints(group_id);

CREATE INDEX idx_complaintupvotes_complaint
    ON ComplaintUpvotes(complaint_id);