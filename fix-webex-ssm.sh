#!/bin/bash

echo "Converting Webex Meetings SSM parameters from SecureString to String..."

# Function to convert parameters for an environment
convert_env() {
    local env_prefix=$1
    local env_name=$2
    
    echo "Processing $env_name environment..."
    
    # Get current values
    echo "Getting current values..."
    CLIENT_ID=$(aws ssm get-parameter --name "${env_prefix}/WEBEX_MEETINGS_CLIENT_ID" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null)
    CLIENT_SECRET=$(aws ssm get-parameter --name "${env_prefix}/WEBEX_MEETINGS_CLIENT_SECRET" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null)
    ACCESS_TOKEN=$(aws ssm get-parameter --name "${env_prefix}/WEBEX_MEETINGS_ACCESS_TOKEN" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null)
    REFRESH_TOKEN=$(aws ssm get-parameter --name "${env_prefix}/WEBEX_MEETINGS_REFRESH_TOKEN" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null)
    
    # Delete SecureString parameters
    echo "Deleting SecureString parameters..."
    aws ssm delete-parameter --name "${env_prefix}/WEBEX_MEETINGS_CLIENT_ID" 2>/dev/null
    aws ssm delete-parameter --name "${env_prefix}/WEBEX_MEETINGS_CLIENT_SECRET" 2>/dev/null
    aws ssm delete-parameter --name "${env_prefix}/WEBEX_MEETINGS_ACCESS_TOKEN" 2>/dev/null
    aws ssm delete-parameter --name "${env_prefix}/WEBEX_MEETINGS_REFRESH_TOKEN" 2>/dev/null
    
    # Recreate as String parameters
    echo "Recreating as String parameters..."
    if [ "$CLIENT_ID" != "None" ] && [ -n "$CLIENT_ID" ]; then
        aws ssm put-parameter --name "${env_prefix}/WEBEX_MEETINGS_CLIENT_ID" --value "$CLIENT_ID" --type "String"
        echo "✓ CLIENT_ID converted"
    fi
    
    if [ "$CLIENT_SECRET" != "None" ] && [ -n "$CLIENT_SECRET" ]; then
        aws ssm put-parameter --name "${env_prefix}/WEBEX_MEETINGS_CLIENT_SECRET" --value "$CLIENT_SECRET" --type "String"
        echo "✓ CLIENT_SECRET converted"
    fi
    
    if [ "$ACCESS_TOKEN" != "None" ] && [ -n "$ACCESS_TOKEN" ]; then
        aws ssm put-parameter --name "${env_prefix}/WEBEX_MEETINGS_ACCESS_TOKEN" --value "$ACCESS_TOKEN" --type "String"
        echo "✓ ACCESS_TOKEN converted"
    fi
    
    if [ "$REFRESH_TOKEN" != "None" ] && [ -n "$REFRESH_TOKEN" ]; then
        aws ssm put-parameter --name "${env_prefix}/WEBEX_MEETINGS_REFRESH_TOKEN" --value "$REFRESH_TOKEN" --type "String"
        echo "✓ REFRESH_TOKEN converted"
    fi
    
    echo "$env_name environment completed."
    echo ""
}

# Convert Dev environment
convert_env "/PracticeTools/dev" "Dev"

# Convert Prod environment
convert_env "/PracticeTools" "Prod"

echo "All Webex Meetings SSM parameters converted to String type!"