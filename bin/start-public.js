const hostName = require('os').hostname();
const { spawn } = require('child_process');

const ngArgs = [
  'serve',
  '--port',
  '8100',
  '--host',
  hostName,
  '--poll',
  '2000'
];
if (process.argv[2] && process.argv[2] === '--dist') {
  ngArgs.push('--configuration');
  ngArgs.push('production');
}
spawn('ng', ngArgs, {
  stdio: 'inherit'
});
