# Issue Tracker for AWS App Runner

A secure web-based issue tracking system optimized for AWS App Runner deployment.

## Features

- **Secure Form**: CSRF protection, input validation, and sanitization
- **Issue Types**: Bug Report, Feature Request, General Question
- **Character Limits**: Title (100 chars), Description (1000 chars)
- **Database**: DynamoDB with automatic table creation
- **Admin View**: View all submitted issues
- **File Uploads**: Support for attachments
- **Health Check**: Built-in health endpoint for monitoring

## AWS App Runner Deployment

### Prerequisites
- GitHub repository with this code
- AWS Account with App Runner access

### Deployment Steps

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Create App Runner Service**
   - Go to AWS App Runner console
   - Click "Create service"
   - Choose "Source code repository"
   - Connect your GitHub repository
   - Select branch (main)
   - Choose "Automatic deployments" for GitHub push triggers

3. **Configuration**
   - Runtime: PHP 8.1
   - Build command: Uses `apprunner.yaml`
   - Start command: `./startup.sh`
   - Port: 80

### File Structure
```
/
├── public/                 # Web root directory
│   ├── index.php          # Main application
│   ├── admin.php          # Admin interface
│   ├── process.php        # Form processing
│   ├── database.php       # Database operations
│   ├── health.php         # Health check endpoint
│   ├── uploads/           # File uploads directory
│   └── ...               # Other PHP files
├── apprunner.yaml         # App Runner configuration
├── startup.sh             # Startup script
├── composer.json          # PHP dependencies
└── README.md             # This file
```

### Environment Variables
- `AWS_DEFAULT_REGION`: AWS region for DynamoDB (default: us-east-1)

### Health Check
The application includes a health check endpoint at `/health.php` that monitors:
- Database connectivity
- File upload directory permissions
- Overall application status

### Security Features
- CSRF token protection
- Input sanitization and validation
- SQL injection prevention with prepared statements
- XSS protection with htmlspecialchars()
- Email validation
- File upload restrictions

### Database Schema
DynamoDB tables:
- `issues`: Main issue tracking
- `users`: User management
- `upvotes`: Issue voting system

### Default Admin Access
- Email: admin@localhost
- Password: P!7xZ@r4eL9w#Vu1Tq&

**Change the default password immediately after deployment!**

## Local Development

1. Install PHP 8.1+ and Composer
2. Configure AWS credentials in `.env.local`
3. Run `composer install`
4. Start PHP development server: `php -S localhost:8000 -t public`
5. Access application at `http://localhost:8000`

## Monitoring

- Health check: `https://your-app-url/health.php`
- Returns JSON with application status
- HTTP 200 for healthy, 503 for unhealthy