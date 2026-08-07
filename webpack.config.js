const path = require('path');
const nodeExternals = require('webpack-node-externals');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
    target: 'node',
    mode: isProd ? 'production' : 'development',

    entry: {
        main: path.resolve(__dirname, 'src/main.ts'),
    },

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
    },

    externals: [nodeExternals()],

    resolve: {
        extensions: ['.ts', '.js'],
    },

    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: 'ts-loader',
                options: {
                    transpileOnly: true,
                    configFile: path.resolve(__dirname, 'tsconfig.json'),
                },
            },
        ],
    },

    cache: {
        type: 'filesystem',
    },
};
