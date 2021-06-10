'use strict';

const {argv} = require('yargs');
const {toString} = require('lodash');
const run = require('./exec.js');

const {releaseAs} = argv;
run('npm version --no-get-tag-version --allow-same-version ' + toString(releaseAs));

