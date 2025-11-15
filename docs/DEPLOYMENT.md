# Deployment & Scaling Guide

**Last Updated:** 2025-11-15

## Overview

This guide covers deploying Weekend Flight Finder from development to production, including self-hosting options, scaling strategies, and infrastructure recommendations.

---

## Table of Contents

1. [Current Hosting (Lovable)](#current-hosting-lovable)
2. [GitHub Integration](#github-integration)
3. [Self-Hosting Options](#self-hosting-options)
4. [Database Migration](#database-migration)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Environment Configuration](#environment-configuration)
7. [Scaling Strategies](#scaling-strategies)
8. [Monitoring & Logging](#monitoring--logging)
9. [Performance Optimization](#performance-optimization)
10. [Security Checklist](#security-checklist)

---

## Current Hosting (Lovable)

### Production URL
**Preview:** `https://[preview-id].lovable.app`  
**Published:** Available after clicking "Publish" button

### Features
- ✅ Automatic deployments on code changes
- ✅ Preview URLs for testing
- ✅ SSL certificates (HTTPS)
- ✅ CDN distribution
- ✅ Integrated with Lovable Cloud backend

### Limitations
- Preview URLs are temporary
- Custom domains require configuration
- Limited control over infrastructure

---

## GitHub Integration

### Setup Steps

1. **Connect GitHub Account**
   - In Lovable editor → GitHub → Connect to GitHub
   - Authorize Lovable GitHub App
   - Select organization/account

2. **Create Repository**
   - Click "Create Repository" in Lovable
   - Choose repository name: `weekend-flight-finder`
   - Repository is created with all current code

3. **Bidirectional Sync**
   - Changes in Lovable → Auto-push to GitHub
   - Changes in GitHub → Auto-sync to Lovable
   - Real-time synchronization

### Repository Structure

```
weekend-flight-finder/
├── .gitignore
├── README.md
├── package.json
├── package-lock.json
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── eslint.config.js
├── postcss.config.js
├── docs/
│   ├── DATABASE.md
│   ├── INTEGRATIONS.md
│   ├── DEPENDENCIES.md
│   └── DEPLOYMENT.md
├── public/
│   ├── robots.txt
│   └── ...
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   ├── pages/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   └── integrations/
│       └── supabase/
└── supabase/
    ├── config.toml
    └── migrations/
```

### Branch Strategy

**Current:** Main branch only

**Recommended for Production:**

```
main (production)
  ├── staging
  └── feature/[feature-name]
```

**Workflow:**
1. Create feature branch from `main`
2. Develop and test in feature branch
3. Create PR to `staging`
4. Test in staging environment
5. Merge staging → main for production

---

## Self-Hosting Options

When ready to move from Lovable hosting:

### Option 1: Vercel (Recommended)

**Why Vercel:**
- Zero-config deployment for Vite apps
- Excellent performance
- Free tier available
- Built-in CI/CD

**Setup:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

**Configuration:** `vercel.json`
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "env": {
    "VITE_SUPABASE_URL": "@supabase-url",
    "VITE_SUPABASE_PUBLISHABLE_KEY": "@supabase-anon-key"
  }
}
```

**Cost:** Free for small projects, $20/month for team features

---

### Option 2: Netlify

**Why Netlify:**
- Simple setup
- Great for SPAs
- Built-in form handling
- Generous free tier

**Setup:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy

# Production
netlify deploy --prod
```

**Configuration:** `netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  VITE_SUPABASE_URL = "https://your-project.supabase.co"
```

**Cost:** Free for personal projects, $19/month for teams

---

### Option 3: AWS (S3 + CloudFront)

**Why AWS:**
- Full control
- Highly scalable
- Cost-effective at scale
- Enterprise features

**Setup:**

1. **Build the app:**
```bash
npm run build
```

2. **Create S3 Bucket:**
```bash
aws s3 mb s3://weekend-flight-finder
aws s3 website s3://weekend-flight-finder --index-document index.html
```

3. **Upload files:**
```bash
aws s3 sync dist/ s3://weekend-flight-finder
```

4. **Create CloudFront Distribution:**
```bash
aws cloudfront create-distribution \
  --origin-domain-name weekend-flight-finder.s3.amazonaws.com
```

**Cost:** ~$0.50-5/month depending on traffic

---

### Option 4: Docker + VPS

**Why Docker:**
- Full control
- Can run anywhere
- Consistent environments

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf:**
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**Deploy:**
```bash
docker build -t weekend-flight-finder .
docker run -p 80:80 weekend-flight-finder
```

**Cost:** $5-20/month for VPS (DigitalOcean, Linode, Hetzner)

---

## Database Migration

When scaling beyond Lovable Cloud:

### Option 1: Self-Hosted Supabase

**Setup:**
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize
supabase init

# Link to existing project
supabase link --project-ref YOUR_PROJECT_REF

# Pull schema
supabase db pull

# Start local instance
supabase start
```

**Migration Path:**
1. Export data from Lovable Cloud
2. Set up self-hosted Supabase
3. Import schema and data
4. Update environment variables
5. Test thoroughly
6. Switch DNS/endpoints

---

### Option 2: PostgreSQL + Prisma

**Setup:**
```bash
npm install prisma @prisma/client
npx prisma init
```

**Migration:**
1. Generate Prisma schema from Supabase
2. Create migration files
3. Update all database queries
4. Implement auth separately

**Prisma Schema Example:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Profile {
  id                  String   @id @default(uuid())
  displayName         String?  @map("display_name")
  avatarUrl           String?  @map("avatar_url")
  preferredCurrency   String   @default("EUR") @map("preferred_currency")
  // ... more fields
  
  savedSearches       SavedSearch[]
  favoriteDestinations FavoriteDestination[]
  
  @@map("profiles")
}
```

---

## CI/CD Pipeline

### GitHub Actions

**`.github/workflows/deploy.yml`:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
        
      - name: Build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Environment Configuration

### Development
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### Staging
```env
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_staging_anon_key
VITE_SUPABASE_PROJECT_ID=your_staging_project_id
```

### Production
```env
VITE_SUPABASE_URL=https://your-production-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_production_anon_key
VITE_SUPABASE_PROJECT_ID=your_production_project_id

# Optional
VITE_POSTHOG_KEY=your_posthog_key
VITE_SENTRY_DSN=your_sentry_dsn
```

---

## Scaling Strategies

### Frontend Scaling

**Load Balancing:**
```
User → CDN (CloudFront) → Multiple Edge Locations
```

**Code Splitting:**
```typescript
// Lazy load pages
const Profile = lazy(() => import('./pages/Profile'));
const Favorites = lazy(() => import('./pages/Favorites'));

<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/profile" element={<Profile />} />
    <Route path="/favorites" element={<Favorites />} />
  </Routes>
</Suspense>
```

**Asset Optimization:**
- Enable Brotli/Gzip compression
- Use WebP images
- Implement lazy loading for images
- Minimize CSS/JS bundles

---

### Backend Scaling

**Database:**
- Connection pooling (Supavisor/PgBouncer)
- Read replicas for queries
- Database indexing
- Query optimization

**Edge Functions:**
- Deploy to multiple regions
- Implement caching
- Rate limiting
- Queue for async operations

**Caching Strategy:**
```typescript
// Cache frequently accessed data
const cacheKey = `flight-search:${origin}:${destination}:${date}`;

// Check cache first
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Fetch and cache
const result = await fetchFlights(...);
await redis.setex(cacheKey, 3600, JSON.stringify(result));
return result;
```

---

### Infrastructure at Scale

**Small Scale (0-1K users):**
- Vercel/Netlify frontend
- Supabase hosted database
- No additional infrastructure needed

**Medium Scale (1K-50K users):**
- CDN (CloudFront/Cloudflare)
- Database connection pooler
- Redis for caching
- Monitoring (Sentry, PostHog)

**Large Scale (50K+ users):**
- Multi-region deployment
- Database read replicas
- Dedicated cache layer (Redis Cluster)
- Message queue (RabbitMQ/SQS)
- Microservices architecture

---

## Monitoring & Logging

### Error Tracking

**Sentry Setup:**
```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

---

### Analytics

**PostHog Setup:**
```typescript
// src/lib/analytics.ts
import posthog from 'posthog-js';

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: 'https://app.posthog.com',
});

export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    posthog.capture(event, properties);
  },
  identify: (userId: string, traits?: Record<string, any>) => {
    posthog.identify(userId, traits);
  },
};
```

---

### Performance Monitoring

**Web Vitals:**
```typescript
// src/lib/vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  analytics.track('web_vital', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
  });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

---

## Performance Optimization

### Bundle Size Optimization

```bash
# Analyze bundle
npm run build
npx vite-bundle-visualizer
```

**Techniques:**
- Tree-shaking unused code
- Code splitting by route
- Lazy loading heavy components
- Remove unused dependencies

---

### Database Optimization

**Indexes:**
```sql
-- Add indexes for common queries
CREATE INDEX idx_saved_searches_user_created 
  ON saved_searches(user_id, created_at DESC);

CREATE INDEX idx_favorites_user_type 
  ON favorite_destinations(user_id, destination_type);
```

**Query Optimization:**
```typescript
// ❌ Bad - N+1 query problem
for (const search of searches) {
  const profile = await supabase
    .from('profiles')
    .select('*')
    .eq('id', search.user_id)
    .single();
}

// ✅ Good - Single query with join
const { data } = await supabase
  .from('saved_searches')
  .select(`
    *,
    profiles (*)
  `)
  .eq('user_id', userId);
```

---

### Caching Strategy

**Frontend:**
```typescript
// React Query caching
const { data } = useQuery({
  queryKey: ['searches', userId],
  queryFn: fetchSearches,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 30 * 60 * 1000, // 30 minutes
});
```

**Backend:**
```typescript
// Edge function caching
const cacheKey = `user:${userId}:preferences`;
const cached = await kv.get(cacheKey);

if (cached) {
  return new Response(cached, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  });
}
```

---

## Security Checklist

### Pre-Production

- [ ] Environment variables secured
- [ ] API keys not in code
- [ ] RLS policies tested
- [ ] Input validation implemented
- [ ] CORS configured properly
- [ ] HTTPS enforced
- [ ] CSP headers configured
- [ ] XSS protection enabled
- [ ] SQL injection prevented
- [ ] Authentication flow tested
- [ ] Password requirements enforced
- [ ] Rate limiting implemented

### Production

- [ ] Error messages don't expose internals
- [ ] Logging doesn't include sensitive data
- [ ] Database backups automated
- [ ] Monitoring alerts configured
- [ ] Incident response plan documented
- [ ] Security scanning automated
- [ ] Dependencies regularly updated
- [ ] Penetration testing completed

---

## Rollback Strategy

### Vercel/Netlify
- Keep previous deployments
- One-click rollback in dashboard
- Git-based rollback

### Self-Hosted
```bash
# Rollback to previous version
docker-compose down
docker-compose up -d --build --no-deps [previous-image]

# Restore database from backup
pg_restore -d production backup-2025-11-15.dump
```

---

## Cost Estimation

### Small Scale (0-1K users/month)

**Hosting:**
- Vercel/Netlify: Free
- Supabase Free Tier: $0
- Domain: $12/year

**Total:** ~$12/year

---

### Medium Scale (1K-50K users/month)

**Hosting:**
- Vercel Pro: $20/month
- Supabase Pro: $25/month
- CloudFront: $10/month
- Monitoring (Sentry): $26/month

**Total:** ~$81/month

---

### Large Scale (50K+ users/month)

**Hosting:**
- Vercel Enterprise: $150/month
- Supabase Pro + Addons: $100/month
- CloudFront: $50/month
- Monitoring: $100/month
- Redis: $50/month
- Additional infrastructure: $100/month

**Total:** ~$550/month

---

**Last Updated:** 2025-11-15  
**Maintainer:** Development Team  
**Review Schedule:** Update with every deployment change
