 f# GENESIS - Automated Breach Processing Pipeline

A full-stack application for processing, analyzing, and normalizing tabular data files (CSV, XLS, XLSX, and other structured formats). Genesis intelligently infers column structures, verifies field types, and generates normalized CSV files with properly encapsulated fields. The backend uses a robust Python pipeline powered by Gemini AI to automatically map and validate data fields, while the frontend provides a real-time dashboard to monitor processing status.

## Environment Setup & Installation

This guide will help you set up the complete development environment from scratch on Windows, macOS, or Linux.

### Prerequisites

Before starting, you'll need to install the following core tools:

#### 1. Python 3.11.13

**Windows:**
1. Download Python 3.11.13 from [python.org](https://www.python.org/downloads/release/python-31113/)
2. **Important**: During installation, check "Add Python to PATH"
3. Verify installation:
   ```cmd
   python --version
   # Should output: Python 3.11.13
   ```

**macOS:**
```bash
# Option 1: Using Homebrew (recommended)
brew install python@3.11

# Option 2: Using pyenv (for version management)
brew install pyenv
pyenv install 3.11.13
pyenv global 3.11.13

# Verify installation
python3.11 --version
```

**Linux (Ubuntu/Debian):**
```bash
# Add deadsnakes PPA for Python versions
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update

# Install Python 3.11.13
sudo apt install python3.11 python3.11-venv python3.11-dev

# Verify installation
python3.11 --version
```

**Linux (CentOS/RHEL/Fedora):**
```bash
# For newer versions with dnf
sudo dnf install python3.11 python3.11-venv

# For older versions with yum
sudo yum install python3.11 python3.11-venv

# Verify installation
python3.11 --version
```

#### 2. Node.js (v18 or higher)

**Windows:**
1. Download the Windows Installer from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the setup wizard
3. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

**macOS:**
```bash
# Option 1: Using Homebrew
brew install node

# Option 2: Using Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify installation
node --version
npm --version
```

**Linux:**
```bash
# Option 1: Using package manager (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Option 2: Using nvm (recommended for development)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Verify installation
node --version
npm --version
```

#### 3. Git

**Windows:**
1. Download Git from [git-scm.com](https://git-scm.com/download/win)
2. Run the installer with default settings
3. Verify installation:
   ```cmd
   git --version
   ```

**macOS:**
```bash
# Usually pre-installed, but can update via Homebrew
brew install git

# Verify installation
git --version
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install git

# CentOS/RHEL/Fedora
sudo dnf install git  # or sudo yum install git

# Verify installation
git --version
```

#### 4. Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy the generated API key (starts with `AIzaSy...`)
5. **Keep this key secure** - you'll need it for the environment configuration

### Project Setup

#### 1. Clone the Repository

```bash
# Clone the project
git clone <your-repository-url>
cd CSV_Pipeline

# Verify you're in the right directory
ls -la
# You should see: backend/, src/, package.json, requirements.txt, etc.
```

#### 2. Backend Setup (Python Environment)

**Step 2.1: Create Python Virtual Environment**

The project uses a specific virtual environment name: `venv_3.11.13`

**Windows:**
```cmd
# Create virtual environment
python -m venv venv_3.11.13

# Activate virtual environment
venv_3.11.13\Scripts\activate

# Verify activation (should show (venv_3.11.13) in prompt)
where python
# Should point to venv_3.11.13\Scripts\python.exe
```

**macOS/Linux:**
```bash
# Create virtual environment
python3.11 -m venv venv_3.11.13

# Activate virtual environment
source venv_3.11.13/bin/activate

# Verify activation (should show (venv_3.11.13) in prompt)
which python
# Should point to venv_3.11.13/bin/python
```

**Alternative: Using pyenv-virtualenv (Optional)**

If you have pyenv installed, you can use it for easier environment management:

```bash
# The project includes a .python-version file for automatic activation
pyenv virtualenv 3.11.13 venv_3.11.13
pyenv local venv_3.11.13

# The environment will activate automatically when you cd into the project
```

**Step 2.2: Install Python Dependencies**

With your virtual environment activated:

```bash
# Upgrade pip to latest version
pip install --upgrade pip

# Install all project dependencies
pip install -r requirements.txt

# Verify installation
pip list
# Should show fastapi, uvicorn, google-genai, and other packages
```

#### 3. Environment Configuration

**Step 3.1: Create Environment File**

The project includes a `.env_sample` file with all necessary environment variables:

**Windows:**
```cmd
# Copy the sample file
copy .env_sample .env
```

**macOS/Linux:**
```bash
# Copy the sample file
cp .env_sample .env
```

**Step 3.2: Configure Environment Variables**

Open the newly created `.env` file in your preferred text editor and update the following:

```env
# REQUIRED: Replace with your actual Gemini API key
GEMINI_API_KEY=AIzaSyAAm...REPLACE...

# OPTIONAL: These have sensible defaults, modify if needed
SAMPLE_THRESHOLD=1000
INPUT_DIR=data/inbound
OUTPUT_DIR=data/output
INVALID_DIR=data/invalid
LOGS_DIR=logs
DATABASE_URL=sqlite:///pipeline.db
API_HOST=localhost
API_PORT=8000
PIPELINE_MODE=real
NEXT_PUBLIC_PIPELINE_MODE=real
```

**Critical Steps:**
1. **Replace `GEMINI_API_KEY`**: Change `AIzaSyAAm...REPLACE...` to your actual API key from Google AI Studio
2. **Verify no extra spaces**: Ensure there are no spaces around the `=` sign
3. **Keep the file secure**: Add `.env` to `.gitignore` (already included) to avoid committing API keys

#### 4. Frontend Setup (Node.js)

**Step 4.1: Install Node.js Dependencies**

```bash
# Ensure you're in the project root directory
# Install all frontend dependencies
npm install

# This will install Next.js, React, Tailwind CSS, and other frontend packages
# The process may take 2-5 minutes depending on your internet connection
```

**Step 4.2: Verify Frontend Installation**

```bash
# Check if all dependencies are installed correctly
npm list --depth=0

# You should see packages like:
# next@15.3.3
# react@18.3.1
# @radix-ui/react-*
# etc.
```

#### 5. Database Setup

The application uses SQLite and automatically creates the database schema when first started. No manual database initialization is required.

**How it works:**
- The SQLite database (`backend/pipeline.db`) is created automatically when the backend starts
- Database tables are generated from SQLAlchemy models using `Base.metadata.create_all()`
- If you need to reset the database, simply delete `backend/pipeline.db` and restart the application

**Note:** The project includes Alembic for database migrations, but this is only needed for advanced use cases when modifying the database schema. For normal setup and usage, the automatic schema creation is sufficient.

## Running the Application

Once your environment is set up, follow these steps to start Genesis and begin processing tabular files.

### Quick Start Guide

#### Step 1: Start the Backend API

The backend provides the core processing pipeline and REST API endpoints.

**Windows:**
```cmd
# Navigate to project root and activate virtual environment
cd CSV_Pipeline
venv_3.11.13\Scripts\activate

# Navigate to backend directory
cd backend

# Start the FastAPI server
python -m uvicorn src.api.app:app --reload --host 0.0.0.0 --port 8000
```

**macOS/Linux:**
```bash
# Navigate to project root and activate virtual environment
cd CSV_Pipeline
source venv_3.11.13/bin/activate

# Navigate to backend directory
cd backend

# Start the FastAPI server
python -m uvicorn src.api.app:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Will watch for changes in these directories: ['/path/to/CSV_Pipeline/backend']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Verify Backend is Running:**
- Open your browser and go to: http://localhost:8000
- You should see a JSON response indicating the API is running
- Visit http://localhost:8000/docs for the interactive API documentation (Swagger UI)

#### Step 2: Start the Frontend Dashboard

Open a **new terminal window** (keep the backend running) and start the frontend:

**All Platforms:**
```bash
# Navigate to project root (if not already there)
cd CSV_Pipeline

# Start the Next.js development server
npm run dev
```

**Expected Output:**
```
▲ Next.js 15.3.3
- Local:        http://localhost:9002
- Environments: .env

✓ Starting...
✓ Ready in 2.1s
```

**Verify Frontend is Running:**
- Open your browser and go to: http://localhost:9002
- You should see the Genesis dashboard interface
- The dashboard will initially show "No files processed yet" or similar

### Processing Your First File

Once both services are running, you can start processing files:

#### Step 3: Add Files for Processing

**Method 1: File Drop (Automatic Processing)**
```bash
# Copy a tabular file to the input directory
# The file will be processed automatically

# Windows:
copy "C:\path\to\your\file.csv" "backend\data\inbound\"

# macOS/Linux:
cp /path/to/your/file.csv backend/data/inbound/
```

**Method 2: Manual File Addition**
1. Navigate to `backend/data/inbound/` in your file manager
2. Copy or move your tabular files (CSV, XLS, XLSX) into this directory
3. Files will be processed automatically within seconds

**Supported File Types:**
- `.csv` - Comma-separated values
- `.xls` - Excel 97-2003 format
- `.xlsx` - Excel 2007+ format
- `.tsv` - Tab-separated values
- Other delimited text files

#### Step 4: Monitor Processing

**Real-time Dashboard:**
- Go to http://localhost:9002 to watch processing in real-time
- The dashboard shows:
  - File status (Enqueued → Running → Completed/Error)
  - Processing stages and duration
  - File statistics (rows processed, validation results)
  - Download links for processed files

**Processing Stages:**
1. **Classification**: File validation and format detection
2. **Sampling**: Extract representative data sample
3. **AI Analysis**: Gemini AI analyzes structure and maps fields
4. **Normalization**: Apply transformations and generate clean output

#### Step 5: Retrieve Processed Files

**Successful Processing:**
- Normalized files appear in: `backend/data/output/`
- Download via dashboard or access directly from filesystem
- Files are properly formatted CSV with standardized headers

**Failed Processing:**
- Failed files are moved to: `backend/data/invalid/`
- Check processing logs in: `backend/logs/`
- Dashboard shows error details

### Development Mode Features

#### Hot Reload
- **Backend**: Code changes trigger automatic server restart (using `--reload` flag)
- **Frontend**: Component changes reflect immediately in browser

#### API Documentation
- Interactive API docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc
- Health check endpoint: http://localhost:8000/health

#### Logging
- **Backend logs**: Displayed in terminal where uvicorn is running
- **File processing logs**: Stored in `backend/logs/` with unique filenames
- **Frontend logs**: Available in browser developer console

### Stopping the Application

#### Stop Frontend
```bash
# In the frontend terminal, press:
Ctrl + C  # (Cmd + C on macOS)
```

#### Stop Backend
```bash
# In the backend terminal, press:
Ctrl + C  # (Cmd + C on macOS)
```

#### Clean Shutdown
```bash
# Deactivate Python virtual environment (if active)
deactivate
```

### Common Runtime Issues

#### Backend Won't Start

**Issue**: `Address already in use` (Port 8000)
**Solution**: 
```bash
# Check what's using port 8000
# Windows:
netstat -ano | findstr :8000

# macOS/Linux:
lsof -i :8000

# Kill the process or use a different port:
python -m uvicorn src.api.app:app --reload --port 8001
```

**Issue**: `ModuleNotFoundError`
**Solution**: Ensure virtual environment is activated and dependencies installed:
```bash
source venv_3.11.13/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

#### Frontend Won't Start

**Issue**: `Error: Cannot find module 'next'`
**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

**Issue**: Port 9002 already in use
**Solution**: Next.js will automatically try the next available port, or specify one:
```bash
npm run dev -- --port 9003
```

#### File Processing Issues

**Issue**: Files not processing automatically
**Solutions**:
1. Check backend logs for errors
2. Verify file permissions in `backend/data/inbound/`
3. Ensure file format is supported
4. Check Gemini API key in `.env` file

**Issue**: Processing fails with API errors
**Solutions**:
1. Verify Gemini API key at https://aistudio.google.com/
2. Check internet connectivity
3. Review API quota/limits

### Next Steps

With Genesis running successfully, you can:
- **Process multiple files**: Drop several files into the input directory
- **Monitor pipeline performance**: Use the dashboard to track processing metrics
- **Access the API**: Integrate with other tools using the REST API
- **Explore output**: Review normalized CSV files and AI analysis results

## System Architecture

Genesis is built as a modern, full-stack application with a clear separation between backend processing and frontend visualization. The architecture is designed for scalability, maintainability, and real-time user feedback.

### High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GENESIS ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js + React)                                    │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Dashboard     │    │   Components    │                    │
│  │   (Real-time)   │◄──►│   (UI/Forms)    │                    │
│  └─────────────────┘    └─────────────────┘                    │
│           │                       │                            │
│           ▼                       ▼                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              WebSocket + REST API                       │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                           │
├─────────────────────────────────────────────────────────────────┤
│  API Layer                                                     │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   REST Routes   │    │   WebSocket     │                    │
│  │   (/runs, etc.) │    │   (Real-time)   │                    │
│  └─────────────────┘    └─────────────────┘                    │
│           │                       │                            │
│           ▼                       ▼                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Processing Pipeline                        │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │  │
│  │  │ Watcher │→│Classify │→│ Sample  │→│ Normalize   │   │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│           │                       │                            │
│           ▼                       ▼                            │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   SQLite DB     │    │   Gemini AI     │                    │
│  │   (Pipeline     │    │   (Analysis)    │                    │
│  │    Tracking)    │    │                 │                    │
│  └─────────────────┘    └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FILE SYSTEM                                  │
├─────────────────────────────────────────────────────────────────┤
│  data/inbound/     │  data/output/     │  data/invalid/         │
│  (Input files)     │  (Processed)      │  (Failed files)        │
│                    │                   │                        │
│  logs/             │  backend/         │                        │
│  (Processing logs) │  (Database)       │                        │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Architecture (FastAPI)

#### 1. **FastAPI Application Layer**

**Location**: `backend/src/api/app.py`

The FastAPI application serves as the central communication hub, providing both REST API endpoints and WebSocket connections for real-time updates.

**Key Components**:

```python
# Core FastAPI Setup
app = FastAPI(
    title="CSV Pipeline API",
    description="API for CSV processing pipeline",
    version="1.0.0"
)

# CORS Middleware for Frontend Communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Main Features**:
- **Auto-documentation**: Swagger UI at `/docs`, ReDoc at `/redoc`
- **Type Safety**: Pydantic models for request/response validation
- **Error Handling**: Comprehensive HTTP exception handling
- **Background Tasks**: File processing runs in background threads

#### 2. **REST API Endpoints**

**Core Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/runs` | List all pipeline runs with status |
| `GET` | `/runs/{run_id}` | Get detailed run information |
| `GET` | `/runs/{run_id}/download` | Download processed CSV file |
| `GET` | `/api/pipeline/status` | Get pipeline status (frontend format) |
| `POST` | `/upload` | Upload files via API |
| `GET` | `/health` | Health check endpoint |

**Example API Response**:
```json
{
  "id": "uuid-string",
  "filename": "data.csv",
  "status": "ok",
  "insertion_date": "2025-01-20T10:30:00Z",
  "duration_ms": 45000,
  "original_row_count": 10000,
  "final_row_count": 9987,
  "valid_row_percentage": 99.87,
  "ai_model": "gemini-1.5-flash",
  "estimated_cost": 0.0045
}
```

#### 3. **WebSocket Real-Time Communication**

**Location**: `backend/src/api/app.py` - WebSocket endpoint

**Endpoint**: `ws://localhost:8000/ws/pipeline`

**Purpose**: Provides real-time updates to the frontend dashboard as files are processed.

**WebSocket Flow**:
```python
@app.websocket("/ws/pipeline")
async def pipeline_ws(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    
    # Send periodic updates to all connected clients
    while True:
        # Fetch latest pipeline runs
        runs = get_latest_runs()
        sanitized_data = sanitize_for_json(runs)
        await websocket.send_json(sanitized_data)
```

**Real-time Updates Include**:
- File processing status changes
- Stage completion notifications
- Error alerts
- Processing statistics
- Queue status updates

#### 4. **Database Layer (SQLite + SQLAlchemy)**

**Location**: `backend/src/models/pipeline_run.py`

**Database Schema**:
```python
class PipelineRun(Base):
    __tablename__ = 'pipeline_runs'
    
    # Core identifiers
    id = Column(String, primary_key=True)
    filename = Column(String, nullable=False)
    status = Column(String, default='enqueued')
    
    # Timing information
    insertion_date = Column(DateTime(timezone=True))
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    duration_ms = Column(Integer)
    
    # Processing results
    gemini_header_mapping = Column(Text)  # JSON
    original_row_count = Column(Integer)
    final_row_count = Column(Integer)
    valid_row_percentage = Column(Float)
    
    # AI/Cost tracking
    ai_model = Column(String)
    gemini_input_tokens = Column(Integer)
    gemini_output_tokens = Column(Integer)
    estimated_cost = Column(Float)
```

**Database Features**:
- **Automatic Schema Creation**: `Base.metadata.create_all()`
- **Connection Pooling**: SQLAlchemy session management
- **Data Integrity**: Foreign key constraints and validations
- **JSON Storage**: Complex data stored as JSON in TEXT columns

#### 5. **File Watcher System**

**Location**: `backend/src/pipeline/watcher.py`

**Technology**: Python `watchdog` library for filesystem monitoring

**Functionality**:
```python
class FileWatcher:
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator
        self.observer = Observer()
        
    def start_watching(self, path):
        # Monitor input directory for new files
        self.observer.schedule(handler, path, recursive=False)
        self.observer.start()
```

**Features**:
- **Real-time Detection**: Instant file detection when dropped
- **Archive Support**: Auto-extracts ZIP, 7Z, TAR, RAR files
- **File Validation**: Pre-processing validation checks
- **Recursive Extraction**: Handles nested archives
- **Queue Management**: Automatically enqueues detected files

#### 6. **Processing Pipeline Orchestrator**

**Location**: `backend/src/pipeline/orchestrator.py`

**Role**: Coordinates all processing stages and manages pipeline flow

```python
class PipelineOrchestrator:
    def process_file(self, file_path, db_session):
        # Stage 1: Classification
        classification_result = classifier.classify_file(file_path)
        
        # Stage 2: Sampling  
        sample_path = sampler.create_sample(file_path)
        
        # Stage 3: AI Analysis
        ai_result = gemini_query.analyze_structure(sample_path)
        
        # Stage 4: Normalization
        output_path = normalizer.normalize_file(file_path, ai_result)
```

**Features**:
- **Stage Management**: Tracks progress through each processing stage
- **Error Handling**: Comprehensive error recovery and logging
- **Database Updates**: Real-time status updates to database
- **Resource Management**: Memory and CPU optimization
- **Parallel Processing**: Queue-based concurrent file processing

### Frontend Architecture (Next.js + React)

#### 1. **Next.js Application Structure**

**Location**: `src/app/`

**Framework**: Next.js 15 with App Router

**Key Features**:
- **Server-Side Rendering**: Optimized page loading
- **TypeScript**: Full type safety throughout
- **Tailwind CSS**: Utility-first styling
- **Component Architecture**: Modular, reusable components

#### 2. **Real-Time Dashboard**

**Location**: `src/components/csv-monitor/`

**Core Components**:
- **Dashboard**: Main file monitoring interface
- **StatusIndicator**: Visual status representations
- **FileTable**: Sortable, filterable file list
- **ProgressBar**: Real-time processing progress
- **ErrorDialog**: Detailed error information

**WebSocket Integration**:
```typescript
// Real-time connection to backend
const ws = new WebSocket('ws://localhost:8000/ws/pipeline');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateDashboard(data);
};
```

#### 3. **State Management**

**Technology**: React hooks + Context API

**Features**:
- **Real-time Updates**: WebSocket-driven state changes
- **Optimistic Updates**: Immediate UI feedback
- **Error Boundaries**: Graceful error handling
- **Caching**: Efficient data management

#### 4. **UI Components**

**Component Library**: Radix UI + Custom Components

**Key UI Elements**:
- **Data Tables**: Sortable, filterable pipeline run tables
- **Status Badges**: Color-coded processing status indicators
- **Progress Indicators**: Real-time processing progress
- **File Upload**: Drag-and-drop file interface
- **Download Buttons**: Direct access to processed files

### Data Flow Architecture

#### 1. **File Processing Flow**

```
File Drop → Watcher Detection → Queue Addition → Pipeline Processing
                                      ↓
WebSocket Updates ← Status Changes ← Database Updates ← Stage Completion
         ↓
Frontend Dashboard ← Real-time UI Updates
```

#### 2. **Communication Patterns**

**Backend to Frontend**:
- **WebSocket**: Real-time processing updates
- **REST API**: On-demand data retrieval
- **File Downloads**: Direct file serving

**Frontend to Backend**:
- **API Calls**: Status queries, file management
- **WebSocket**: Connection management
- **File Upload**: Direct file submission

#### 3. **Error Handling Flow**

```
Processing Error → Error Logging → Database Update → WebSocket Notification
                                           ↓
                   Frontend Error Display ← Real-time Error Propagation
```

### Security Architecture

#### 1. **API Security**
- **CORS Configuration**: Controlled cross-origin access
- **Input Validation**: Pydantic model validation
- **File Type Validation**: Secure file processing
- **Error Sanitization**: No sensitive data in responses

#### 2. **Data Security**
- **Local Processing**: No data leaves your environment
- **API Key Protection**: Secure environment variable storage
- **Database Security**: SQLite file permissions
- **Log Security**: Sensitive data filtering in logs

### Scalability Design

#### 1. **Horizontal Scaling Ready**
- **Stateless API**: Easy to replicate across instances
- **Database Abstraction**: Ready for PostgreSQL/MySQL migration
- **Queue System**: Background processing architecture
- **WebSocket Broadcasting**: Multi-instance support ready

#### 2. **Performance Optimizations**
- **Background Processing**: Non-blocking file processing
- **Efficient Sampling**: Process large files via representative samples
- **Database Indexing**: Optimized query performance
- **Memory Management**: Streaming file processing
- **Caching**: Frontend data caching strategies

This architecture provides a robust, scalable foundation for tabular data processing while maintaining real-time user feedback and comprehensive error handling.

## Pipeline Processing Stages - Deep Dive

Genesis processes tabular files through a sophisticated 4-stage pipeline, each designed with specialized logic and heuristics to handle the complexities of real-world data. Understanding these stages is crucial for troubleshooting, optimization, and extending the system.

### Pipeline Orchestrator: The Central Coordinator

**Location**: `backend/src/pipeline/orchestrator.py`

The orchestrator acts as the master conductor of the entire pipeline, managing the flow between stages while maintaining comprehensive tracking and error recovery capabilities.

#### Orchestration Logic

The orchestrator follows a strict sequential processing model where each stage must complete successfully before proceeding to the next. This design ensures data integrity and provides clear failure points for debugging.

**Stage Management Process:**
1. **Initialization**: Creates a new pipeline run record in the database with a unique UUID and sets status to "enqueued"
2. **Sequential Execution**: Processes each stage in order, updating the database status in real-time
3. **Error Isolation**: If any stage fails, the entire pipeline stops and the error is isolated to that specific stage
4. **Resource Cleanup**: Ensures temporary files are cleaned up and database connections are properly closed
5. **Status Broadcasting**: Uses WebSocket connections to notify the frontend of status changes in real-time

**Error Recovery Strategy:**
The orchestrator implements a "fail-fast" approach where errors are immediately caught, logged with full context, and the file is moved to the appropriate failure directory. This prevents corrupted data from propagating through the system while providing clear diagnostics for troubleshooting.

**Database Integration:**
Every stage transition, timing information, and result metadata is immediately persisted to the SQLite database. This ensures that even if the process crashes, the current state is preserved and can be resumed or analyzed later.

### Stage 1: File Classification - Determining Data Viability

**Location**: `backend/src/pipeline/classifier.py`

The classification stage serves as the gatekeeper, determining whether a file contains tabular data worth processing. This stage implements sophisticated heuristics to distinguish between genuine tabular data and other file types, with completely different logic for text-based files versus Excel files.

#### File Type Detection and Validation

**Supported File Type Filtering:**
The classifier first validates that the file has a supported extension before proceeding with any analysis. Supported formats include:
- **Text-based**: `.csv`, `.tsv`, `.psv`, `.dat`, `.data`, `.txt`
- **Excel formats**: `.xls`, `.xlsx`, `.ods`

Files with unsupported extensions are immediately rejected to avoid wasting processing time on incompatible formats.

**Basic File Integrity Checks:**
Before diving into content analysis, the classifier performs fundamental sanity checks:
1. **File Existence**: Verifies the file actually exists at the specified path
2. **File Size**: Checks that the file isn't empty (0 bytes)
3. **Read Permissions**: Ensures the system can access the file for reading

#### Text-Based File Analysis Logic

**Advanced Encoding Detection Strategy:**
The classifier implements a sophisticated multi-tier encoding detection system to handle the diverse character encodings found in real-world data:

**Tier 1 - UTF-8 First Attempt:**
The system prioritizes UTF-8 because it's the modern standard and succeeds for approximately 90% of contemporary files. This includes special handling for:
- **BOM Detection and Removal**: Automatically detects and strips UTF-8 Byte Order Marks (`\ufeff`) that some editors add
- **Line Ending Normalization**: Converts Windows (`\r\n`) and Mac (`\r`) line endings to Unix standard (`\n`)
- **Comprehensive Error Handling**: Catches both Unicode decode errors and unexpected file access issues

**Tier 2 - Statistical Encoding Detection:**
When UTF-8 fails, the system uses the `chardet` library for intelligent encoding detection:
- **Sample Size Optimization**: Reads 4KB samples for statistical analysis, balancing accuracy with performance
- **Confidence Thresholds**: Only accepts chardet results with reasonable confidence scores
- **Fallback Preparation**: Adds detected encoding to a prioritized list for systematic testing

**Tier 3 - Legacy Encoding Fallbacks:**
For historical files, the system attempts common legacy encodings in order of likelihood:
- `utf-8-sig` (UTF-8 with explicit BOM handling)
- `utf-16` and `utf-32` (Unicode variants)
- `latin1` (covers most Western European legacy data)

**Encoding Validation Logic:**
For each encoding attempt, the classifier:
1. **Tests Readability**: Attempts to read the entire file without errors
2. **Content Validation**: Ensures the result contains actual readable lines (not just empty content)
3. **Success Logging**: Records which encoding succeeded for debugging and optimization

#### Revolutionary Tabular Detection Algorithm

**The Delimiter Pattern Consistency Method:**
Unlike simple column counting approaches, Genesis implements a sophisticated pattern matching algorithm that analyzes delimiter consistency across the entire file structure.

**Smart Sampling Strategy:**
The classifier uses an intelligent sampling approach to handle files of any size efficiently:
1. **Complete First 50 Lines**: Always analyzes the first 50 lines completely to capture headers and initial data patterns
2. **Distributed Sampling**: For larger files, samples additional lines evenly distributed throughout the file (up to 10,000 total sampled lines)
3. **Pattern Preservation**: Ensures the sample represents the overall file structure, not just the beginning

**Delimiter Pattern Analysis:**
The core innovation is analyzing complete delimiter patterns rather than just counting separators:

**Step 1 - Multi-Delimiter Detection:**
For each sampled line, the system counts occurrences of five common delimiters: comma (`,`), semicolon (`;`), pipe (`|`), tab (`\t`), and colon (`:`)

**Step 2 - Pattern Fingerprinting:**
Creates a unique "fingerprint" for each line consisting of the exact count of each delimiter type. For example:
- Line with "name,age|address:city,zip" would have fingerprint: `{',': 2, '|': 1, ':': 1}`
- Line with "john,25|123 main:NYC,10001" would have the same fingerprint: `{',': 2, '|': 1, ':': 1}`

**Step 3 - Consistency Analysis:**
Groups lines by their delimiter fingerprints and calculates what percentage of lines share the most common pattern.

**Tabular Classification Logic:**
A file is considered tabular if:
1. **Primary Pattern Threshold**: At least 10% of non-empty lines share the exact same delimiter fingerprint, AND that fingerprint contains at least one delimiter
2. **Secondary Pattern Fallback**: If the most common pattern has no delimiters (pure text lines), but the second most common pattern has delimiters and appears in at least 10% of lines, the file can still qualify as tabular

**Edge Case Handling:**
- **Empty Line Tolerance**: Ignores completely empty lines in pattern analysis
- **Mixed Content Support**: Handles files with occasional non-tabular lines (headers, footers, comments)
- **Complex Delimiter Combinations**: Correctly identifies files using multiple different delimiters in consistent patterns

#### Excel File Analysis - Simplified Approach

**Structure-Based Classification:**
For Excel files, the classifier takes a fundamentally different approach since the tabular structure is inherently defined by the spreadsheet format.

**Pandas-Based Content Validation:**
1. **File Format Validation**: Uses pandas' robust Excel reading capabilities to handle various Excel formats (`.xls`, `.xlsx`, `.ods`)
2. **Content Existence Check**: Verifies that the spreadsheet contains actual data beyond empty cells
3. **Data Quality Assessment**: Ensures cells contain meaningful content rather than just whitespace

**Automatic Tabular Assumption:**
If an Excel file can be successfully read and contains non-empty data, it's automatically classified as tabular. This eliminates the need for complex delimiter analysis since Excel's structure inherently defines column boundaries.

**Error Handling for Excel Files:**
- **Format Corruption Detection**: Catches and reports corrupted Excel files that can't be opened
- **Empty Workbook Handling**: Identifies and rejects Excel files with no meaningful content
- **Memory Management**: Uses pandas' optimized Excel reading to handle large spreadsheets efficiently

#### Classification Results and Quality Metrics

**Comprehensive Metadata Collection:**
For successful classifications, the system captures:
- **File Properties**: Size in bytes, total row count, detected encoding
- **Structure Information**: Dominant delimiter pattern, pattern consistency percentage
- **Quality Indicators**: Confidence scores, warnings about irregular patterns
- **Processing Notes**: Which encoding tier succeeded, any content issues detected

**Detailed Failure Analysis:**
Failed classifications include specific diagnostic information:
- **Failure Category**: Encoding issues, insufficient structure, empty content, unsupported format
- **Diagnostic Details**: Attempted encodings, pattern analysis results, specific error messages
- **Recovery Suggestions**: Guidance for manual intervention when possible

**Warning System:**
The classifier generates warnings for borderline cases:
- **Low Confidence Patterns**: When delimiter consistency is just above the threshold
- **Mixed Content Detection**: When files contain both tabular and non-tabular sections
- **Encoding Ambiguity**: When multiple encodings could potentially work

This sophisticated classification system ensures that only genuinely tabular files proceed to the expensive AI analysis stage, while providing detailed diagnostics for files that don't qualify.

### Stage 2: Sample Extraction - Intelligent Data Sampling

**Location**: `backend/src/pipeline/sampler.py`

The sampling stage creates a representative subset of the file that captures the essential structure and content patterns while staying within AI processing limits. This stage is crucial for both performance and cost optimization.

#### Sampling Strategy and Logic

**Row-Based Sampling:**
The sampler extracts up to 1,000 rows from the beginning of the file, which provides sufficient diversity for most files while maintaining processing speed. This count was chosen based on analysis showing that column patterns and data types typically stabilize within the first few hundred rows.

**Intelligent Row Selection:**
Rather than taking exactly the first 1,000 rows, the sampler implements smart selection:

1. **Header Preservation**: Always includes the first row, as it's most likely to be a header.

2. **Representative Distribution**: For very large files, takes evenly distributed samples to capture variations that might occur throughout the file.

3. **Error Tolerance**: Skips malformed rows that can't be parsed rather than failing the entire sampling process.

#### Text File Processing Logic

**Robust CSV Parsing:**
The sampler uses Python's built-in CSV reader to handle quoted fields, escaped characters, and embedded delimiters correctly. This is crucial because simple string splitting fails on complex CSV data where commas might appear within quoted fields.

**Error Handling During Sampling:**
When encountering unparseable lines, the sampler logs warnings but continues processing. This approach ensures that a few corrupted rows don't prevent analysis of an otherwise valid file.

**Memory Efficiency:**
The sampler processes files line-by-line rather than loading everything into memory, allowing it to handle files much larger than available RAM.

#### Excel File Sampling

**Pandas Integration:**
For Excel files, the sampler leverages pandas' robust Excel reading capabilities, which handle various Excel formats, merged cells, and formatting issues that simpler libraries might struggle with.

**Data Type Preservation:**
The sampler converts Excel data types to strings while preserving the original formatting, ensuring that dates, numbers, and text are all handled consistently in downstream processing.

**NaN Value Handling:**
Empty Excel cells (NaN values) are converted to empty strings, maintaining column alignment while avoiding processing errors.

#### Token Optimization Logic

**AI Cost Management:**
Since AI processing costs are based on token count, the sampler implements intelligent token optimization:

1. **Token Estimation**: Uses a rough approximation (4 characters per token) to estimate whether the sample will fit within cost-effective limits.

2. **Progressive Reduction**: If the sample is too large, reduces the number of rows while maintaining representativeness by taking evenly distributed samples.

3. **Content Preservation**: Ensures that each column type is represented in the final sample, even if overall row count is reduced.

**Quality vs. Cost Balance:**
The optimization logic balances between providing enough data for accurate AI analysis while keeping costs reasonable for large files.

### Stage 3: Gemini AI Analysis - Intelligent Structure Recognition

**Location**: `backend/src/pipeline/gemini_query.py`

This stage represents the intelligent core of Genesis, where Google's Gemini AI analyzes the file sample and makes sophisticated decisions about column meanings, data types, and standardization requirements.

#### Known Headers Database

**Comprehensive Header Mapping:**
Genesis maintains a curated database of over 250 standardized header types covering virtually every type of personal, business, and technical data commonly found in breach data, customer databases, and business files. These headers are organized into logical categories like personal data, financial information, location data, digital identities, and technical specifications.

**Semantic Understanding:**
The known headers aren't just simple name mappings - they include semantic understanding of what each field represents, enabling the AI to match columns based on content patterns rather than just header text.

#### Advanced Prompt Engineering

**Context-Rich Instructions:**
The prompt sent to Gemini includes detailed context about the task, complete examples of expected output formats, and specific instructions for handling edge cases. This comprehensive approach significantly improves the consistency and accuracy of AI responses.

**Multi-Objective Analysis:**
The AI is asked to simultaneously perform several complex tasks:

1. **Content Analysis**: Examine actual data values, not just headers, to understand what each column contains
2. **Pattern Recognition**: Identify data types, formats, and validation requirements
3. **Structural Understanding**: Detect delimiters, prefixes, and formatting patterns
4. **Standardization Mapping**: Match columns to the most appropriate known headers or generate descriptive names

**Constraint Specification:**
The prompt includes specific constraints about delimiter detection, prefix handling, and output format requirements to ensure the AI response can be reliably processed by downstream stages.

#### Delimiter and Structure Analysis

**Complex Delimiter Detection:**
Genesis can handle files with mixed or unusual delimiters. The AI analyzes the actual separator patterns between columns, which might be different for each column boundary (e.g., "email,name|address:phone").

**Prefix vs. Delimiter Distinction:**
A critical aspect of the analysis is distinguishing between actual column separators and content prefixes. For example, in "email:password|Name: John|Country: USA", the AI must recognize that ":" after email is a separator, but "Name: " and "Country: " are prefixes to be stripped from values.

**Quote-Aware Processing:**
The AI understands how quoted regions work in CSV files and doesn't treat delimiters within quotes as column separators.

#### Response Processing and Validation

**Multi-Attempt Processing:**
The system implements intelligent retry logic with exponential backoff when AI requests fail. This handles temporary network issues or API rate limiting gracefully.

**Response Validation:**
Every AI response goes through comprehensive validation to ensure it contains all required fields, has consistent internal logic, and meets the expected format requirements.

**Quality Scoring:**
The system tracks how many columns were successfully mapped to known headers versus how many required AI-generated names, providing a quality metric for the analysis.

#### Token Management and Cost Control

**Accurate Token Counting:**
The system uses Gemini's official tokenizer to get precise token counts for both input prompts and AI responses, enabling accurate cost tracking.

**Cost Estimation:**
Real-time cost calculation using current Gemini pricing (approximately $0.15 per million input tokens and $0.60 per million output tokens) helps users understand the processing costs for their files.

**Budget Controls:**
The system can be configured with cost limits to prevent unexpectedly expensive processing of very large files.

### Stage 4: Normalization - Data Transformation and Quality Assurance

**Location**: `backend/src/pipeline/normalizer.py`

The normalization stage represents the culmination of the pipeline, where all the intelligence gathered from previous stages is applied to transform the raw data into a clean, standardized format.

#### Validation and Quality Gates

**Known Header Requirement:**
Before processing begins, the normalizer enforces a critical business rule: at least one column must map to a known header from the database. This ensures that the file contains recognizable data patterns and isn't just random text formatted to look tabular.

**Structure Consistency Checking:**
The normalizer validates that the AI-detected structure (number of columns, separator patterns) is consistent with the actual file content before beginning transformation.

#### Advanced Row Parsing Logic

**Mixed Delimiter Processing:**
The most complex aspect of normalization is correctly splitting rows when different column boundaries use different separators. The normalizer implements a sophisticated state machine that processes each character while tracking:

1. **Quote State**: Whether the current position is inside or outside quoted regions
2. **Separator Matching**: Which separator should appear at each column boundary
3. **Position Tracking**: The current column being processed

**Quote-Aware Splitting:**
The splitter carefully handles quoted regions where separators should be treated as literal text rather than column boundaries. This involves tracking quote state and only recognizing separators when outside quoted regions.

**Last Column Special Handling:**
The normalizer implements special logic for the last column because it often contains concatenated data or uses fallback delimiters. The system checks if a prefix is defined for the last column - if so, it doesn't attempt further splitting to avoid incorrectly breaking apart intended content.

**Column Count Determination:**
For each row, the normalizer determines the final column count through a multi-step process:

1. **Primary Splitting**: Uses the AI-detected separator pattern to split the row
2. **Validation**: Checks if the resulting column count matches expectations
3. **Secondary Splitting**: For the last column only, attempts splitting on fallback delimiters if no prefix is defined
4. **Quality Assessment**: Determines if the row meets quality standards for inclusion

#### Data Normalization Functions

**Type-Specific Processing:**
The normalizer applies different transformation logic based on the detected data type:

**Email Normalization:**
- Converts to lowercase for consistency
- Strips whitespace and quotes
- Validates basic email structure
- Preserves original format if validation fails (avoiding data loss)

**Date Handling:**
- Recognizes multiple date formats
- Preserves original format when conversion is ambiguous
- Handles edge cases like partial dates or date ranges

**General Text Processing:**
- Removes surrounding quotes that might have been added during export
- Trims whitespace while preserving intentional spaces
- Handles Unicode characters correctly

#### Prefix Stripping Logic

**Content Cleaning:**
The normalizer removes identified prefixes from column values (like "Name: " or "ID: ") that were detected during AI analysis. This cleaning happens after row splitting but before type-specific normalization.

**Selective Application:**
Prefix stripping is applied only to columns where the AI detected consistent prefix patterns, avoiding accidental removal of legitimate content.

#### Quality Control and Error Handling

**Row Validation Process:**
Each row goes through comprehensive validation:

1. **Column Count Verification**: Ensures the row has the expected number of columns
2. **Content Quality Check**: Validates that columns contain reasonable data
3. **Missing Data Handling**: Decides whether rows with missing data should be included or rejected

**Invalid Row Management:**
Rows that fail validation aren't simply discarded - they're written to a separate "invalid rows" file with detailed error explanations. This allows manual review and recovery of data that might have been incorrectly rejected.

**Success Metrics Calculation:**
The normalizer tracks detailed statistics including total rows processed, valid rows accepted, invalid rows rejected, and the percentage of successful processing. These metrics help assess file quality and processing success.

#### File Output Organization

**Multi-File Output Strategy:**
The normalization process creates several output files:

1. **Primary Output**: The clean, normalized CSV with standardized headers
2. **Invalid Rows File**: Rejected rows with error explanations for manual review
3. **Processing Log**: Detailed log of all transformations and decisions made

**Header Standardization:**
The output file uses the standardized header names determined by AI analysis, creating consistency across all processed files regardless of their original header formats.

**Data Integrity Preservation:**
Even when applying normalization, the system preserves original data whenever possible, only making changes that improve consistency without losing information.

#### Success Criteria and Failure Handling

**Processing Success Definition:**
A file is considered successfully processed when:
- At least one column maps to known headers
- Output file is successfully created with proper formatting
- All metadata is correctly saved to the database

**Graceful Failure Management:**
When processing fails, the system:
- Moves the original file to the invalid directory
- Creates detailed error logs explaining the failure
- Updates the database with failure status and error messages
- Notifies the frontend via WebSocket for immediate user feedback

This comprehensive normalization process ensures that Genesis produces high-quality, standardized output while maintaining transparency about its decisions and preserving data integrity throughout the transformation process.

## API Reference

Genesis provides a comprehensive REST API for monitoring, managing, and retrieving processed data. All endpoints return JSON responses and follow RESTful conventions.

### Core Pipeline Endpoints

#### `GET /runs`
**Description**: Retrieve all pipeline runs with their current status and metadata.

**Response Example**:
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "filename": "customer_data.csv",
    "status": "ok",
    "insertion_date": "2025-01-20T14:30:15.123Z",
    "duration_ms": 45230,
    "original_row_count": 5000,
    "final_row_count": 4987,
    "valid_row_percentage": 99.74,
    "ai_model": "gemini-1.5-flash",
    "estimated_cost": 0.0042
  }
]
```

#### `GET /runs/{run_id}`
**Description**: Get detailed information for a specific pipeline run, including stage-by-stage execution details.

**Parameters**:
- `run_id` (string): UUID of the pipeline run

**Response Example**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "filename": "customer_data.csv",
  "status": "ok",
  "stage_stats": {
    "classification": {
      "status": "ok",
      "start_time": "2025-01-20T14:30:15.123Z",
      "end_time": "2025-01-20T14:30:16.456Z",
      "duration_ms": 1333
    },
    "sampling": {
      "status": "ok", 
      "start_time": "2025-01-20T14:30:16.456Z",
      "end_time": "2025-01-20T14:30:17.789Z",
      "duration_ms": 1333
    },
    "gemini_query": {
      "status": "ok",
      "start_time": "2025-01-20T14:30:17.789Z", 
      "end_time": "2025-01-20T14:30:58.123Z",
      "duration_ms": 40334,
      "gemini_input_tokens": 2400,
      "gemini_output_tokens": 185
    },
    "normalization": {
      "status": "ok",
      "start_time": "2025-01-20T14:30:58.123Z",
      "end_time": "2025-01-20T14:31:00.456Z", 
      "duration_ms": 2333
    }
  },
  "detected_separator": ",",
  "detected_headers": ["name", "email", "phone", "address"],
  "mapped_headers": ["personal_name", "email_address", "phone_number", "street_address"]
}
```

