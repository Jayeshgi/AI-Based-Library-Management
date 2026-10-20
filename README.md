# 📚 Library Management System with Advanced Analytics

A comprehensive library management system built with FastAPI (backend) and React + Vite (frontend), featuring real-time analytics dashboard with AI-powered search and intelligent recommendations.

## 🎓 Academic Project Details

**Course:** Natural Language Processing (NLP)
**Class:** Semester VI (Third Year Engineering)
**College:** Pillai College of Engineering
**Official Website:** [https://www.pce.ac.in/](https://www.pce.ac.in/)

## 🚀 Quick Start

### Local setup (Windows)

Install Python 3.11+ and Node.js 20+, then run the following from the project root.

```powershell
# Create the Python environment and install backend packages
py -3.11 -m venv nlp_venv
.\\nlp_venv\\Scripts\\python.exe -m pip install -r requirements.txt

# Create your private configuration file and local SQLite demo database
Copy-Item .env.example .env
# Edit .env and set GEMINI_API_KEY if you want the AI chatbot enabled
.\\nlp_venv\\Scripts\\python.exe seed_database.py

# Install frontend packages and create its private Firebase configuration file
cd frontend
npm.cmd install
Copy-Item .env.example .env
```

Keep both `.env` files and `backend/app/credentials/firebase_key.json` private. They are ignored by Git. Firebase is required only for Google sign-in; student registration and admission-number login work without it. Shared demo passwords are disabled. Set a unique `ADMIN_PASSWORD` (at least 12 characters) and `ADMIN_EMAIL` in `.env` for admin login.

Start the application in two terminals:

```powershell
# Terminal 1, project root
.\\nlp_venv\\Scripts\\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2
cd frontend
npm.cmd run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173`).

## 📊 Advanced Analytics Dashboard

### 🎯 Key Metrics Displayed
- **Active Users**: Total registered students (300+)
- **Total Books**: Complete library collection (310 books)
- **Currently Borrowed**: Active book loans
- **Overdue Books**: Books needing attention
- **Return Rate**: On-time return percentage
- **Total Borrows**: All-time transactions (200+)
- **Daily Average**: Average borrows per day

### 📈 Interactive Charts & Visualizations
1. **Borrowing Trends**: Area chart showing daily borrowing patterns (last 7 days)
2. **Popular Subjects**: Pie chart of department-wise book popularity
3. **Most Borrowed Books**: Horizontal bar chart of top borrowed titles
4. **Most Searched Books**: AI semantic search analytics with rankings
5. **Student Distribution**: Department-wise student enrollment statistics
6. **Recent Activity**: Real-time borrow/return activity feed

## 🧠 AI-Powered Features

### Semantic Search Engine
- **NLP Integration**: Uses sentence embeddings for intelligent book matching
- **HyDE: Hypothetical Document Embedding**:HyDE embeds a generated ideal answer to improve search results
- **Fuzzy Matching**: Supports approximate and relevance-based search
- **Search Analytics**: Logs and analyzes search patterns for insights
- **Smart Recommendations**: Context-aware book suggestions

### Intelligent Analytics
- **Real-time Processing**: Live data aggregation and visualization
- **Trend Detection**: Automated pattern recognition in borrowing behavior
- **Department Insights**: Subject-wise popularity analysis
- **Usage Pattern Analysis**: Student behavior and preferences tracking

## 🔧 API Endpoints

### Core Library Operations
- `GET /` - System health check
- `POST /student-register` - Register new students
- `POST /student-login` - Student authentication
- `GET /books` - Retrieve complete book catalog
- `PUT /borrow/{book_id}` - Process book borrowing
- `PUT /return/{book_id}` - Handle book returns
- `GET /search?q=query` - AI-powered semantic search

### Analytics & Insights
- `GET /analytics` - Comprehensive analytics data (enhanced)
- `GET /borrow-history` - Individual student transaction history

## 🎨 Frontend Features

### Admin Dashboard
- **📊 Analytics Tab**: Real-time insights with interactive charts
- **📚 Books Management**: Complete CRUD operations for library catalog
- **📋 Borrow Records**: Transaction tracking and management
- **👥 Student Directory**: User account administration
- **🎯 Overview**: System statistics and quick actions

### Student Interface
- **🔍 Smart Search**: AI-powered book discovery
- **📖 Book Browsing**: Intuitive catalog navigation
- **📚 Personal History**: Individual borrow records
- **👤 Account Management**: Profile and preferences

## 📊 Data Architecture

### SQL Data Sources (datasets) — Includes Books, Users, Borrowed_books, and Review tables with catalog, user data, borrowing history, and feedback records.
- `Books` -    Complete book catalog with metadata (310 books)
- `Students` - Student registration data (300+ students)
- `Borrowing  history` - Historical borrow and return records
- Review –    User reviews for books


### SQLite Database Schema
- **Students Table**: User accounts and departmental information
- **Books Table**: Digital catalog with embeddings
- **Borrow Records**: Complete transaction history with timestamps
- **Search Logs**: AI search analytics and query tracking

## 🛠️ Technology Stack

### Backend (FastAPI)
- **FastAPI**: High-performance async web framework
- **SQLAlchemy**: Advanced ORM for database operations
- **SQLite**: Lightweight, file-based database
- **Pandas**: Data processing and CSV manipulation
- **Gemini Embeddings**: API-based semantic search without a local model download
- **Google Generative Al (Gemini 2.5)**: Large Language Model for advanced text reasoning, summarization, and intent extraction
- **Firebase Admin SDK**: Server-side verification of user authentication tokens


