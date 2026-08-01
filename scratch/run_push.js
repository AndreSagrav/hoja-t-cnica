const { exec } = require('child_process');
const fs = require('fs');

const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' };

exec('git -c credential.helper= push origin main', { env }, (err, stdout, stderr) => {
  const result = `Date: ${new Date().toISOString()}\nError: ${err ? err.message : 'none'}\nStdout: ${stdout}\nStderr: ${stderr}`;
  fs.writeFileSync('scratch/push_result.txt', result);
  console.log('Done!');
});
