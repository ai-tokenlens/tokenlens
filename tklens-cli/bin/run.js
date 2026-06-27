#!/usr/bin/env node

const { run, flush, handle } = require('@oclif/core');
run(process.argv.slice(2), __dirname).then(flush).catch(handle);
