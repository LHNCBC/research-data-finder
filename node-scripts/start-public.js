const hostName = require('os').hostname();
const { spawn } = require('child_process');
spawn('ng', ['serve', '--port', '8100', '--host', hostName], {
  stdio: 'inherit'
});
