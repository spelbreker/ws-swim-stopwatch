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
- [x] Explore GitHub Actions workflows
- [x] Check current Docker build configuration
- [x] Identify where to add multi-platform build support
- [x] Add ARM64 (and other relevant platforms) to build
- [x] Ensure `:latest` tag is applied
- [x] Test and validate changes

## Changes Made

### docker-publish.yml Modifications
Added two key improvements to the Docker build workflow:

1. **Multi-Platform Build Support:**
   - Added `platforms: linux/amd64,linux/arm64` to the build-push-action
   - This enables the Docker image to run on both AMD64 (standard x86_64) and ARM64 (Raspberry Pi) architectures
   - Docker Buildx (already configured in the workflow) handles the multi-architecture builds

2. **Latest Tag:**
   - Added `ghcr.io/spelbreker/ws-swim-stopwatch:latest` to the tags list
   - Every versioned release (v*.*.*) will now also update the `:latest` tag
   - This provides a convenient way to pull the most recent stable version

### Technical Details
- The workflow triggers on git tags matching pattern `v*.*.*`
- Each build now produces images for both architectures in a single manifest
- Docker will automatically pull the correct architecture when using `docker pull`
- The `:latest` tag ensures users can always get the newest version without specifying a version number
