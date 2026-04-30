// Learn more: https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Restrict Metro's file watcher to the project directory only.
// Without this, Metro can watch volatile system folders (e.g. Chrome's AppData cache)
// and crash with ENOENT when those folders are modified or deleted by other processes.
config.watchFolders = [path.resolve(__dirname)];

module.exports = config;
