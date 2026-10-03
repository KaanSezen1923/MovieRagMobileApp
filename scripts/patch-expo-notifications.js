const fs = require('fs');
const path = require('path');

// 1. Patch expo-notifications
const notificationsBaseDir = path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build');

const warnFile = path.join(notificationsBaseDir, 'warnOfExpoGoPushUsage.js');
if (fs.existsSync(warnFile)) {
  let content = fs.readFileSync(warnFile, 'utf8');
  if (content.includes('throw new Error(message);')) {
    content = content.replace('throw new Error(message);', 'didWarn = true;\n            console.warn(message);');
    fs.writeFileSync(warnFile, content, 'utf8');
    console.log('Patched warnOfExpoGoPushUsage.js');
  }
}

const notifModulesToPatch = [
  'TopicSubscriptionModule.android.js',
  'TopicSubscriptionModule.js',
  'PushTokenManager.native.js',
  'ServerRegistrationModule.native.js',
  'BackgroundNotificationTasksModule.native.js',
];

notifModulesToPatch.forEach(fileName => {
  const filePath = path.join(notificationsBaseDir, fileName);
  patchFileWithOptionalModule(filePath);
});

// 2. Patch expo-av (ExponentAV and ExpoVideoView removed from Expo Go in SDK 55+)
const avBaseDir = path.join(__dirname, '..', 'node_modules', 'expo-av', 'build');
const avModulesToPatch = [
  'ExponentAV.js',
  'ExpoVideoManager.js',
];

avModulesToPatch.forEach(fileName => {
  const filePath = path.join(avBaseDir, fileName);
  patchFileWithOptionalModule(filePath);
});

function patchFileWithOptionalModule(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  if (content.includes("import { requireNativeModule } from 'expo-modules-core';")) {
    content = content.replace(
      "import { requireNativeModule } from 'expo-modules-core';",
      "import { requireOptionalNativeModule } from 'expo-modules-core';"
    );
    modified = true;
  }

  if (content.includes("export default requireNativeModule(")) {
    content = content.replace(
      /export default requireNativeModule\(([^)]+)\);/,
      'export default (requireOptionalNativeModule($1) || {});'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${path.basename(filePath)} to use requireOptionalNativeModule`);
  }
}
