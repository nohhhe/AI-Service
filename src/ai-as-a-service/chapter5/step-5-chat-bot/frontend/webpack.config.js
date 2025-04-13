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
      test: /\.m?js$/, // .js 또는 .mjs 확장자를 가진 파일에 대해
      exclude: /node_modules/, // node_modules 폴더는 일반적으로 변환 대상에서 제외
      use: {
        loader: 'babel-loader', // babel-loader 사용
        options: {
          // Babel 설정을 여기서 직접 지정 (별도 .babelrc 파일이 없으므로)
          presets: [
            ['@babel/preset-env', {
              // targets: "> 0.25%, not dead" // 필요한 경우 지원 브라우저/환경 지정 가능
              // 기본 설정을 사용해도 대부분의 최신 문법을 처리함
            }]
          ]
          // 필요한 경우 플러그인 추가:
          // plugins: ['@babel/plugin-proposal-optional-chaining', ...]
        }
      }
    }
    ]
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

