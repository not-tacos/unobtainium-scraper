'use strict';

const {argv} = require('yargs');
const _ = require('lodash');
const run = require('./exec');
const version = require('../package.json').version;

const isDryRun = !!argv.dryRun;
const git = require('./git').init(isDryRun);
const tagName = 'v' + version;
const releaseBranch = 'release/' + tagName;
const currentBranchPattern = /On branch ([\S]+)/g;
const gitStatusOutput = run('git status');

const currentBranchName = _.get(currentBranchPattern.exec(gitStatusOutput), '[1]', null);

if (!currentBranchName) {
  console.error('Failed to find branch!');
  process.exit(1);
}

console.log('>>> ----- CREATING RELEASE ----- <<<');
console.log('>>> ----- "' + currentBranchName + '" ----- <<<');

git('stash');
git('checkout -b ' + releaseBranch);
git('stash apply');
git('add --all');
git('commit -m "' + tagName + '"');
git('tag -f ' + tagName);
git('push origin --tags -f ' + releaseBranch);
git('checkout ' + currentBranchName);
git('merge ' + releaseBranch);
git('push origin ' + currentBranchName);

console.log('>>> ----- "' + currentBranchName + '" ----- <<<');
console.log('>>> ----- RELEASE CREATED ----- <<<');
