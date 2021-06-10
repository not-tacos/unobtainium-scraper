'use strict';

const {execSync} = require('child_process');

const run = (cmd) => {
  console.log('> ' + cmd);
  return execSync(cmd).toString();
};

module.exports = run;
