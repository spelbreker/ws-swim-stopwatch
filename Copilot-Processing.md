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

## Verification

### Code Review
✅ Code review passed with no issues

### Security Scan
✅ CodeQL security scan passed with 0 alerts

### YAML Validation
✅ Workflow YAML syntax validated successfully

## How to Test
After merging this PR, create a new version tag (e.g., `v1.3.1`):
```bash
git tag v1.3.1
git push origin v1.3.1
```

The workflow will automatically:
1. Build images for both linux/amd64 and linux/arm64
2. Push them with three tags: the SHA, the version tag, and `:latest`

On Raspberry Pi, users can now pull:
```bash
docker pull ghcr.io/spelbreker/ws-swim-stopwatch:v1.3.1
# or
docker pull ghcr.io/spelbreker/ws-swim-stopwatch:latest
```

## Solution Summary
The problem was that the Docker build workflow only built for the default platform (linux/amd64). By adding the `platforms` parameter with both `linux/amd64` and `linux/arm64`, Docker Buildx will create a multi-architecture manifest that allows Docker to automatically select the correct image for the user's platform.

The `:latest` tag addition ensures that users who want to always use the most recent version don't need to track version numbers.
