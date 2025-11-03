# Deployment Guide: Patched Qwen Code Build

This guide covers how to build, publish, and install the patched qwen-code build with infinite loop prevention and XML tag filtering.

## What Was Fixed

### Server-Side Fixes (qwen3-coder-480b-dual-gpu)

- Added `--repeat-penalty 1.1` to prevent token repetition
- Added `--frequency-penalty 0.5` as additional deterrent
- Updated both launch-maxed.sh and systemd service

### Client-Side Fixes (qwen-code fork)

1. **Stop Sequences** (pipeline.ts): Added XML stop tokens to prevent infinite generation
2. **XML Filtering** (xmlToolCallFilter.ts): New utility to filter incomplete XML tags
3. **Stream Filtering** (converter.ts): Integrated filtering in chunk conversion

## Building the Patched Version

### 1. Build the Project

```bash
cd ~/Developer/qwen-code

# Install dependencies
npm install

# Build all packages
npm run build
```

### 2. Verify the Build

```bash
# Check the CLI builds correctly
ls -lh packages/cli/dist/

# Verify core package builds
ls -lh packages/core/dist/
```

## Installation Options

### Option A: Local Installation (npm link)

Best for development and testing on the same machine:

```bash
cd ~/Developer/qwen-code
npm link

# Test it works
qwen --version
# Should show: 0.1.3-nightly.20251102.ff8a8ac6
```

To use with custom alias:

```bash
# Update your qc-480b alias to point to port 10002
echo 'alias qc-480b="OPENAI_BASE_URL=http://localhost:10002/v1 OPENAI_API_KEY=EMPTY qwen -m qwen3-coder-480b-maxed"' >> ~/.bashrc
source ~/.bashrc
```

### Option B: GitHub Installation (Recommended for Other Hosts)

Best for distributing to multiple machines:

1. **Push your fork to GitHub** (if not already done):

```bash
cd ~/Developer/qwen-code
git remote -v  # Verify your fork URL

# If you need to set up the fork
git remote add origin https://github.com/YOUR_USERNAME/qwen-code.git
git push -u origin main
```

2. **Install on other hosts**:

```bash
# On the target machine
npm install -g github:YOUR_USERNAME/qwen-code#main

# Or install from a specific commit
npm install -g github:YOUR_USERNAME/qwen-code#ff8a8ac6
```

### Option C: Tarball Distribution

Best for air-gapped or restricted environments:

1. **Create a tarball**:

```bash
cd ~/Developer/qwen-code
npm pack

# This creates: qwen-code-0.1.3-nightly.20251102.ff8a8ac6.tgz
```

2. **Copy to target machine** (via scp, rsync, etc.):

```bash
scp qwen-code-0.1.3-nightly.20251102.ff8a8ac6.tgz user@remote:/tmp/
```

3. **Install on target machine**:

```bash
cd /tmp
npm install -g qwen-code-0.1.3-nightly.20251102.ff8a8ac6.tgz
```

### Option D: Private npm Registry

Best for organization-wide deployment:

1. **Configure private registry** (Verdaccio, Artifactory, etc.)
2. **Publish to private registry**:

```bash
cd ~/Developer/qwen-code
npm publish --registry https://your-registry.com/
```

3. **Install from private registry**:

```bash
npm install -g @qwen-code/qwen-code --registry https://your-registry.com/
```

## Complete Setup on New Host

### 1. Install Prerequisites

```bash
# Node.js 20+ required
node --version  # Should be v20.x or higher

# Install globally
npm install -g npm@latest
```

### 2. Install Patched Qwen Code

Choose one of the options above (GitHub recommended):

```bash
npm install -g github:YOUR_USERNAME/qwen-code#main
```

### 3. Configure Server Connection

Create the alias pointing to your optimized server:

```bash
# Add to ~/.bashrc
cat >> ~/.bashrc << 'EOF'

# Qwen3-Coder-480B Optimized Server
alias qc-480b='OPENAI_BASE_URL=http://SERVER_IP:10002/v1 OPENAI_API_KEY=EMPTY qwen -m qwen3-coder-480b-maxed'
EOF

source ~/.bashrc
```

**Replace `SERVER_IP`** with:

- `localhost` if running locally
- Actual IP address if accessing over network (e.g., `192.168.1.100`)

### 4. Test the Installation

```bash
# Test connection
qc-480b "What is 2+2?"

# Test tool calling
qc-480b "Read the contents of /etc/hostname"
```

## Deploying Server Configuration

If setting up the optimized server on a new machine:

### 1. Copy Server Files

