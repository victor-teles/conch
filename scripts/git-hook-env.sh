# Git GUIs run hooks without the login shell profile, so bun and nvm's node
# are off PATH and bun would run Vitest on its own runtime instead of Node.
for dir in "$HOME/.bun/bin" /opt/homebrew/bin /usr/local/bin; do
  case ":$PATH:" in
    *":$dir:"*) ;;
    *) [ -d "$dir" ] && PATH="$dir:$PATH" ;;
  esac
done
NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if ! command -v node >/dev/null 2>&1 && [ -s "$NVM_SCRIPT" ]; then
  . "$NVM_SCRIPT"
fi
export PATH