#### `GET /runs/{run_id}/download`
**Description**: Download the normalized CSV file for a completed run.

**Parameters**:
- `run_id` (string): UUID of a successful pipeline run

**Response**: Binary CSV file with appropriate headers for download.

**Status Codes**:
- `200`: Success - Returns CSV file
- `404`: Run not found or file not available
- `400`: Run failed or not yet completed

#### `POST /upload`
**Description**: Upload files directly via API instead of using the file watcher.

**Content-Type**: `multipart/form-data`

**Form Parameters**:
- `file` (file): The CSV/Excel file to process
- `model` (string, optional): AI model to use (e.g., "gemini-1.5-flash")
- `priority` (boolean, optional): Set to true for priority processing

**Response Example**:
```json
{
  "message": "File uploaded successfully",
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "filename": "uploaded_file.csv"
}
```

### Monitoring and Analytics Endpoints

#### `GET /api/pipeline/status`
**Description**: Get current pipeline status in frontend-compatible format with real-time processing information.

**Response**: Array of processing entries with detailed stage information (same format as WebSocket updates).

#### `GET /api/pipeline/stats`
**Description**: Get aggregated statistics about pipeline performance.

**Response Example**:
```json
{
  "total": 1247,
  "processing": 3,
  "completed": 1195,
  "failed": 49
}
```

