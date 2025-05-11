const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const path = require('path');

module.exports = {
  entry: {
    main: './src/index.js',
    worker: './src/audio/worker.js'
  },
  devtool: 'eval-source-map',
  devServer: {
    contentBase: './dist',
    port: 9080
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'dist/'
  },
  mode: 'development',
  module: {
    rules: [{
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
    },
    {
      test: /\.m?js$/,
      // node_modules 디렉토리를 제외하지만, @aws-sdk 와 @smithy 로 시작하는 경로는 제외하지 않음
      exclude: /node_modules(?![\\/]@aws-sdk|![\\/]@smithy)/, // <--- 이렇게 수정!
      use: {
        loader: 'babel-loader',
        options: {œ
          presets: [
            ['@babel/preset-env', {}]
          ]
        }
      }
    }]
  },
  plugins: [
    new Dotenv({
      path: path.resolve(__dirname, '..', '.env'),
      systemvars: false,
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
      'process.env.CHAPTER4_POOL_ARN': JSON.stringify(process.env.CHAPTER4_POOL_ARN),
      'process.env.BOT_ID': JSON.stringify(process.env.BOT_ID),
      'process.env.BOT_ALIAS_ID': JSON.stringify(process.env.BOT_ALIAS_ID),
      'process.env.LOCALE_ID': JSON.stringify(process.env.LOCALE_ID),
    })
  ]
}

