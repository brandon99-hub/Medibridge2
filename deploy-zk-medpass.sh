#!/bin/bash

# ZK-MedPass Deployment Script
echo "🚀 Deploying ZK-MedPass Integration..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# 3. Build the application
echo "🔨 Building application..."
npm run build

# 4. Check environment variables
echo "🔧 Checking environment variables..."
if [ -z "$AFRICAS_TALKING_API_KEY" ]; then
    echo "⚠️  Warning: AFRICAS_TALKING_API_KEY not set"
fi

if [ -z "$AFRICAS_TALKING_USERNAME" ]; then
    echo "⚠️  Warning: AFRICAS_TALKING_USERNAME not set"
fi

# 5. Start the application
echo "🚀 Starting ZK-MedPass..."
npm start

echo "✅ ZK-MedPass deployment complete!"
echo ""
echo "📱 Test USSD: curl -X POST http://localhost:3000/api/ussd -d 'sessionId=test&phoneNumber=+254712345678&text=&serviceCode=*123#'"
echo "📊 Test Analytics: curl -X GET http://localhost:3000/api/zk-medpass/analytics"
echo "🏥 Visit Admin Dashboard: http://localhost:3000/admin → ZK-MedPass Tab" 