#### `GET /api/pipeline/metrics`
**Description**: Get detailed metrics for token consumption, cost estimation, and processing throughput over time.

**Query Parameters**:
- `range` (string): Time range - "24h", "7d", "30d", or "auto"
- `bucket` (string): Aggregation bucket - "hour", "day", "week", or "auto"

**Response Example**:
```json
{
  "buckets": ["2025-01-20T00:00:00Z", "2025-01-20T01:00:00Z"],
  "token_consumption": {
    "input": [2400, 1850],
    "output": [185, 142],
    "total": [2585, 1992]
  },
  "cost": [0.0042, 0.0033],
  "total_files": [5, 3]
}
```

#### `POST /api/pipeline/retry/{run_id}`
**Description**: Retry a failed pipeline run from the Gemini Query stage onwards.

**Parameters**:
- `run_id` (string): UUID of a failed pipeline run

**Requirements**: Run must have failed specifically at the gemini_query stage.

**Response Example**:
```json
{
  "message": "Retry initiated successfully",
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Real-Time WebSocket Connection

#### `WS /ws/pipeline`
**Description**: WebSocket endpoint for real-time pipeline status updates.

**Connection URL**: `ws://localhost:8000/ws/pipeline`

**Message Format**: JSON array of processing entries (same format as `/api/pipeline/status`)

