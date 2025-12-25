# Copilot Processing - Docker Multi-Architecture Build Issue

## Problem Statement
User reports that pulling Docker image `ghcr.io/spelbreker/ws-swim-stopwatch:v1.3.0` fails on Raspberry Pi (linux/arm64/v8) with:
```
Error response from daemon: no matching manifest for linux/arm64/v8 in the manifest list entries: no match for platform in manifest: not found
```

**Request:** Adapt workflow to:
1. Build multi-architecture Docker images (including arm64)
2. Ensure latest build also gets the `:latest` tag

## Initial Understanding
- The Docker image is not being built for ARM64 architecture (needed for Raspberry Pi)
- Need to check GitHub Actions workflow for Docker builds
- Need to ensure both version tags and `:latest` tag are applied

## Repository Context
- Location: `/home/runner/work/ws-swim-stopwatch/ws-swim-stopwatch`
- Has Dockerfile and docker-compose.yml
- Likely has GitHub Actions workflow in `.github/workflows/`

## Plan (To be updated)
- [ ] Explore GitHub Actions workflows
- [ ] Check current Docker build configuration
- [ ] Identify where to add multi-platform build support
- [ ] Add ARM64 (and other relevant platforms) to build
- [ ] Ensure `:latest` tag is applied
- [ ] Test and validate changes
