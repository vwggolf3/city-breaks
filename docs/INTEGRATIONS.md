# Third-Party Integrations Documentation

**Last Updated:** 2025-11-15

## Overview

Weekend Flight Finder integrates with multiple third-party services to provide authentication, database, and AI capabilities. This document provides comprehensive setup instructions and configuration details for all external dependencies.

---

## Table of Contents

1. [Lovable Cloud (Supabase)](#lovable-cloud-supabase)
2. [Google OAuth](#google-oauth)
3. [Lovable AI Gateway](#lovable-ai-gateway)
4. [Future Integrations](#future-integrations)

---

## Lovable Cloud (Supabase)

### What is Lovable Cloud?

Lovable Cloud is the integrated backend service that provides:
- PostgreSQL database
- Authentication system
- File storage
- Edge Functions (serverless functions)
- Realtime capabilities

Under the hood, Lovable Cloud uses Supabase, but with zero-configuration setup.

### Current Setup

**Status:** ✅ Connected

**Project ID:** `mornsczwzuksamxmtmbe`

**Services Enabled:**
- ✅ Database (PostgreSQL)
- ✅ Authentication
- ✅ AI Gateway
- ⏳ Storage (not yet configured)
- ⏳ Edge Functions (none deployed yet)

### Environment Variables

```env
VITE_SUPABASE_URL=https://mornsczwzuksamxmtmbe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=mornsczwzuksamxmtmbe
```

**⚠️ IMPORTANT:** These are automatically managed by Lovable and should never be committed to Git. They're injected at build time.

### Database Schema

See [DATABASE.md](./DATABASE.md) for complete schema documentation.

**Current Tables:**
- profiles
- saved_searches
- favorite_destinations
- user_time_constraints
- trip_preferences

### Authentication Configuration

**Enabled Providers:**
- ✅ Email/Password
- ⏳ Google OAuth (requires setup)

**Settings:**
- Auto-confirm emails: ✅ Enabled (for testing)
- Anonymous sign-ins: ❌ Disabled
- Sign-ups: ✅ Enabled

### Client Usage

```typescript
import { supabase } from "@/integrations/supabase/client";

// Query example
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId);

// Auth example
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure_password',
});
```

### Scaling Considerations

When scaling beyond Lovable Cloud:

1. **Export Database Schema:**
   ```bash
   # Use Supabase CLI to export schema
   supabase db dump -f schema.sql
   ```

2. **Migrate to Self-Hosted Supabase:**
   - Set up Supabase instance
   - Update environment variables
   - Import schema and data
   - Update client configuration

3. **Connection Pooling:**
   For high traffic, implement connection pooling:
   ```typescript
   // Use Supavisor or PgBouncer
   const supabaseUrl = 'https://your-pooler-url.supabase.co';
   ```

### Backup Strategy

**Current:** Automatic backups by Lovable Cloud

**For Production:**
- Enable Point-in-Time Recovery (PITR)
- Set up daily database dumps
- Store backups in separate cloud storage

---

## Google OAuth

### What is Google OAuth?

Google OAuth allows users to sign in using their Google account, providing:
- Faster onboarding
- No password management
- Access to profile information
- Enhanced security

### Current Setup

**Status:** ⏳ Configured in code, requires OAuth credentials

**Implementation Location:**
- `src/pages/Auth.tsx` - Sign in button
- `src/contexts/AuthContext.tsx` - OAuth flow handling

### Setup Instructions

#### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API

#### 2. Configure OAuth Consent Screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Choose **External** user type
3. Fill in application information:
   - App name: **Weekend Flight Finder**
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
   - `openid`
5. Add authorized domains:
   - `lovable.app`
   - Your custom domain (if any)

#### 3. Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth Client ID**
3. Select **Web application**
4. Configure:
   - **Name:** Weekend Flight Finder
   - **Authorized JavaScript origins:**
     ```
     https://mornsczwzuksamxmtmbe.supabase.co
     https://lovable.app
     https://your-custom-domain.com (if applicable)
     ```
   - **Authorized redirect URIs:**
     ```
     https://mornsczwzuksamxmtmbe.supabase.co/auth/v1/callback
     ```

5. Save and copy:
   - Client ID
   - Client Secret

#### 4. Configure in Lovable Cloud

1. Open Lovable project
2. Navigate to **Backend → Authentication**
3. Find **Google** provider
4. Enable and enter:
   - Client ID
   - Client Secret
5. Save configuration

#### 5. Update Site URLs

In **Backend → Authentication → URL Configuration**:

**Site URL:**
```
https://your-production-domain.com
```

**Redirect URLs (add all):**
```
https://your-production-domain.com/**
https://your-preview-url.lovable.app/**
http://localhost:8080/** (for local development)
```

### Code Implementation

```typescript
// Sign in with Google
const handleGoogleSignIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  
  if (error) {
    console.error("Google sign in error:", error);
  }
};
```

### Troubleshooting

**Error: "requested path is invalid"**
- Check Site URL in Authentication settings
- Verify redirect URLs include your domain

**Error: "redirect_uri_mismatch"**
- Add redirect URI to Google Cloud Console
- Format: `https://PROJECT_ID.supabase.co/auth/v1/callback`

**User data not saved:**
- Profile is auto-created via `handle_new_user()` trigger
- Check database logs for errors

### Data Collected

When users sign in with Google:
- Email address
- Full name (stored in `display_name`)
- Profile picture URL (stored in `avatar_url`)

**Privacy Note:** We only request minimum permissions. No access to Gmail, Drive, or other Google services.

### Scaling Considerations

- Google OAuth has rate limits (10,000 requests/day free tier)
- For >10K users/day, request quota increase
- Monitor OAuth error rates in production
- Consider adding other providers (Apple, Facebook) for redundancy

---

## Lovable AI Gateway

### What is Lovable AI?

Lovable AI Gateway provides secure access to AI models without requiring users to manage API keys:
- Google Gemini 2.5 family
- OpenAI GPT-5 family
- Image generation

### Current Setup

**Status:** ✅ Enabled

**API Endpoint:** `https://ai.gateway.lovable.dev/v1/chat/completions`

**Available Models:**
- `google/gemini-2.5-pro` - Best for complex reasoning
- `google/gemini-2.5-flash` - ⭐ Default, balanced performance
- `google/gemini-2.5-flash-lite` - Fast, cost-effective
- `google/gemini-2.5-flash-image` - Image generation
- `openai/gpt-5` - Powerful all-rounder
- `openai/gpt-5-mini` - Cost-effective
- `openai/gpt-5-nano` - Fastest

### Authentication

**Secret Name:** `LOVABLE_API_KEY`

**Location:** Automatically configured in Supabase secrets

**⚠️ NEVER expose this in client code!** Always call through Edge Functions.

### Usage Pattern

#### 1. Create Edge Function

```typescript
// supabase/functions/ai-assistant/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a helpful travel assistant for Weekend Flight Finder."
          },
          {
            role: "user",
            content: message
          }
        ],
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

#### 2. Call from Client

```typescript
const { data, error } = await supabase.functions.invoke('ai-assistant', {
  body: { message: "What are the best weekend destinations from London?" }
});
```

### Rate Limits

**Free Tier:**
- Included usage per month
- Rate limits per workspace (requests/minute)

**Error Handling:**
- `429` - Rate limit exceeded
- `402` - Payment required (credits exhausted)

Both should be handled gracefully in UI:

```typescript
if (error.status === 429) {
  toast({
    title: "Too many requests",
    description: "Please wait a moment and try again.",
    variant: "destructive",
  });
} else if (error.status === 402) {
  toast({
    title: "Credits exhausted",
    description: "Please add credits to continue using AI features.",
    variant: "destructive",
  });
}
```

### Pricing

- Usage-based pricing
- Free monthly credits included
- Top-up via workspace settings

### Scaling Considerations

**For Production:**
1. **Monitor Usage:**
   - Track AI requests in analytics
   - Set up alerts for high usage
   
2. **Implement Caching:**
   ```typescript
   // Cache common queries in database
   const cachedResponse = await supabase
     .from('ai_cache')
     .select('response')
     .eq('query_hash', hash(query))
     .single();
   
   if (cachedResponse) return cachedResponse.response;
   ```

3. **Rate Limiting:**
   - Implement client-side debouncing
   - Server-side rate limiting per user

4. **Alternative Providers:**
   If scaling beyond Lovable AI:
   - Direct OpenAI API integration
   - Direct Google AI integration
   - Self-hosted models (for very high volume)

---

## Amadeus Flight Search API

### What is Amadeus?

Amadeus is a leading travel technology provider offering comprehensive flight search and booking capabilities. We use their API to search for real-time flight offers from 400+ airlines across Europe and globally.

### Current Setup

**Status:** ✅ Enabled

**API Endpoint:** `https://test.api.amadeus.com` (Test Environment)

**Implementation Location:**
- `supabase/functions/search-flights/index.ts` - Flight search edge function
- `src/components/SearchForm.tsx` - User interface

### Authentication

The Amadeus API uses OAuth 2.0 client credentials flow:

**Secrets Configuration:**
```env
AMADEUS_API_KEY=your_api_key
AMADEUS_API_SECRET=your_api_secret
AMADEUS_TEST_API_URL=test.api.amadeus.com
```

**⚠️ IMPORTANT:** These credentials are stored securely in Supabase secrets and only accessible by edge functions.

### Features

**Implemented:**
- ✅ Round-trip flight search
- ✅ Weekend getaway optimization
- ✅ Budget filtering
- ✅ Multi-airline comparison
- ✅ Real-time pricing

**Available but Not Yet Used:**
- ⏳ One-way flights
- ⏳ Multi-city routes
- ⏳ Seat class selection
- ⏳ Airline preferences
- ⏳ Flexible dates search

### API Usage

#### Edge Function Implementation

```typescript
// Flight search request
const { data, error } = await supabase.functions.invoke('search-flights', {
  body: {
    origin: 'LHR',           // Origin airport code
    departureDate: '2025-01-17',
    returnDate: '2025-01-19',
    maxPrice: 200,           // Optional budget limit
    adults: 1,
  }
});
```

#### Response Format

```json
{
  "data": [
    {
      "id": "1",
      "type": "flight-offer",
      "price": {
        "total": "189.50",
        "currency": "EUR"
      },
      "itineraries": [
        {
          "segments": [
            {
              "departure": {
                "iataCode": "LHR",
                "at": "2025-01-17T08:30:00"
              },
              "arrival": {
                "iataCode": "BCN",
                "at": "2025-01-17T11:45:00"
              },
              "carrierCode": "BA",
              "number": "492",
              "aircraft": {
                "code": "320"
              },
              "duration": "PT2H15M"
            }
          ]
        }
      ]
    }
  ]
}
```

### Rate Limits

**Test Environment:**
- 2,000 API calls per month (free)
- 10 calls per second

**Production Environment:**
- Requires paid plan
- Higher rate limits available
- Enterprise options for high-volume

### Error Handling

The edge function handles common errors:

```typescript
// 401 - Invalid credentials
// 429 - Rate limit exceeded  
// 400 - Invalid request parameters
// 500 - Amadeus API error
```

All errors are logged to edge function logs and returned to the client with appropriate messages.

### Testing

**Test Account:** Currently using test environment with sample data

**Test Scenarios:**
- Search from major European airports (LHR, CDG, MAD, etc.)
- Weekend date ranges
- Budget constraints
- Multiple passengers

### Migration to Production

To move to production Amadeus API:

1. **Upgrade Account:**
   - Visit [developers.amadeus.com](https://developers.amadeus.com)
   - Choose a production plan
   - Get production credentials

2. **Update Secrets:**
   - Update `AMADEUS_API_KEY` with production key
   - Update `AMADEUS_API_SECRET` with production secret
   - Update `AMADEUS_TEST_API_URL` to `api.amadeus.com`

3. **Testing:**
   - Verify real flight data
   - Monitor API usage
   - Set up alerts for rate limits

### Costs

**Test Environment:** Free (2,000 calls/month)

**Production Pricing (estimated):**
- Pay-as-you-go: ~€0.01-0.05 per search
- Monthly plans: Starting at €49/month
- Enterprise: Custom pricing

**Optimization Tips:**
- Cache popular routes
- Implement request debouncing
- Use batch requests when possible

### Scaling Considerations

For high-volume production use:

1. **Caching Strategy:**
   ```typescript
   // Cache flight results for 15 minutes
   // Reduces API calls by ~70%
   ```

2. **Alternative Providers:**
   - Implement Kiwi.com as fallback
   - Use multiple providers for redundancy

3. **Connection Pooling:**
   - Reuse OAuth tokens (valid for 30 minutes)
   - Implement token refresh logic

### Support

- **Documentation:** [developers.amadeus.com/docs](https://developers.amadeus.com/docs)
- **Support Portal:** [developers.amadeus.com/support](https://developers.amadeus.com/support)
- **Community:** Stack Overflow tag `amadeus-api`

---

## Future Integrations

### Planned Flight Data Providers

#### 1. Kiwi.com API (Alternative)
**Purpose:** Budget flight aggregation

**Features:**
- Multi-city search
- Budget airlines focus
- Price alerts
- Good for European low-cost carriers

**Status:** ⏳ Not yet implemented

#### 2. Skyscanner API
**Purpose:** Flight comparison

**Features:**
- Multi-source aggregation
- Price comparison
- Popular with consumers

**Status:** ⏳ Requires partnership application

**Note:** Amadeus API is now implemented and active. See [Amadeus Flight Search API](#amadeus-flight-search-api) section above.

### Planned Payment Integration

#### Stripe
**Purpose:** Payment processing for premium features

**Setup Steps:**
1. Create Stripe account
2. Enable Stripe integration in Lovable
3. Add publishable and secret keys
4. Implement checkout flows

### Planned Analytics

#### PostHog or Plausible
**Purpose:** User analytics and behavior tracking

**Features:**
- Privacy-friendly
- GDPR compliant
- Feature flags
- A/B testing

---

## Environment Variables Summary

### Development
```env
# Supabase (auto-configured by Lovable)
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=PROJECT_ID
```

### Production (Self-Hosted)
```env
# Supabase
VITE_SUPABASE_URL=https://your-production-supabase-url.com
VITE_SUPABASE_PUBLISHABLE_KEY=your_production_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id

# Optional: Analytics
VITE_POSTHOG_KEY=your_posthog_key
VITE_POSTHOG_HOST=https://app.posthog.com

# Optional: Error Tracking
VITE_SENTRY_DSN=your_sentry_dsn
```

### Secrets (Backend Only - Never in Client)
```env
# Supabase Edge Functions
LOVABLE_API_KEY=auto_configured_by_lovable
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Amadeus Flight API (Active)
AMADEUS_API_KEY=your_amadeus_key
AMADEUS_API_SECRET=your_amadeus_secret
AMADEUS_TEST_API_URL=test.api.amadeus.com

# Future: Payments
STRIPE_SECRET_KEY=your_stripe_secret_key
```

---

## Security Best Practices

### API Keys Management

1. **Never commit API keys to Git**
   - Use `.env` files (already in `.gitignore`)
   - Use Supabase secrets for backend
   - Use environment variables in hosting

2. **Rotate Keys Regularly**
   - Every 90 days for production
   - Immediately if suspected compromise

3. **Use Least Privilege**
   - Only grant necessary permissions
   - Use read-only keys where possible

### Client-Side Security

```typescript
// ❌ WRONG - Exposes API key
const apiKey = "sk_live_...";
fetch(`https://api.example.com?key=${apiKey}`);

// ✅ CORRECT - Call via Edge Function
const { data } = await supabase.functions.invoke('secure-api-call', {
  body: { query: userInput }
});
```

### CORS Configuration

Edge Functions should implement proper CORS:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, specify your domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

For production:
```typescript
const allowedOrigins = [
  'https://your-domain.com',
  'https://www.your-domain.com'
];

const origin = req.headers.get('origin');
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  // ...
};
```

---

## Monitoring & Logging

### Current Logging

- Console logs in development
- Supabase Auth logs (Backend → Authentication → Logs)
- Database logs (Backend → Database → Logs)

### Recommended for Production

1. **Error Tracking:**
   - Sentry or Rollbar
   - Track frontend and backend errors
   - User session replay

2. **Performance Monitoring:**
   - Web Vitals tracking
   - API response times
   - Database query performance

3. **User Analytics:**
   - PostHog or Plausible
   - Privacy-friendly
   - Feature usage tracking

---

## Compliance & Privacy

### GDPR Considerations

**Data Collected:**
- Email addresses (required for auth)
- Names (optional, from OAuth)
- Search history (saved searches)
- Preferences (trip preferences)

**User Rights:**
1. **Right to Access** - Users can view all their data
2. **Right to Deletion** - Implement account deletion
3. **Right to Portability** - Export user data feature

**To Implement:**
```typescript
// Data export
const exportUserData = async (userId: string) => {
  const { data } = await supabase.rpc('export_user_data', { user_id: userId });
  return data;
};

// Account deletion
const deleteAccount = async (userId: string) => {
  // Cascade deletes handle related data
  await supabase.auth.admin.deleteUser(userId);
};
```

### Cookie Policy

**Current Cookies:**
- Supabase auth token (required)
- Session persistence (required)

**For Production:**
- Add cookie consent banner
- Document all cookies used
- Allow opt-out of analytics

---

## Support & Documentation Links

### Official Documentation

- [Lovable Docs](https://docs.lovable.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Google OAuth Guide](https://developers.google.com/identity/protocols/oauth2)

### Support Channels

- Lovable: support@lovable.dev
- Community: [Lovable Discord](https://discord.gg/lovable)

### Related Project Docs

- [Database Schema](./DATABASE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Dependencies](./DEPENDENCIES.md)

---

**Last Updated:** 2025-11-15
**Maintainer:** Development Team
**Review Schedule:** Update with every integration change