**Update Frequency**: Every 2 seconds

**Example Usage**:
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/pipeline');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Pipeline status update:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  // Implement fallback to REST API polling
};
```

### Health and Documentation Endpoints

#### `GET /health`
**Description**: Health check endpoint for monitoring system availability.

**Response Example**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-20T14:30:15.123Z",
  "database": "connected",
  "file_watcher": "active"
}
```

#### `GET /docs`
**Description**: Interactive Swagger UI documentation.

#### `GET /redoc`
**Description**: Alternative ReDoc API documentation interface.

### Error Handling

All API endpoints use standard HTTP status codes:

- **200**: Success
- **400**: Bad Request (invalid parameters)
- **404**: Resource Not Found
- **422**: Validation Error (invalid input format)
- **500**: Internal Server Error

Error responses include detailed messages:
```json
{
  "detail": "Pipeline run with ID 'invalid-uuid' not found",
  "error_code": "RUN_NOT_FOUND"
}
```

### Rate Limiting and Performance

- **WebSocket connections**: Limited to prevent resource exhaustion
- **File uploads**: Maximum file size configurable (default: 100MB)
- **Concurrent processing**: Controlled by pipeline orchestrator
- **API rate limiting**: Currently not implemented (local use assumed)

## Configuration and Environment Variables

