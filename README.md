# Weekend Flight Finder

A modern web application for discovering spontaneous weekend getaways from your nearest airport. Built with React, TypeScript, and Lovable Cloud.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📚 Documentation

- **[Database Schema](./docs/DATABASE.md)** - Complete database structure with ERD diagrams
- **[Integrations](./docs/INTEGRATIONS.md)** - Third-party services (Supabase, Google OAuth, AI)
- **[Dependencies](./docs/DEPENDENCIES.md)** - All npm packages and their purposes
- **[Deployment](./docs/DEPLOYMENT.md)** - Hosting, scaling, and production guide

## 🏗️ Architecture

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn UI (Radix UI primitives)
- **Routing:** React Router v6
- **State Management:** TanStack Query

### Backend (Lovable Cloud)
- **Database:** PostgreSQL (Supabase)
- **Authentication:** Email/Password + OAuth (Google)
- **AI:** Lovable AI Gateway (Gemini 2.5, GPT-5)
- **Hosting:** Lovable (production), Vercel (future)

## 🗂️ Project Structure

```
weekend-flight-finder/
├── docs/                    # Comprehensive documentation
│   ├── DATABASE.md         # Database schema and ERD diagrams
│   ├── INTEGRATIONS.md     # Third-party services
│   ├── DEPENDENCIES.md     # npm packages
│   └── DEPLOYMENT.md       # Deployment and scaling
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Shadcn components
│   │   ├── Header.tsx     # App header with auth
│   │   ├── Hero.tsx       # Landing page hero
│   │   ├── SearchForm.tsx # Flight search form
│   │   └── FlightCard.tsx # Flight result card
│   ├── pages/             # Route pages
│   │   ├── Index.tsx      # Landing page
│   │   ├── Auth.tsx       # Sign in/up
│   │   ├── Profile.tsx    # User profile
│   │   ├── Favorites.tsx  # Saved destinations
│   │   └── SavedSearches.tsx # Search history
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx # Authentication state
│   ├── integrations/
│   │   └── supabase/      # Supabase client and types
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   └── assets/            # Images and static files
├── supabase/              # Backend configuration
│   ├── config.toml        # Supabase config
│   └── migrations/        # Database migrations
└── public/                # Static assets
```

## 🔑 Key Features

### Implemented
- ✅ User authentication (email/password, Google OAuth)
- ✅ User profiles with preferences
- ✅ Save favorite destinations
- ✅ Save flight searches
- ✅ Time constraints (e.g., school pickup times)
- ✅ Trip preferences management
- ✅ Responsive design
- ✅ Dark mode support (components ready)

### Planned
- ⏳ Real flight API integration (Amadeus/Kiwi)
- ⏳ Price alerts and notifications
- ⏳ AI-powered trip recommendations
- ⏳ Multi-city trip planning
- ⏳ Booking integration
- ⏳ Travel history and analytics

## 🗄️ Database

### Tables
- **profiles** - User profile information
- **saved_searches** - Flight search history
- **favorite_destinations** - Saved cities/countries
- **user_time_constraints** - Time window preferences
- **trip_preferences** - General travel preferences

See [DATABASE.md](./docs/DATABASE.md) for complete schema and relationships.

## 🔐 Environment Variables

```env
# Supabase (auto-configured by Lovable)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

**Note:** These are automatically managed by Lovable and should not be committed to Git.

## 🚢 Deployment

### AWS (Current)
- Frontend: https://d15kwzkstetaby.cloudfront.net
- Infrastructure: AWS CDK (S3 + CloudFront + Lambda + API Gateway)
- 21 Lambda functions serving the API at `/api/*`
- Secrets managed via AWS Secrets Manager

```bash
# Deploy to AWS
./scripts/deploy.sh

# Deploy to specific environment
./scripts/deploy.sh prod
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment details, monitoring, and recovery.

## Pipeline

Pipeline: https://us-east-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/CityBreaksPipeline/view

Deploy: `git push origin deploy-to-aws`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full details. Created with the [setup-pipeline] Agent Standard Operation Procedure from the [AWS MCP](https://docs.aws.amazon.com/aws-mcp/latest/userguide/what-is-mcp-server.html).

## 🧪 Development

### Prerequisites
- Node.js 18+ (20+ recommended)
- npm 9+ or pnpm 8+

### Local Development
```bash
# Clone repository
git clone https://github.com/your-username/weekend-flight-finder.git
cd weekend-flight-finder

# Install dependencies
npm install

# Start dev server (http://localhost:8080)
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Testing
```bash
# Run all tests (when implemented)
npm test

# E2E tests (when implemented)
npm run test:e2e
```

## 📖 API Documentation

### Supabase Client

```typescript
import { supabase } from "@/integrations/supabase/client";

// Query example
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// Auth example
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure_password',
});
```

See [INTEGRATIONS.md](./docs/INTEGRATIONS.md) for complete API documentation.

## 🤝 Contributing

### Documentation Maintenance
When making changes, update relevant documentation:
- Database changes → Update `docs/DATABASE.md` with new ERD
- New dependencies → Add to `docs/DEPENDENCIES.md`
- New integrations → Document in `docs/INTEGRATIONS.md`
- Infrastructure changes → Update `docs/DEPLOYMENT.md`

### Code Style
- TypeScript strict mode
- ESLint configuration in `eslint.config.js`
- Prettier formatting (recommended)
- Semantic commit messages

## 📦 Technologies

### Core
- React 18.3.1
- TypeScript
- Vite
- Tailwind CSS

### UI & Components
- Shadcn UI (Radix UI)
- Lucide React (icons)
- Sonner (toasts)
- React Hook Form + Zod

### Backend
- Supabase (PostgreSQL, Auth, Storage)
- Lovable AI Gateway

### Utilities
- TanStack Query (data fetching)
- date-fns (date manipulation)
- clsx + tailwind-merge (class management)

See [DEPENDENCIES.md](./docs/DEPENDENCIES.md) for complete list.

## 📄 License

[Your License Here]

## 🔗 Links

- **Live App:** [Your production URL]
- **Documentation:** [docs/](./docs/)
- **GitHub:** [Your GitHub repo]
- **Lovable Project:** https://lovable.dev/projects/8c491dbd-7394-4351-8968-373dab9f78ab

## 💬 Support

- Documentation: Check `docs/` folder
- Issues: [GitHub Issues](your-repo/issues)
- Community: [Your Discord/Slack]

---

**Built with ❤️ using Lovable**
