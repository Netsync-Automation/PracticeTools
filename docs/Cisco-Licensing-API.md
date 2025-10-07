# Cisco Licensing API Knowledge Base

## Overview
The Cisco Subscription Services API provides access to subscription and licensing information for Business Partner Agreements (BPA). This API allows querying subscription details across Smart Accounts and Virtual Accounts.

## API Details
- **Base URL**: `https://swapi.cisco.com`
- **Version**: 1.0.0
- **Contact**: api-portal-devs@cisco.com

## Authentication
The API supports three authentication methods:
1. **Custom Token** - Bearer token authentication
2. **OAuth2 Implicit Grant** - Authorization URL: `https://cloudsso.cisco.com/as/authorization.oauth2`
3. **OAuth2 Password Grant** - Token URL: `https://cloudsso.cisco.com/as/token.oauth2`

### OAuth Scopes
- `openid` - OpenID scope
- `profile` - Profile scope

## Endpoints

### Get Subscription Details
**Endpoint**: `POST /services/api/smart-accounts-and-licensing/v1/subscription/search`

**Purpose**: Retrieve subscription details for Business Partner Agreements (BPA)

**Headers**:
- `Content-Type: application/json` (required)

## Request Structure

### Required Fields
- `source` (string) - Source system invoking the API (e.g., "CCW")

### Optional Fields
- `smartAccount` (array) - Smart Account information
  - `smartAccountId` (integer) - Smart Account ID
  - `domain` (string) - Domain of the smart account
- `additionalParams` (array) - Additional search parameters
  - `paramName` (string) - Parameter name (e.g., "offerName")
  - `value` (string) - Parameter value (e.g., "WEBEX")

### Example Request
```json
{
  "source": "CCW",
  "smartAccount": [{
    "smartAccountId": 120152,
    "domain": "decmr.gmail.com"
  }],
  "additionalParams": [{
    "paramName": "offerName",
    "value": "WEBEX"
  }]
}
```

## Response Structure

### Success Response (200)
- `source` (string) - Source system (e.g., "ESM")
- `offerDetails` (array) - Offer details for each Smart Account
  - `smartAccountId` (integer) - Smart Account ID
  - `subscriptions` (array) - Subscription information
    - `subRefId` (string) - Subscription reference ID
    - `vaDetails` (array) - Virtual Account details
      - `virtualAccountId` (string) - Virtual Account ID
      - `virtualAccountName` (string) - Virtual Account name
    - `suites` (array) - Product suite information
      - `suiteName` (string) - Suite name (e.g., "Email Security")
      - `atoName` (string) - Assemble-to-Order name (e.g., "E2N-SEC")
      - `architecture` (string) - Architecture type (e.g., "Security Choice")
    - `additionalParams` (array) - Additional parameters
      - `paramName` (string) - Parameter name (e.g., "BPA")
      - `value` (string) - Parameter value (e.g., "Yes")

### Example Response
```json
{
  "source": "ESM",
  "offerDetails": [{
    "smartAccountId": 120152,
    "subscriptions": [{
      "subRefId": "Sub12345",
      "vaDetails": [{
        "virtualAccountId": "12345",
        "virtualAccountName": "Demo Virtual Account"
      }],
      "suites": [{
        "suiteName": "Email Security",
        "atoName": "E2N-SEC",
        "architecture": "Security Choice"
      }],
      "additionalParams": [{
        "paramName": "BPA",
        "value": "Yes"
      }]
    }]
  }]
}
```

## Error Responses
- **400** - Bad Request: Invalid request format
- **401** - Unauthorized: Missing or incorrect authentication
- **403** - Forbidden: Access denied
- **404** - Not Found: Invalid URI or resource doesn't exist
- **422** - Unprocessable Entity: Request validation failed
- **500** - Internal Server Error: Server-side error

## Key Capabilities

### 1. Smart Account Management
- Query subscriptions by Smart Account ID
- Filter by domain associated with Smart Account
- Retrieve multiple Smart Accounts in single request

### 2. Subscription Discovery
- Search subscriptions across multiple criteria
- Filter by offer names (e.g., WEBEX, Security products)
- Retrieve subscription reference IDs for tracking

### 3. Virtual Account Integration
- Access Virtual Account details within Smart Accounts
- Retrieve Virtual Account names and IDs
- Map subscriptions to specific Virtual Accounts

### 4. Product Suite Information
- Identify product suites within subscriptions
- Retrieve Assemble-to-Order (ATO) names
- Access architecture information for products

### 5. BPA (Business Partner Agreement) Support
- Specifically designed for BPA subscription queries
- Filter subscriptions by BPA eligibility
- Retrieve BPA-specific parameters

### 6. Flexible Parameter System
- Support for additional search parameters
- Extensible parameter structure for future enhancements
- Custom filtering capabilities

## Use Cases

### Partner Management
- Retrieve all subscriptions for a partner's Smart Account
- Identify BPA-eligible subscriptions
- Map subscriptions to Virtual Accounts for billing

### License Tracking
- Track subscription reference IDs across systems
- Monitor product suite deployments
- Validate subscription status for compliance

### Integration Scenarios
- CCW (Cisco Commerce Workspace) integration
- ESM (Enterprise Service Management) data synchronization
- Third-party partner portal integration

## Implementation Notes

### Authentication Best Practices
- Use OAuth2 for production integrations
- Implement proper token refresh mechanisms
- Store credentials securely

### Rate Limiting
- Monitor API usage to avoid throttling
- Implement retry logic with exponential backoff
- Cache responses when appropriate

### Error Handling
- Implement comprehensive error handling for all HTTP status codes
- Log authentication failures for security monitoring
- Provide meaningful error messages to end users

### Data Processing
- Parse nested subscription structures carefully
- Handle arrays of varying lengths
- Validate data integrity before processing

This API serves as a critical integration point for Cisco partners to access subscription and licensing information programmatically, enabling automated license management and compliance tracking.