Genesis uses environment-based configuration for flexibility across different deployment scenarios. Configuration is managed through the `backend/src/config/settings.py` file and can be overridden using environment variables.

### Core Configuration Options

#### API Keys and External Services
```bash
# Required: Google Gemini AI API Key
GEMINI_API_KEY=AIzaSy...your-key-here

# Optional: Alternative AI model endpoints (future expansion)
OPENAI_API_KEY=sk-...your-key-here
ANTHROPIC_API_KEY=sk-ant-...your-key-here
```

#### Pipeline Processing Settings
```bash
# Sample size for AI analysis (default: 600 rows)
SAMPLE_THRESHOLD=600

# Minimum file size to trigger processing (default: 50 lines) 
MIN_FILE_LINES=50

# Processing mode: "demo" or "real"
PIPELINE_MODE=real
```

#### Directory Configuration
```bash
# File processing directories (relative to backend/ folder)
INPUT_DIR=data/inbound
OUTPUT_DIR=data/output
INVALID_DIR=data/invalid
NOT_TABULAR_DIR=data/not_tabular
LOGS_DIR=logs
```

#### Database Settings
```bash
# SQLite database location
DATABASE_URL=sqlite:///pipeline.db

# For production: PostgreSQL example
# DATABASE_URL=postgresql://user:pass@localhost/genesis_db
```

