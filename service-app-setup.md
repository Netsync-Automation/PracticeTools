# Webex Service App Setup Guide

## Overview
Service Apps provide a simpler alternative to OAuth integrations with automatic org-wide admin access.

## Setup Steps

1. **Create Service App**
   - Go to https://developer.webex.com/my-apps
   - Click "Create New App" → "Service App"
   - Fill in app details

2. **Generate Key Pair**
   - In the Service App settings, generate a new key pair
   - Download the private key file
   - Note the Key ID

3. **Required Scopes**
   - spark:recordings_read
   - meeting:recordings_read  
   - meeting:transcripts_read
   - meeting:admin_transcripts_read

4. **Environment Variables**
   - WEBEX_SERVICE_APP_ID: Service App ID from app details
   - WEBEX_SERVICE_APP_KEY_ID: Key ID from key pair generation
   - WEBEX_SERVICE_APP_PRIVATE_KEY: Contents of downloaded private key file

## Benefits
- No OAuth flow required
- Automatic org-wide admin access
- No scope permission issues
- Simpler authentication with JWT