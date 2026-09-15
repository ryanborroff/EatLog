const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// A stray package.json/node_modules/pnpm-lock.yaml in the home directory
// makes Metro's monorepo-root detection misidentify $HOME as a pnpm
// workspace root, which breaks module resolution for this (non-monorepo)
// project. Pin the project root explicitly to stop the upward search.
config.watchFolders = [__dirname];
config.resolver.nodeModulesPaths = [require('path').resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