#### API Server Configuration
```bash
# Backend API settings
API_HOST=localhost
API_PORT=8000

# CORS settings (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:3000
```

#### Frontend Configuration
```bash
# Frontend environment variables (in .env.local)
NEXT_PUBLIC_PIPELINE_MODE=real
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Configuration File Structure

The main configuration class is located in `backend/src/config/settings.py`:

```python
class Settings(BaseSettings):
    # API Keys
    GEMINI_API_KEY: str = None
    
    # Pipeline Configuration  
    SAMPLE_THRESHOLD: int = 600
    MIN_FILE_LINES: int = 50
    
    # Directory paths
    INPUT_DIR: str = "data/inbound"
    OUTPUT_DIR: str = "data/output"
    
    # Database
    DATABASE_URL: str = "sqlite:///pipeline.db"
    
    # Server settings
    API_HOST: str = "localhost"
    API_PORT: int = 8000
    
    class Config:
        env_file = ".env"
        case_sensitive = True
```

### Environment-Specific Configuration

#### Development Environment
```bash
# .env (for development)
PIPELINE_MODE=real
GEMINI_API_KEY=your-development-key
DATABASE_URL=sqlite:///dev_pipeline.db
API_HOST=0.0.0.0
```

#### Production Environment
```bash
# .env.production
PIPELINE_MODE=real
GEMINI_API_KEY=your-production-key
DATABASE_URL=postgresql://genesis:password@db:5432/genesis_prod
API_HOST=0.0.0.0
API_PORT=8000
ALLOWED_ORIGINS=https://genesis.yourdomain.com
```

#### Demo/Testing Environment
```bash
# .env.demo
PIPELINE_MODE=demo
# No API key needed in demo mode
DATABASE_URL=sqlite:///:memory:
```

### Configuration Validation

Genesis automatically validates configuration on startup:

1. **Required API Keys**: Ensures GEMINI_API_KEY is present when PIPELINE_MODE=real
2. **Directory Creation**: Creates necessary directories if they don't exist
3. **Database Connection**: Validates database connectivity and runs migrations
4. **File Permissions**: Checks read/write permissions for all configured directories

### Dynamic Configuration Updates

Some settings can be updated without restarting the application:

- **Sample threshold**: Affects new pipeline runs only
- **Log levels**: Can be adjusted via environment variables
- **Directory monitoring**: File watcher adapts to directory changes

Critical settings requiring restart:
- **API keys**: Security-sensitive, requires full restart
- **Database URL**: Requires connection pool recreation
- **Server host/port**: Network binding changes

## Troubleshooting Guide

This section covers common issues you might encounter while setting up or running Genesis, along with step-by-step solutions.

### Installation and Setup Issues

#### Python Version Conflicts
**Problem**: ImportError or syntax errors when running the backend.

**Symptoms**:
```bash
SyntaxError: f-string expression part cannot include a backslash
ModuleNotFoundError: No module named 'typing_extensions'
```

**Solution**:
1. Verify Python version:
   ```bash
   python --version  # Should be 3.11.13
   ```
2. If wrong version, use pyenv or specific Python path:
   ```bash
   # Using specific Python version
   python3.11 -m venv backend/venv
   
   # Or with pyenv
   pyenv local 3.11.13
   ```

#### Virtual Environment Issues
**Problem**: Package installation fails or modules not found.

**Symptoms**:
```bash
ModuleNotFoundError: No module named 'fastapi'
pip: command not found
```

**Solution**:
1. Ensure virtual environment is activated:
   ```bash
   # Check if (venv) appears in prompt
   which python  # Should point to venv/bin/python
   ```
2. Reactivate if needed:
   ```bash
   source backend/venv/bin/activate  # Linux/macOS
   # or
   backend\venv\Scripts\activate  # Windows
   ```
3. Reinstall dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```

