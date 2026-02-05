#!/bin/bash
set -e

# Use provided account ID or fetch it
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
REGION=${AWS_REGION:-us-east-1}
BUCKET_NAME="turbovets-terraform-state-${ACCOUNT_ID}"
TABLE_NAME="terraform-lock"

echo "🛠  Bootstrapping Terraform Remote State Resources..."
echo "📍 Account: ${ACCOUNT_ID}"
echo "📍 Region: ${REGION}"

# Create S3 Bucket if it doesn't exist
if ! aws s3api head-bucket --bucket "${BUCKET_NAME}" 2>/dev/null; then
  echo "📦 Creating S3 bucket: ${BUCKET_NAME}..."
  if [ "${REGION}" == "us-east-1" ]; then
    aws s3api create-bucket --bucket "${BUCKET_NAME}" --region "${REGION}"
  else
    aws s3api create-bucket --bucket "${BUCKET_NAME}" --region "${REGION}" --create-bucket-configuration LocationConstraint="${REGION}"
  fi
  # Enable versioning (Best practice for State)
  aws s3api put-bucket-versioning --bucket "${BUCKET_NAME}" --versioning-configuration Status=Enabled
else
  echo "✅ S3 bucket already exists."
fi

# Create DynamoDB Table if it doesn't exist
if ! aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "🔑 Creating DynamoDB table: ${TABLE_NAME}..."
  aws dynamodb create-table \
    --table-name "${TABLE_NAME}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region "${REGION}"
else
  echo "✅ DynamoDB table already exists."
fi

echo "🚀 Bootstrap Complete!"
echo "Bucket: ${BUCKET_NAME}"
