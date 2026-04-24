# Kaicast
KaiCast is a real-time ocean intelligence platform that aggregates multi-source environmental data (NOAA, OpenWeather, Surfline) with community dive reports to model visibility, conditions, and optimal dive windows using heuristic scoring and predictive analysis.
## Claude CLI + Figma plugin setup
Install Claude CLI:
```bash
curl -fsSL https://claude.ai/install.sh | bash
```
If needed, add Claude to your PATH:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```
Verify CLI install:
```bash
claude --version
```
Authenticate:
```bash
claude auth login
```
Add the official marketplace and install the Figma plugin:
```bash
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install figma@claude-plugins-official
```
Verify plugin is installed:
```bash
claude plugin list
```
Verify end-to-end plugin execution (runs a real MCP call):
```bash
claude --dangerously-skip-permissions -p "Use the installed Figma plugin to call whoami once and report the result."
```
### Troubleshooting
- `zsh: command not found: claude`
  - Restart your terminal, or run:
  ```bash
  source ~/.zshrc
  ```
  - Confirm PATH includes `~/.local/bin` and verify:
  ```bash
  claude --version
  ```
- `Plugin "figma" not found in marketplace "claude-plugins-official"`
  - Add or refresh the official marketplace, then retry install:
  ```bash
  claude plugin marketplace add anthropics/claude-plugins-official
  claude plugin marketplace update claude-plugins-official
  claude plugin install figma@claude-plugins-official
  ```
- `Not logged in · Please run /login`
  - Authenticate and retry:
  ```bash
  claude auth login
  ```
- MCP tool call prompts for permission
  - Approve the MCP permission prompt in-session, or (for non-interactive verification only) run:
  ```bash
  claude --dangerously-skip-permissions -p "Use the installed Figma plugin to call whoami once and report the result."
  ```
