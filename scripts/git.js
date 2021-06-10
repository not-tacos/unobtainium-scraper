'use strict';

const run = require('./exec');

module.exports = (() => {
  const mod = this;
  mod.dry = false;

  this.run = (cmd) => {
    const gitCmd = 'git ' + cmd;
    if (mod.dry) {
      console.log('> ' + gitCmd);
      return 0;
    } else {
      return run(gitCmd);
    }
  };

  this.run.init = (dry) => {
    mod.dry = dry;
    return this.run;
  };

  return this.run;
})();

