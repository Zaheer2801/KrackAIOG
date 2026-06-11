#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Get the actual Electron binary path
const electronPath = require('electron');
const projectRoot = path.join(__dirname, '..');

console.log('Launching Electron from:', electronPath);
console.log('Project root:', projectRoot);

const proc = spawn(electronPath, [projectRoot], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
});

proc.on('close', (code) => process.exit(code));
