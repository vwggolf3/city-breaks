---
sop_name: deploy-supabase-app
repo_name: city-breaks
app_name: CityBreaks
app_type: Lovable Application with Supabase
branch: main
created: 2026-02-13T00:00:00Z
last_updated: 2026-02-13T00:00:00Z
---

# Deployment Plan: City Breaks

Coding Agents should follow this Deployment Plan, and validate previous progress if picking up the Deployment in a new coding session.

**IMPORTANT**: Update this plan after EACH step completes. Mark the step `[x]` and update `last_updated` timestamp.

## Phase 1: Gather Context and Configure
- [x] Step 0: Inform User of Execution Flow
- [x] Step 1: Create Deployment Plan
- [x] Step 2: Create Deploy Branch
- [x] Step 3: Detect Build Configuration
- [x] Step 4: Validate Prerequisites
- [x] Step 5: Analyze Supabase Structure
- [x] Step 6: Configure Supabase Project
- [x] Step 7: Revisit Deployment Plan

## Phase 2: Migrate Edge Functions
- [x] Step 8: Create Lambda Directory Structure
- [x] Step 9: Detect and Create Required Secrets
- [x] Step 10: Migrate Edge Functions to Lambda Format (21 functions)
- [x] Step 11: Detect and Convert AI Functions to Bedrock (skipped - no AI)
- [x] Step 12: Migrate Lovable Cloud Auth to Supabase OAuth (skipped - not detected)
- [x] Step 13: Update All Edge Function References
- [x] Step 14: Delete Original Supabase Functions
- [x] Step 15: Update .gitignore

## Phase 3: Build CDK Infrastructure
- [ ] Step 16: Initialize CDK Foundation
- [ ] Step 17: Generate Lambda Stack
- [ ] Step 18: Generate Frontend Stack
- [ ] Step 19: Create Deployment Script
- [ ] Step 20: Validate CDK Synth

## Phase 4: Deploy, Validate, and Document
- [ ] Step 21: Execute CDK Deployment
- [ ] Step 22: Validate Edge Functions
- [ ] Step 23: Validate All Stacks
- [ ] Step 24: Finalize Deployment Plan
- [ ] Step 25: Update README.md
- [ ] Step 26: Completion Checklist

## Deployment Info

- Deployment URL: [after completion]
- Lambda Stack: CityBreaksLambda-preview-gabbypop
- Frontend Stack: CityBreaksFrontend-preview-gabbypop
- Supabase Project: rzvkcsuluelkkcovvaqz (city-breaks-aws)
- Edge Functions Count: 21
- Secret: CityBreaks/preview-gabbypop/secrets

## Recovery Guide

```bash
# Rollback
cdk destroy --all

# Redeploy
./scripts/deploy.sh
```

## Issues Encountered

None.

## Session Log

### Session 1 - 2026-02-13T00:00:00Z
Agent: Auto
Progress: Created deployment plan
Next: Step 2 - Create deploy branch
