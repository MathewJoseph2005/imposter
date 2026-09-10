# 👾 ASTHRA 2K26 – IMPOSTER

> A real-time coding game built for **ASTHRA 2K26**, where every team has one hidden imposter.

A fun competition that combines teamwork, coding, strategy, and a little bit of chaos.

---

## 🎮 About the Game

IMPOSTER is a team-based coding event designed for ASTHRA 2K26.

* 24 participants
* 6 teams
* 1 hidden imposter in every team
* Random seating after registration
* Secret role reveal before the game begins
* GitHub submission and AI-based scoring

The challenge is simple: complete your coding task while identifying the imposter in your group.

---

## ✨ Features

### 👨‍💼 Coordinator Dashboard

* Register teams.
* View all registered teams.
* Shuffle participants into new groups.
* Retry shuffle for testing.
* Seating arrangement generated automatically.

### 🎲 Smart Shuffle

* Exactly 6 groups are created.
* Every group contains **1 Imposter + 3 Specialists**.
* An imposter is never seated with members from their original team.
* Shuffle data is stored in Supabase.

### 🕵️ Secret Role Reveal

Participants log in using their team name and participant name.

The system verifies the participant and privately reveals only one role:

* 🔴 Imposter
* 🟢 Specialist

After a short countdown, the participant enters the main event page.

### 💻 Main Event

Participants receive coding tasks and submit their GitHub repository before the timer ends.

### 🤖 AI Scoring

Submitted repositories are evaluated through the backend scoring module and stored in Supabase.

---

## 🧱 Tech Stack

| Frontend   | Backend    | Database                 |
| ---------- | ---------- | ------------------------ |
| HTML       | Node.js    | Supabase                 |
| CSS        | Express.js | PostgreSQL               |
| JavaScript | REST APIs  | Authentication & Storage |

---

## 📁 Project Structure

```text
imposter/
│
├── frontend/
│   ├── homepage.html
│   ├── team_registration.html
│   ├── main_event_page.html
│   ├── admindashboard.html
│   ├── codeimposter.html
│   └── fizzbuzz.html
│
├── backend/
│   ├── server.js
│   ├── aiScorer.js
│   ├── package.json
│   └── .env
│
├── README.md
└── .gitignore
```

---

## 🚀 Running the Project

### 1. Start the backend

```bash
cd backend
node server.js
```

Server runs on **http://localhost:3000**

### 2. Start the frontend

```bash
cd frontend
python -m http.server 8080
```

Open:

```text
http://localhost:8080/homepage.html
```

---

## 🎯 Event Flow

1. Coordinator registers all teams.
2. Coordinator shuffles participants.
3. Seating arrangement is generated.
4. Participants log in.
5. Secret role is revealed.
6. Main coding event begins.
7. GitHub repository is submitted.
8. AI scoring and leaderboard are generated.

---

## 👥 Team

Developed for **ASTHRA 2K26 Coding Event**.

Built with HTML, CSS, JavaScript, Node.js, and Supabase.
