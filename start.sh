#!/bin/bash

echo "=================================================="
echo "  Starting Dietin App (Frontend + AI Backend)"
echo "=================================================="

# Define paths
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
REACT_DIR="$ROOT_DIR/Dietin"
PYTHON_DIR="$ROOT_DIR/Dietin/ai/exercise_recognition"

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\nShutting down servers..."
    if [ -n "$PYTHON_PID" ]; then
        kill $PYTHON_PID 2>/dev/null
    fi
    exit
}

# Catch termination signals (Ctrl+C)
trap cleanup SIGINT SIGTERM

# 1. Start Python AI Backend
echo "--> Starting Python AI Backend..."
cd "$PYTHON_DIR" || exit

if [ -d ".venv" ]; then
    # Run the python server in the background
    .venv/bin/python inference/main.py &
    PYTHON_PID=$!
    echo "Python Backend started with PID $PYTHON_PID"
else
    echo "Error: Python virtual environment (.venv) not found in $PYTHON_DIR"
    echo "Please make sure your python backend is set up."
    exit 1
fi

# 2. Start React Application
echo "--> Starting React Frontend..."
cd "$REACT_DIR" || exit

# Run vite dev server
npm run dev

# Cleanup if npm run dev exits naturally
cleanup