### Frontend (React + Vite)
- **React 18**: Modern component-based UI framework
- **Vite**: Lightning-fast build tool and development server
- **TypeScript**: Type-safe JavaScript for robust development
- **Tailwind CSS**: Utility-first styling system
- **Recharts**: Interactive data visualization library
- **Lucide Icons**: Beautiful and consistent iconography
- **Firebase SDK**: Secure client-side Authentication (Login/Sign-up) and session managemen

## 📈 Analytics Data Pipeline

1. **Data Ingestion**: Real-time user interactions and system events
2. **Processing Layer**: SQL aggregation and metric calculations
3. **Visualization Layer**: React components with interactive charts
4. **Refresh Mechanism**: Automatic data updates on dashboard access

## 🎯 Usage Examples

### Access Analytics Dashboard
```javascript
// Automatic data fetching in React component
useEffect(() => {
  fetch("http://localhost:8000/analytics")
    .then(res => res.json())
    .then(data => setAnalyticsData(data))
    .catch(error => console.error("Analytics error:", error));
}, []);
```

### Student Registration
```javascript
const newStudent = {
  name: "Arjun Gupta",
  admission_no: "2025CS1000",
  department: "Computer Science",
  password: "secure_password_123"
};

fetch("http://localhost:8000/student-register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(newStudent)
});
```

### AI-Powered Book Search
```javascript
// Semantic search with NLP
const searchQuery = "machine learning algorithms";
fetch(`http://localhost:8000/search?q=${encodeURIComponent(searchQuery)}`)
  .then(res => res.json())
  .then(results => {
    // Results ranked by semantic similarity
    console.log("AI Search Results:", results);
  });
```

## 🚨 Troubleshooting Guide

### Backend Server Issues
```bash
# Check port availability
netstat -ano | findstr :8000

# Terminate conflicting processes
taskkill /PID <PROCESS_ID> /F

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Frontend Development Issues
```bash
# Clear cache and node modules
cd frontend
rm -rf node_modules package-lock.json .vite

# Fresh installation
npm install
npm run dev
```

### Database Reset
```bash
# Remove and recreate database
cd backend_new
del library.db
python -c "from database import engine; from models import Base; Base.metadata.create_all(bind=engine)"

# Repopulate sample data
python populate_data.py
```

## 📊 Performance Metrics

✅ **300+ Active Students** registered
✅ **310 Books** in digital catalog
✅ **200+ Transactions** processed
✅ **Real-time Analytics** with live updates
✅ **AI-Powered Search** with semantic matching
✅ **Interactive Charts** using Recharts
✅ **Responsive Design** for all devices
✅ **RESTful API** with comprehensive endpoints

## 🎉 Key Achievements

- **🤖 AI Integration**: NLP-based semantic search and recommendations
- **📊 Advanced Analytics**: Real-time dashboard with multiple chart types
- **🎨 Modern UI/UX**: Responsive design with dark mode support
- **⚡ High Performance**: FastAPI backend with async operations
- **🔒 Secure Authentication**: Student registration and login system
- **📱 Cross-Platform**: Works on desktop and mobile devices

---

**🚀 Ready to explore your intelligent library system?**

**Access URLs:**
- **Frontend:** `http://localhost:5176`
- **Backend API:** `http://localhost:8000`
- **API Documentation:** `http://localhost:8000/docs`
- **Analytics Data:** `http://localhost:8000/analytics`

**Navigation:** Frontend → Admin Login → Dashboard → Analytics Tab

**🎯 Experience AI-powered library management with comprehensive analytics!**
* Description
* Category
* Author

This data is processed using NLP techniques to recommend similar books.



## ⚙️ Installation

Steps to run the project:

```bash
git clone https://github.com/tejashree-pawar/nlp-mini-project.git
cd nlp-mini-project
```

### Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Install Frontend Dependencies

```bash
cd ../frontend
npm install
```



## ▶️ Usage

How to run the project:

### Start Backend

```bash
cd backend
uvicorn app.main:app --reload
```

### Start Frontend

```bash
cd frontend
npm run dev
```

### Access the Application

Open in browser:
http://localhost:5173



## 📈 Results

* Users can log in and access the system
* Books can be viewed and borrowed easily
* NLP-based recommendation system suggests similar books
* Improved search and discovery experience



## 🎥 Demo Video

[Youtube](https://www.youtube.com/watch?v=VOAcEu4kE0w)



## 👥 Team Members

* Sumit Roy
* Avani Srivastava
* Parth Patil
* Sarth Patil
* Veena Patil
* Abinraj Punnakkaparambil
* Tejashree Pawar
* Vedant Salve
* Keerthana Sambhu
* Aditya Shinde
* Jayesh Sonar
* Nihar Sudheer
* Vishal Singh

## 📚 References

* [Scikit-learn Documentation](https://scikit-learn.org/stable/user_guide.html)
* [FastAPI Documentation](https://share.google/64GowoMHRYIrMu1K2)
* [Quick Start – React](https://share.google/NCnHuAE3QPbzATbkS)
* [SentenceTransformers Documentation](https://share.google/yCp92ffMQYKPmXsow)
* [Firebase Documentation](https://share.google/7D87aoXyiXYxCS3t7)
* [HyDE: Hypothetical Document Embedding](https://cgorale111.medium.com/hyde-hypothetical-document-embeddings-3071840e364c)




