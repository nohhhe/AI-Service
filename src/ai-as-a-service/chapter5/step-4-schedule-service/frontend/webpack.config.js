const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const path = require('path');

module.exports = {
  entry: {
    main: './src/index.js'
  },
  devtool: 'eval-source-map',
  devServer: {
    static: './dist', // 최신 Webpack 5에서는 `contentBase` 대신 `static`
    port: 9080
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'dist/'
  },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(jpe?g|png|gif)$/i,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          outputPath: 'assets/images/'
        }
      }
    ]
  },
  plugins: [
    new Dotenv({
      path: path.resolve(__dirname, '..', '.env'),
      systemvars: true,  // 시스템 환경 변수도 허용
      silent: false
    }),
    new webpack.DefinePlugin({
      'process.env.CHAPTER4_COGNITO_DOMAIN': JSON.stringify(process.env.CHAPTER4_COGNITO_DOMAIN),
      'process.env.TARGET_REGION': JSON.stringify(process.env.TARGET_REGION),
      'process.env.CHAPTER4_BUCKET': JSON.stringify(process.env.CHAPTER4_BUCKET),
      'process.env.CHAPTER4_POOL_ID': JSON.stringify(process.env.CHAPTER4_POOL_ID),
      'process.env.CHAPTER4_POOL_CLIENT_ID': JSON.stringify(process.env.CHAPTER4_POOL_CLIENT_ID),
      'process.env.CHAPTER4_IDPOOL': JSON.stringify(process.env.CHAPTER4_IDPOOL),
      'process.env.CHAPTER4_DATA_BUCKET': JSON.stringify(process.env.CHAPTER4_DATA_BUCKET),
      'process.env.CHAPTER4_DOMAIN': JSON.stringify(process.env.CHAPTER4_DOMAIN),
      'process.env.CHAPTER4_DOMAIN_ARN': JSON.stringify(process.env.CHAPTER4_DOMAIN_ARN),
      'process.env.CHAPTER4_COGNITO_BASE_DOMAIN': JSON.stringify(process.env.CHAPTER4_COGNITO_BASE_DOMAIN),
      'process.env.CHAPTER4_POOL_ARN': JSON.stringify(process.env.CHAPTER4_POOL_ARN)
    })
  ]
};
