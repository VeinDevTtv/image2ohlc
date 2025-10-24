@echo off
echo 🚀 Setting up Candlestick Chart Calibration Tool...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

echo ✅ Node.js detected
node --version

REM Install dependencies
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Create necessary directories
echo 📁 Creating directories...
if not exist "frontend\src\components\ui" mkdir "frontend\src\components\ui"
if not exist "frontend\src\lib" mkdir "frontend\src\lib"
if not exist "frontend\src\types" mkdir "frontend\src\types"
if not exist "backend\types" mkdir "backend\types"

echo ✅ Directories created

REM Build the project
echo 🔨 Building the project...
npm run build

if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo ✅ Build completed successfully

echo.
echo 🎉 Setup complete! You can now start the application:
echo.
echo To start the backend server:
echo   npm run dev:backend
echo.
echo To start the frontend (in another terminal):
echo   npm run dev:frontend
echo.
echo Then open http://localhost:3000 in your browser
echo.
echo 📖 For detailed usage instructions, see CALIBRATION_TOOL_README.md
pause
