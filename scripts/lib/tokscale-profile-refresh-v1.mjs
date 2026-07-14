const DEFAULT_TOOL_PATHS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin"
];

export const PROFILE_REFRESH_DEFAULTS = {
  clients: "codex,claude",
  repository: "XxJjTt6/XxJjTt6",
  workflow: "refresh-tokscale-profile-fast.yml",
  ref: "main"
};

export function buildTokscaleSubmitCommand({ clients = PROFILE_REFRESH_DEFAULTS.clients } = {}) {
  return {
    command: "npx",
    args: ["-y", "tokscale@latest", "submit", "--client", clients]
  };
}

export function buildGhWorkflowRunCommand({
  repository = PROFILE_REFRESH_DEFAULTS.repository,
  workflow = PROFILE_REFRESH_DEFAULTS.workflow,
  ref = PROFILE_REFRESH_DEFAULTS.ref
} = {}) {
  return {
    command: "gh",
    args: ["workflow", "run", workflow, "-R", repository, "--ref", ref]
  };
}

export function buildCommandEnv(env = process.env) {
  const nextEnv = { ...env };
  delete nextEnv.GITHUB_TOKEN;

  const existingPath = nextEnv.PATH ? nextEnv.PATH.split(":") : [];
  nextEnv.PATH = [...DEFAULT_TOOL_PATHS, ...existingPath.filter((pathEntry) => !DEFAULT_TOOL_PATHS.includes(pathEntry))].join(":");

  return nextEnv;
}

function escapePlistValue(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildLaunchAgentPlist({
  label,
  nodePath,
  scriptPath,
  workingDirectory,
  logPath,
  intervalSeconds = 900
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapePlistValue(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapePlistValue(nodePath)}</string>
    <string>${escapePlistValue(scriptPath)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapePlistValue(workingDirectory)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${Number(intervalSeconds)}</integer>
  <key>StandardOutPath</key>
  <string>${escapePlistValue(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapePlistValue(logPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${DEFAULT_TOOL_PATHS.join(":")}</string>
  </dict>
</dict>
</plist>
`;
}
