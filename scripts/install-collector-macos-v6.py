#!/usr/bin/env python3
"""Install the v6 local service without changing any existing plist or source files."""
import argparse, os, pathlib, plistlib, shutil, subprocess
parser = argparse.ArgumentParser()
parser.add_argument('--install', action='store_true')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
node = shutil.which('node')
if not node:
    raise SystemExit('Node.js required')
label = 'ai.claude-usage.collector-v6'
private = root / '.private'
private.mkdir(mode=0o700, exist_ok=True)
job = {'Label': label, 'ProgramArguments': [node, str(root / 'scripts/sync-claude-v6.mjs'), '--publish'],
       'WorkingDirectory': str(root), 'RunAtLoad': True, 'StartInterval': 300,
       'StandardOutPath': str(private / 'collector.log'), 'StandardErrorPath': str(private / 'collector.log'),
       'EnvironmentVariables': {'PATH': f'{pathlib.Path(node).parent}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'}}
output = root / 'ai.claude-usage.collector-v6.plist'
# The generated local plist has machine paths, so it is ignored by Git.
output.write_bytes(plistlib.dumps(job))
if args.install:
    destination = pathlib.Path.home() / 'Library/LaunchAgents' / output.name
    if destination.exists():
        raise SystemExit('v6 job already exists; inspect it before reinstalling')
    shutil.copyfile(output, destination)
    subprocess.run(['launchctl', 'bootstrap', f'gui/{os.getuid()}', str(destination)], check=True)
    print('Installed 5-minute local collector; publication at most once per hour.')
else:
    print('Generated local plist. Use --install to enable it.')
