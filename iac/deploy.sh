#!/bin/bash
set -e

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

echo "🚀 Starting deployment..."

# Initialize and install dependencies
npm install

# Synthesize and deploy
npx cdktf deploy --auto-approve

echo "✅ Deployment finished!"
