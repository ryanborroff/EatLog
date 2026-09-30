const { withEntitlementsPlist } = require('@expo/config-plugins');

// expo-notifications always adds the `aps-environment` (Push Notifications)
// entitlement, which would require enabling Push on the App ID and
// regenerating provisioning profiles. EatLog only schedules local reminders,
// which don't need it, so this strips it back out.
//
// Must be listed BEFORE "expo-notifications" in app.json: mods run in reverse
// plugin order, so this one sees the entitlements after that plugin has set them.
function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
}

module.exports = withLocalNotificationsOnly;
