const hostName = require('os').hostname();
const { spawn } = require('child_process');
const ls = spawn('ng', ['serve', '--port', '8100', '--host', hostName]);
ls.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

ls.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

ls.on('error', (error) => {
  console.log(`error: ${error.message}`);
});

ls.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
