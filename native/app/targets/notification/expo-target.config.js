/** إضافة الإشعارات (iOS): تنزّل صورة الإشعار (لو فيه) وتعرضها داخل الإشعار نفسه */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'notification-service',
  name: 'SaudiGuideNotification',
  displayName: 'دليل السعودية',
  bundleIdentifier: '.notification',
  deploymentTarget: '15.1',
  frameworks: ['UserNotifications'],
});