#### Node.js/npm Issues
**Problem**: Frontend dependencies fail to install.

**Symptoms**:
```bash
npm ERR! peer dep missing
Error: Cannot find module 'next'
```

**Solution**:
1. Clear npm cache:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   ```
2. Reinstall with specific Node version:
   ```bash
   nvm use 18  # If using nvm
   npm install
   ```
3. For permission issues on macOS/Linux:
   ```bash
   sudo chown -R $(whoami) ~/.npm
   ```

### API Key and Authentication Issues

#### Invalid Gemini API Key
**Problem**: Pipeline fails at Gemini Query stage.

**Symptoms**:
```
2025-01-20 14:30:45 - gemini_query - ERROR - API key invalid or expired
```

**Solution**:
1. Verify API key format:
   ```bash
   echo $GEMINI_API_KEY  # Should start with "AIzaSy"
   ```
2. Test API key manually:
   ```bash
   curl -H "x-goog-api-key: $GEMINI_API_KEY" \
        "https://generativelanguage.googleapis.com/v1beta/models"
   ```
3. Generate new key at [Google AI Studio](https://aistudio.google.com/)
4. Update environment file and restart backend

#### Environment Variable Not Loading
**Problem**: API key is set but not recognized by application.

**Symptoms**:
```
GEMINI_API_KEY not found in environment
```

**Solution**:
1. Check `.env` file location (should be in project root):
   ```bash
   ls -la .env  # File should exist
   cat .env | grep GEMINI_API_KEY  # Should show your key
   ```
2. Verify no extra spaces or quotes:
   ```bash
   # Correct format
   GEMINI_API_KEY=AIzaSyAbc123...
   
   # Incorrect formats
   GEMINI_API_KEY = AIzaSyAbc123...  # Extra spaces
   GEMINI_API_KEY="AIzaSyAbc123..."  # Unnecessary quotes
   ```
3. Restart backend after changes

### File Processing Issues

#### Files Not Being Detected
**Problem**: CSV files dropped in inbound directory aren't processed.

**Symptoms**:
- No log entries about new files
- Files remain in inbound directory
- Dashboard shows no new activity

**Solution**:
1. Check file watcher logs:
   ```bash
   tail -f backend/logs/*.log | grep -i watcher
   ```
2. Verify inbound directory path:
   ```bash
   ls -la backend/data/inbound/  # Should show your files
   ```
3. Check file permissions:
   ```bash
   ls -la backend/data/inbound/your-file.csv
   # Should be readable by the user running the backend
   ```
4. Restart backend to reinitialize file watcher

#### Classification Stage Failures
**Problem**: Files fail at classification stage.

**Symptoms**:
```
2025-01-20 14:30:45 - classifier - ERROR - Unable to detect encoding
2025-01-20 14:30:45 - classifier - ERROR - File does not appear to be tabular
```

**Solutions**:
1. **Encoding Issues**:
   - Try saving file as UTF-8 in your spreadsheet application
   - Use a text editor to verify file content
   - For Excel files, save as CSV instead of XLSX

2. **Non-tabular Structure**:
   - Ensure file has consistent delimiters (commas, tabs, etc.)
   - Remove any header/footer text that isn't part of the data
   - Verify file has at least 2 columns and 10 rows

3. **File Format Issues**:
   - Check file extension matches content (`.csv` for CSV files)
   - Remove any special characters from filename
   - Ensure file isn't corrupted

#### Gemini Query Stage Timeouts
**Problem**: Processing hangs at Gemini Query stage.

**Symptoms**:
```
2025-01-20 14:35:45 - gemini_query - WARNING - Request timeout, retrying...
2025-01-20 14:40:45 - gemini_query - ERROR - Max retries exceeded
```

**Solutions**:
1. **Large File Issues**:
   - Check if sample size is too large (default 600 rows)
   - Reduce SAMPLE_THRESHOLD in environment:
     ```bash
     SAMPLE_THRESHOLD=300
     ```

2. **API Rate Limiting**:
   - Wait a few minutes before retrying
   - Check Google AI Studio for quota limits
   - Consider upgrading to paid Gemini tier

3. **Network Issues**:
   - Verify internet connectivity
   - Check firewall settings for outbound HTTPS requests
   - Test API connectivity manually

### Database and Storage Issues

#### Database Connection Errors
**Problem**: Backend fails to start with database errors.

**Symptoms**:
```
sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) database is locked
sqlite3.OperationalError: unable to open database file
```

**Solutions**:
1. **Database Lock Issues**:
   ```bash
   # Kill any hanging processes
   ps aux | grep python | grep pipeline
   kill -9 <process-id>
   
   # Remove lock files
   rm -f backend/pipeline.db-wal backend/pipeline.db-shm
   ```

2. **Permission Issues**:
   ```bash
   # Fix database file permissions
   chmod 664 backend/pipeline.db
   chown $(whoami) backend/pipeline.db
   ```

3. **Corrupted Database**:
   ```bash
   # Backup and recreate database
   mv backend/pipeline.db backend/pipeline.db.backup
   # Restart backend - it will create a new database
   ```

#### Disk Space Issues
**Problem**: Processing fails due to insufficient disk space.

**Symptoms**:
```
OSError: [Errno 28] No space left on device
```

**Solutions**:
1. Check available space:
   ```bash
   df -h backend/data/
   ```
2. Clean up old processed files:
   ```bash
   # Archive old output files
   find backend/data/output -name "*.csv" -mtime +30 -exec gzip {} \;
   
   # Remove old log files
   find backend/logs -name "*.log" -mtime +7 -delete
   ```

### Frontend and Communication Issues

#### Frontend Can't Connect to Backend
**Problem**: Dashboard shows "Backend unreachable" error.

**Symptoms**:
- Loading spinner never stops
- Error messages about failed API requests
- WebSocket connection failures

**Solutions**:
1. **Backend Not Running**:
   ```bash
   # Check if backend is running
   curl http://localhost:8000/health
   
   # If not, start backend
   cd backend && python -m uvicorn src.api.app:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Port Conflicts**:
   ```bash
   # Check what's using port 8000
   lsof -i :8000
   
   # Use different port if needed
   uvicorn src.api.app:app --port 8001
   # Update NEXT_PUBLIC_API_URL=http://localhost:8001
   ```

3. **CORS Issues**:
   - Check browser console for CORS errors
   - Verify ALLOWED_ORIGINS includes your frontend URL
   - For development, ensure CORS middleware allows all origins

#### WebSocket Connection Failures
**Problem**: Real-time updates don't work.

**Symptoms**:
- Dashboard doesn't update automatically
- Manual refresh required to see changes
- Console shows WebSocket errors

**Solutions**:
1. **WebSocket URL Issues**:
   ```javascript
   // Check NEXT_PUBLIC_WS_URL in .env.local
   NEXT_PUBLIC_WS_URL=ws://localhost:8000
   ```

2. **Firewall/Proxy Issues**:
   - Disable browser proxy temporarily
   - Check if corporate firewall blocks WebSocket connections
   - Try different port for WebSocket endpoint

3. **Fallback to Polling**:
   - Frontend automatically falls back to REST API polling
   - Check if data updates every few seconds instead of real-time

### Performance Issues

#### Slow Processing Performance
**Problem**: Files take a very long time to process.

**Symptoms**:
- Single files take minutes to process
- High CPU usage during processing
- Memory usage continuously growing

**Solutions**:
1. **Large File Optimization**:
   ```bash
   # Reduce sample size for very large files
   SAMPLE_THRESHOLD=200
   ```

2. **Memory Issues**:
   - Monitor memory usage: `top` or `htop`
   - Restart backend periodically for long-running processes
   - Consider processing files in smaller batches

3. **Gemini API Optimization**:
   - Use faster model: "gemini-1.5-flash" instead of "gemini-1.5-pro"
   - Reduce sample size if accuracy permits
   - Process files during off-peak hours

#### High Memory Usage
**Problem**: Backend consumes excessive memory.

**Solutions**:
1. **File Size Limits**:
   ```python
   # In settings.py, add file size validation
   MAX_FILE_SIZE_MB = 50
   ```

2. **Garbage Collection**:
   ```python
   # Force garbage collection in pipeline stages
   import gc
   gc.collect()
   ```

3. **Process Restart**:
   - Set up automated backend restarts for production
   - Monitor memory usage with system tools

### Getting Additional Help

#### Enable Debug Logging
```python
# In backend/src/config/settings.py
LOG_LEVEL = "DEBUG"
```

#### Useful Commands for Diagnostics
```bash
# Check all running processes
ps aux | grep -E "(python|node|uvicorn)"

# Monitor log files in real-time
tail -f backend/logs/*.log

# Check API endpoint responses
curl -v http://localhost:8000/api/pipeline/status

# Validate environment configuration
python -c "from backend.src.config.settings import settings; print(settings.dict())"
```

#### Community and Support Resources
- **GitHub Issues**: Report bugs and feature requests
- **Documentation Updates**: Contribute improvements to this guide
- **Performance Optimization**: Share configuration tips for different use cases

If you encounter issues not covered in this guide, please check the log files for detailed error messages and consider opening a GitHub issue with:
1. Complete error messages from logs
2. Your environment configuration (sanitized)
3. Steps to reproduce the issue
4. Expected vs. actual behavior