```bash
# From source machine
scp -r ~/Developer/qwen3-coder-480b-dual-gpu user@remote:~/Developer/

# Or just the essential files
scp ~/Developer/qwen3-coder-480b-dual-gpu/{launch-maxed.sh,qwen3-coder-480b.service,qwen-strict-tool-template.jinja} user@remote:~/Developer/qwen3-coder-480b-dual-gpu/
```

### 2. Update Paths on Target Machine

Edit launch-maxed.sh and qwen3-coder-480b.service to match local paths:

- Model path
- Template path
- Log directories

### 3. Install Systemd Service

```bash
cd ~/Developer/qwen3-coder-480b-dual-gpu

# Copy service file
sudo cp qwen3-coder-480b.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start
sudo systemctl enable qwen3-coder-480b

# Start service
sudo systemctl start qwen3-coder-480b

# Check status
sudo systemctl status qwen3-coder-480b
```

## Verification Checklist

### Server Verification

```bash
# Check server is running
curl http://localhost:10002/v1/models

# Test completion endpoint
curl http://localhost:10002/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-coder-480b-maxed",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

### Client Verification

```bash
# Check version
qwen --version
# Should show: 0.1.3-nightly.20251102.ff8a8ac6

# Check CLI works
qc-480b "Test message"

# Verify no XML tag leaks in output
# Output should be clean, no <function=... or <tool_call> visible

# Test tool calling doesn't loop
qc-480b "Read /etc/hostname and tell me the hostname"
# Should complete within ~10 seconds, not hang
```

### Performance Verification

```bash
# Monitor GPU usage during inference
watch -n 1 nvidia-smi

# Check server logs for token/s metrics
tail -f ~/Developer/qwen3-coder-480b-dual-gpu/logs/service.log | grep "tok/s"

# Expected: 60-70 tok/s with maxed configuration
```

## Troubleshooting

### Issue: "qwen: command not found"

**Solution**: Reinstall or check PATH

```bash
npm install -g github:YOUR_USERNAME/qwen-code#main
which qwen  # Should show global npm bin path
```

### Issue: XML tags still appearing in output

**Solution**: Verify you're using the patched version

```bash
qwen --version  # Should match your fork version
npm list -g @qwen-code/qwen-code  # Check installation
```

### Issue: Server returns 404

**Solution**: Check server status and port

```bash
sudo systemctl status qwen3-coder-480b
lsof -ti:10002  # Verify port is listening
```

### Issue: Infinite loop still occurs

**Solution**: Verify server has repetition penalties

```bash
# Check launch script has:
grep "repeat-penalty" ~/Developer/qwen3-coder-480b-dual-gpu/launch-maxed.sh

# Should show:
#   --repeat-penalty 1.1 \
#   --frequency-penalty 0.5 \
```

## Version Management

### Tracking Your Fork

```bash
cd ~/Developer/qwen-code

# Check current commit
git log -1 --oneline
# Should show: ff8a8ac6

# Create a tag for this patched version
git tag -a v0.1.3-patched -m "Infinite loop fix + XML filtering"
git push origin v0.1.3-patched
```

### Installing Specific Version

```bash
# Install tagged version
npm install -g github:YOUR_USERNAME/qwen-code#v0.1.3-patched

# Install specific commit
npm install -g github:YOUR_USERNAME/qwen-code#ff8a8ac6
```

## Rollback Plan

If the patched version causes issues:

### Rollback Client

```bash
# Uninstall patched version
npm uninstall -g @qwen-code/qwen-code

# Reinstall official nightly
npm install -g @qwen-code/qwen-code@0.1.3-nightly.20251102.ff8a8ac6
```

### Rollback Server

```bash
# Revert launch script
cd ~/Developer/qwen3-coder-480b-dual-gpu
git checkout launch-maxed.sh qwen3-coder-480b.service

# Restart service
sudo systemctl restart qwen3-coder-480b
```

## Summary

**For Development Machine (localhost):**

```bash
cd ~/Developer/qwen-code
npm install && npm run build
npm link
echo 'alias qc-480b="OPENAI_BASE_URL=http://localhost:10002/v1 OPENAI_API_KEY=EMPTY qwen -m qwen3-coder-480b-maxed"' >> ~/.bashrc
source ~/.bashrc
```

**For Remote Hosts (network access):**

```bash
npm install -g github:YOUR_USERNAME/qwen-code#main
echo 'alias qc-480b="OPENAI_BASE_URL=http://SERVER_IP:10002/v1 OPENAI_API_KEY=EMPTY qwen -m qwen3-coder-480b-maxed"' >> ~/.bashrc
source ~/.bashrc
qc-480b "Test connection"
```

## Next Steps

1. Test the patched version locally first
2. Push your fork to GitHub (if using Option B)
3. Deploy to one remote host as a test
4. Verify performance and stability
5. Roll out to remaining hosts
6. Consider submitting a PR to upstream qwen-code repository
