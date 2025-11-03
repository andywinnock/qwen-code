# macOS Installation Guide: qwen-code 0.1.3-loop-fix

Complete instructions for building and installing the patched qwen-code on macOS.

## Prerequisites

### 1. Check Node Version

```bash
node --version
```

**Required**: Node 20.x or higher

If you don't have Node 20+:

```bash
# Using Homebrew (recommended)
brew install node@20
brew link --overwrite node@20

# Or using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

### 2. Verify npm

```bash
npm --version
# Should show 10.x or higher
```

## Option A: Install Pre-Built Tarball (Easiest)

**Step 1**: Get the tarball from the Ubuntu machine

```bash
# On Ubuntu machine
cd ~/Developer/qwen-code
scp qwen-code-qwen-code-0.1.3-loop-fix.tgz user@macos-machine:~/Downloads/
```

**Step 2**: Install on macOS

```bash
# On macOS
cd ~/Downloads
npm install -g qwen-code-qwen-code-0.1.3-loop-fix.tgz

# Fix missing tiktoken dependency
cd $(npm root -g)/@qwen-code/qwen-code
npm install --no-save --ignore-scripts tiktoken
```

**Step 3**: Verify

```bash
qwen --version
# Should show: 0.1.3-loop-fix
```

## Option B: Build from Source

### Step 1: Clone the Repository

```bash
cd ~/Developer
git clone https://github.com/andywinnock/qwen-code.git
cd qwen-code
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build the Project

```bash
npm run build
```

This will:

- Compile all TypeScript packages
- Generate the CLI bundle
- Create the distribution files

### Step 4: Create Package

```bash
npm pack
```

This creates: `qwen-code-qwen-code-0.1.3-loop-fix.tgz`

### Step 5: Install Globally

```bash
npm install -g ./qwen-code-qwen-code-0.1.3-loop-fix.tgz

# Fix missing tiktoken dependency
cd $(npm root -g)/@qwen-code/qwen-code
npm install --no-save --ignore-scripts tiktoken
```

### Step 6: Verify Installation

```bash
qwen --version
# Should output: 0.1.3-loop-fix

# Test basic functionality
qwen "What is 2+2?"
```

## Common Issues

### Issue: "husky: command not found" during build

**Solution**: This is expected during `npm pack`. The prepare script fails but the tarball still builds correctly.

### Issue: ERR_MODULE_NOT_FOUND tiktoken

**Solution**: Install tiktoken manually:

```bash
cd $(npm root -g)/@qwen-code/qwen-code
npm install --no-save --ignore-scripts tiktoken
```

### Issue: Node version too old

**Solution**: Upgrade to Node 20:

```bash
brew upgrade node
# Or
nvm install 20 && nvm use 20
```

### Issue: Permission denied during global install

**Solution**: Either use sudo or fix npm permissions:

```bash
# Option 1: Use sudo
sudo npm install -g ./qwen-code-qwen-code-0.1.3-loop-fix.tgz

# Option 2: Fix npm global permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

## What's Patched

This version includes two critical fixes:

### Server-Side Fixes (Required on llama.cpp server)

Add these flags to your llama-server launch command:

```bash
--repeat-penalty 1.1 \
--frequency-penalty 0.5
```

### Client-Side Fixes (Included in this build)

1. **Stop Sequences**: Prevents infinite generation loops
2. **XML Filtering**: Removes incomplete `<function=...>` tags from output
3. **Loop Detection**: Warns when repetitive patterns detected

## Testing the Fixes

### Test 1: Version Check

```bash
qwen --version
# Expected: 0.1.3-loop-fix
```

### Test 2: Basic Inference

```bash
qwen "What is the capital of France?"
# Should complete without showing XML tags
```

### Test 3: Tool Calling (with compatible server)

```bash
# Configure server URL
export OPENAI_BASE_URL=http://SERVER_IP:10002/v1
export OPENAI_API_KEY=EMPTY

# Test tool call
qwen "Read the contents of /etc/hostname"
# Should execute tool without infinite loops
# Should not show raw <function=read_file> tags
```

## Server Configuration

If you're running your own llama-server with Qwen3-Coder-480B:

```bash
~/llama.cpp/build/bin/llama-server \
  --model /path/to/model.gguf \
  --ctx-size 32768 \
  --n-gpu-layers -1 \
  --chat-template-file qwen-strict-tool-template.jinja \
  --jinja \
  --repeat-penalty 1.1 \
  --frequency-penalty 0.5 \
  --host 0.0.0.0 \
  --port 10002 \
  -v
```

## Deployment Checklist

- [ ] Node 20+ installed
- [ ] Tarball copied to macOS machine
- [ ] Installed with `npm install -g`
- [ ] tiktoken dependency installed
- [ ] Version shows `0.1.3-loop-fix`
- [ ] Basic inference works
- [ ] No XML tags visible in output
- [ ] Server configured with repetition penalties

## Troubleshooting

### Debug Installation

```bash
# Check installation location
which qwen

# Check installed version
npm list -g @qwen-code/qwen-code

# Check dependencies
cd $(npm root -g)/@qwen-code/qwen-code
npm list
```

### Logs

If qwen crashes, check logs:

```bash
# macOS system logs
log show --predicate 'process == "node"' --last 5m

# npm logs (if install fails)
cat ~/.npm/_logs/*-debug-0.log
```

### Clean Reinstall

```bash
# Remove old installation
npm uninstall -g @qwen-code/qwen-code
rm -rf $(npm root -g)/@qwen-code

# Reinstall
npm install -g ./qwen-code-qwen-code-0.1.3-loop-fix.tgz
cd $(npm root -g)/@qwen-code/qwen-code
npm install --no-save --ignore-scripts tiktoken
```

## Updating to Future Versions

When a new version is released:

```bash
cd ~/Developer/qwen-code
git pull origin main
npm install
npm run build
npm pack

# Uninstall old
npm uninstall -g @qwen-code/qwen-code

# Install new
npm install -g ./qwen-code-qwen-code-*.tgz
cd $(npm root -g)/@qwen-code/qwen-code
npm install --no-save --ignore-scripts tiktoken
```

## Support

**Repository**: https://github.com/andywinnock/qwen-code
**Upstream**: https://github.com/QwenLM/qwen-code

For issues specific to the loop fixes, check:

- `DEPLOYMENT.md` - Full deployment documentation
- `INVESTIGATION.md` - Root cause analysis
- `packages/core/src/utils/xmlToolCallFilter.ts` - Filtering implementation
