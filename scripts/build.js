const {rollup, generate} = require('rollup');
const {join, resolve} = require('path');
const typescript = require('rollup-plugin-typescript2');
const replace = require('@rollup/plugin-replace');
const {terser} = require('rollup-plugin-terser');
const fs = require('fs');

const cwd = process.cwd();
const pkgJson = require(join(cwd, 'package.json'));
const options = require('minimist')(process.argv.slice(2), {
    boolean: ['minify', 'replace'],
    default: {
        env: 'development',
        ext: 'js',
        format: 'umd',
        name: pkgJson.name,
        minify: true,
        replace: true,
        version: pkgJson.version,
        entry: 'src/index.ts',
    }
});
const resolveRoot = path => resolve(__dirname, '../',  path);
const plugins = [
    typescript({
        tsconfig: resolve(__dirname, '../tsconfig.json'),
        exclude: ['**/__tests__'],
        cacheRoot: resolveRoot(`node_modules/.rpt2_cache/${pkgJson.name}_${options.env}_${options.format}`),
        tsconfigOverride: {
            declaration: true,
            sourceMap: false,
        }
    }),
];

if (options.replace) {
    plugins.push(replace({
        values: {
            'process.env.NODE_ENV': JSON.stringify(options.env),
        },
        preventAssignment: true,
    }));
}

if (options.minify) {
    plugins.push(terser({
        compress: {
            passes: 5,
        },
        mangle: {
            toplevel: true,
        },
        parse: {
            html5_comments: false,
            shebang: false,
        },
        format: {
            comments: false,
        }
    }));
}

const format = options.format;
const external = format === 'umd' || format === 'iife' || format === 'es' && options.env !== 'unknown' ? [] : Object.keys(pkgJson.dependencies || {});

const name = pkgJson.name.replace(/(^\w)|(-\w)/g, v => v.charAt(v.length - 1).toUpperCase());
const input = join(cwd, options.entry);

async function build() {
    if (!fs.existsSync(input)) return;

    const buddle = await rollup({input, external, plugins});

    await buddle.write({
        file: `dist/${options.name}.${options.ext}`,
        format,
        name,
    });
}

build();
