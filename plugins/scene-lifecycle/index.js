const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

// iOS 27 asserts at launch (EXC_BREAKPOINT in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) for apps built
// with the iOS 27 SDK that haven't adopted the UIScene life cycle. Expo 57
// ships `ExpoAppSceneDelegate` for this, but its prebuild template still
// generates the old app-delegate-owns-the-window setup, so this plugin wires
// the scene delegate in until the template catches up.

// `@objc` name of Expo's `ExpoAppSceneDelegate`, so UIKit can find it without
// a module prefix.
const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return config;
  });
}

// The scene delegate creates the window and starts React Native into it,
// pulling the factory from the app delegate via ExpoReactNativeFactoryProvider.
// So the app delegate must conform to that protocol and must not create a
// window or start React Native itself.
function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('scene-lifecycle plugin expects a Swift AppDelegate');
    }
    let contents = config.modResults.contents;

    // Prebuild without --clean re-runs this against an already-patched file.
    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      const declaration = 'class AppDelegate: ExpoAppDelegate {';
      if (!contents.includes(declaration)) {
        throw new Error('scene-lifecycle plugin could not find the AppDelegate declaration');
      }
      contents = contents.replace(
        declaration,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
      );
    }

    contents = contents.replace(
      /\n\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
      '\n'
    );
    if (contents.includes('factory.startReactNative(')) {
      throw new Error('scene-lifecycle plugin could not remove the AppDelegate window setup');
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withSceneLifecycle(config) {
  config = withSceneManifest(config);
  config = withSceneAppDelegate(config);
  return config;
};
