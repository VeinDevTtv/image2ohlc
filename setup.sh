#!/bin/bash

echo "🚀 Setting up Candlestick Chart Calibration Tool..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p frontend/src/components/ui
mkdir -p frontend/src/lib
mkdir -p frontend/src/types
mkdir -p backend/types

echo "✅ Directories created"

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

echo ""
echo "🎉 Setup complete! You can now start the application:"
echo ""
echo "To start the backend server:"
echo "  npm run dev:backend"
echo ""
echo "To start the frontend (in another terminal):"
echo "  npm run dev:frontend"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
echo "📖 For detailed usage instructions, see CALIBRATION_TOOL_README.md"
