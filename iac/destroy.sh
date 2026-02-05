#!/bin/bash
set -e

echo "⚠️  Destroying stack..."

npx cdktf destroy --auto-approve

echo "💥 Stack destroyed!"
