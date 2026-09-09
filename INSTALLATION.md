# Installation Guide - Sensor Data Blockchain

## Fix MODULE_NOT_FOUND Error for @polkadot/api

If you're getting a `MODULE_NOT_FOUND` error for `@polkadot/api`, follow these steps to install all required dependencies:

## Step 1: Install Node.js Dependencies

Navigate to your project directory and install all npm packages:

```bash
npm install
```

This will install all dependencies listed in `package.json`, including:
- `@polkadot/api` - Polkadot.js API library
- `@polkadot/keyring` - Keyring for account management
- `@polkadot/types` - Type definitions
- `@polkadot/util` and `@polkadot/util-crypto` - Utilities
- `express` - Web server framework
- `dotenv` - Environment variable management
- `winston` - Logging library
- Other dependencies

## Step 2: Verify Installation

After installation, verify that the Polkadot modules are installed:

```bash
# Check if node_modules exists
ls -la node_modules/ | grep polkadot

# Or check package-lock.json
cat package-lock.json | grep "@polkadot"
```

You should see directories for:
- `@polkadot/api`
- `@polkadot/keyring`
- `@polkadot/types`
- `@polkadot/util`
- `@polkadot/util-crypto`

## Step 3: Install Individual Package (If Needed)

If you only want to install specific Polkadot packages:

```bash
# Install only the Polkadot API
npm install @polkadot/api@latest

# Install with a specific version
npm install @polkadot/api@12.0.0

# Install all Polkadot packages
npm install @polkadot/api @polkadot/keyring @polkadot/types @polkadot/util @polkadot/util-crypto
```

## Step 4: Configure Environment Variables

Create a `.env` file in your project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3001
NODE_ENV=development
WS_PROVIDER=ws://127.0.0.1:9944
LOG_LEVEL=info
```

## Step 5: Verify Substrate Node Connection

Before running the server, ensure your Substrate node is running on `ws://127.0.0.1:9944`.

**Option A: Run Local Substrate Node**
```bash
# Using Substrate binary
substrate --dev --ws-external --rpc-external
```

**Option B: Use Docker**
```bash
docker run -p 9944:9944 -p 9933:9933 \
  parity/substrate:latest \
  --dev --ws-external --rpc-external
```

**Option C: Use existing Substrate node**
- Update `WS_PROVIDER` in `.env` to your node's WebSocket URL

## Step 6: Run the Server

```bash
# Start the solar data server
npm start

# Or run solar-server.js directly
node src/solar-server.js
```

You should see output like:
```
Starting Solar Data Blockchain Server...
BlockchainService initialized with account: 5GrwvaEF5zXb26Fz9rcQkQJqp...
Solar Data Server listening on port 3001
POST /solar-data - Submit solar data from ESP32
GET /health - Health check endpoint
```

## Troubleshooting

### Issue: `MODULE_NOT_FOUND: Cannot find module '@polkadot/api'`

**Solution 1:** Delete node_modules and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

**Solution 2:** Clear npm cache
```bash
npm cache clean --force
npm install
```

**Solution 3:** Use npm audit to check for conflicts
```bash
npm audit
npm audit fix
```

### Issue: Permission errors during installation

**On Linux/Mac:**
```bash
# Use sudo (not recommended)
sudo npm install

# Or fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install
```

**On Windows:**
Run Command Prompt as Administrator

### Issue: `ENOENT: no such file or directory`

**Solution:** Create required directories
```bash
mkdir -p logs data
```

### Issue: `WebSocket connection failed`

**Solution:** Verify Substrate node is running
```bash
# Check if node is accessible
curl -X POST http://127.0.0.1:9933 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}'
```

## Complete Setup Checklist

- [ ] Clone or create project repository
- [ ] Run `npm install` to install dependencies
- [ ] Copy `.env.example` to `.env`
- [ ] Update `.env` with your configuration
- [ ] Ensure Substrate node is running
- [ ] Run `npm start` to start the server
- [ ] Test with `curl -X GET http://localhost:3001/health`
- [ ] Submit test data with `curl -X POST http://localhost:3001/solar-data -H "Content-Type: application/json" -d '{"voltage": 48.5, "current": 12.3}'`

## System Requirements

- **Node.js:** 16.0.0 or higher (recommended 18+)
- **npm:** 7.0.0 or higher
- **RAM:** Minimum 512MB (1GB recommended)
- **Disk Space:** 100MB for dependencies
- **Substrate Node:** Running on WebSocket endpoint

## Additional Resources

- [Polkadot.js Documentation](https://polkadot.js.org/docs/)
- [Node.js Download](https://nodejs.org/)
- [npm Documentation](https://docs.npmjs.com/)
- [Substrate Documentation](https://docs.substrate.io/)

## Next Steps

After successful installation:

1. **Test the health endpoint:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Submit solar data:**
   ```bash
   curl -X POST http://localhost:3001/solar-data \
     -H "Content-Type: application/json" \
     -d '{"voltage": 48.5, "current": 12.3}'
   ```

3. **Configure ESP32 to send data:**
   See `ESP32_EXAMPLE.md` for ESP32 Arduino code

4. **Monitor logs:**
   ```bash
   tail -f logs/combined.log
   ```
