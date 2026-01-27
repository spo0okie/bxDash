const { override, addDecoratorsLegacy, addBabelPlugins } = require('customize-cra');

//module.exports = override(addDecoratorsLegacy());
module.exports = {
  webpack: override(
    ...addBabelPlugins(
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-proposal-class-properties', { loose: true }],
      ['@babel/plugin-proposal-private-methods', { loose: true }],
      ['@babel/plugin-proposal-private-property-in-object', { loose: true }]
    )
  ),
};