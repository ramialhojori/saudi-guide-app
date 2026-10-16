/** ودجت الشاشة الرئيسية وشاشة القفل (iOS 17+): «اليوم في مدينتك»، «فعالياتي»، «عرض اليوم» */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'widget',
  name: 'SaudiGuideWidget',
  displayName: 'دليل السعودية',
  bundleIdentifier: '.widget',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#604C87',
    $widgetBackground: '#604C87',
    sgPurple: '#604C87',
    sgOrange: '#F89743',
    sgPink: '#EB839B',
    sgInk: '#2B2745',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.saudiguide'],
  },
});
