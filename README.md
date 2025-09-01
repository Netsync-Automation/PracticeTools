# Practice Tools

A comprehensive web application built with Next.js that integrates multiple features from the Features library into a cohesive development platform.

## Features

### 🔐 Authentication & Authorization
- Local username/password authentication
- Role-based access control (admin/user)
- Session management with HTTP-only cookies
- Default admin account for testing

### 📦 Automated Versioning
- Semantic versioning (SemVer 2.0.0) compliance
- Interactive commit approval system
- Automatic change detection and classification
- Database-driven release tracking

### 🛡️ Breaking Change Control Protocol (BCPP)
- Mandatory pre-change validation
- Automatic feature detection and cataloging
- Breaking change risk analysis
- Pattern generation for commit descriptions

### 🌐 WebEx Notifications
- Rich WebEx integration with adaptive cards
- Direct messaging to users
- Comprehensive error handling and logging

### 🕒 Timezone Management
- Browser timezone detection using Intl API
- Server-side fallback support
- Multiple timestamp formats (absolute, relative, WebEx)
- Cross-platform compatibility

### 🌍 Environment Management
- Branch-based environment detection (main = prod, dev = dev)
- Environment-specific App Runner configurations
- Database table isolation with environment prefixes
- SSM parameter path management for secure credentials

## Quick Start

### Prerequisites
- Node.js 18+ 
- AWS credentials configured
- Git repository initialized

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy the existing `.env.local` file or create one with:
   ```bash
   AWS_DEFAULT_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   DEFAULT_ADMIN_EMAIL=admin@localhost
   DEFAULT_ADMIN_PASSWORD=ChangeMe123!
   DEFAULT_ADMIN_NAME=Administrator
   DEFAULT_TIMEZONE=America/Chicago
   WEBEX_ACCESS_TOKEN=your_webex_token
   WEBEX_ROOM_ID=your_room_id
   WEBEX_ROOM_NAME=your_room_name
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000)

### Default Login
- **Email:** admin@localhost
- **Password:** ChangeMe123! (or value from DEFAULT_ADMIN_PASSWORD)

## Development Workflow

### Making Changes
1. Make your code changes
2. Run the commit script: `npm run commit`
3. Review and approve the version and release notes
4. The system will automatically:
   - Run BCPP validation
   - Generate semantic version
   - Update database
   - Create commit and push

### BCPP Validation
Before any commit, run: `npm run bcpp`

This validates:
- Breaking change detection
- Feature integrity
- Critical file presence

## Database Tables

The application uses DynamoDB with environment-specific table prefixes:

- **Development:** `PracticeTools-dev-*`
- **Production:** `PracticeTools-prod-*`

### Required Tables
- `Users` - User authentication data
- `Settings` - Application settings
- `Releases` - Version and release information
- `Features` - Feature tracking for BCPP

Tables are created automatically when first accessed.

## Environment Configuration

### Development
- Uses `config/apprunner-dev.yaml`
- SSM parameters under `/PracticeTools/dev/`
- Database tables prefixed with `PracticeTools-dev-`

### Production
- Uses `config/apprunner-prod.yaml`
- SSM parameters under `/PracticeTools/`
- Database tables prefixed with `PracticeTools-prod-`

## API Routes

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check-session` - Session validation

### Application
- `GET /api/version` - Current application version
- `GET /api/settings/general` - General application settings
- `POST /api/settings/general` - Update general settings

## Scripts

### `npm run commit`
Runs the automated versioning and commit process:
1. BCPP validation
2. Change detection
3. Version calculation
4. Release notes generation
5. User approval
6. Database update
7. Git commit and push

### `npm run bcpp`
Runs Breaking Change Control Protocol validation:
- Detects potentially breaking changes
- Validates feature integrity
- Provides recommendations

## Security Features

- HTTP-only session cookies
- CSRF protection
- Environment variable validation
- Role-based access control
- Secure credential management via SSM

## Architecture

```
PracticeTools/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── login/             # Login page
│   ├── layout.js          # Root layout
│   ├── page.js            # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Navbar.js          # Navigation component
│   ├── AccessCheck.js     # Access control component
│   └── TimestampDisplay.js # Timezone-aware timestamps
├── hooks/                 # React hooks
│   └── useAuth.js         # Authentication hook
├── lib/                   # Core libraries
│   ├── database.js        # DynamoDB service
│   ├── auth.js            # Authentication logic
│   ├── environment.js     # Environment management
│   ├── timezone.js        # Timezone utilities
│   ├── versioning.js      # Version management
│   └── webex.js           # WebEx integration
├── scripts/               # Automation scripts
│   ├── commit-and-push.js # Versioning workflow
│   └── mandatory-check.js # BCPP validation
├── config/                # Environment configs
│   ├── apprunner-dev.yaml # Development config
│   └── apprunner-prod.yaml # Production config
└── .env.local             # Local environment variables
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run bcpp` to validate
5. Run `npm run commit` to create versioned commit
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

**Practice Tools v1.0.0** - A comprehensive development platform integrating authentication, versioning, notifications, and more.