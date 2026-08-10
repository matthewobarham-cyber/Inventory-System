import { spawn } from 'node:child_process';
import electronPath from 'electron';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.CHROME_CRASHPAD_PIPE_NAME;
delete env.VSCODE_CRASH_REPORTER_PROCESS_TYPE;

const suppliedArgs = process.argv.slice(2);
const child = spawn(electronPath, suppliedArgs.length ? suppliedArgs : ['.'], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  windowsHide: false
});

child.on('error', (error) => {
  console.error(`Unable to start Electron: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
