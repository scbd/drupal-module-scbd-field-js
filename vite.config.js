import { defineConfig        } from 'vite'
import   vue                   from '@vitejs/plugin-vue'
import postCssPurge from '@fullhuman/postcss-purgecss';


const alias = [ { find: '@', replacement:'/src' } ]

const safelist = [
  /multiselect/,
  'chm-multiselect',
  'has-grouped-options'
];

const config = {
  plugins  : [ vue() ],
  css      : { postcss: { plugins: [ postCssPurge({ contentFunction, defaultExtractor, safelist }) ] } },
    resolve: {
      alias,
      dedupe: [ 'vue' ],
      preserveSymlinks: false
    },
    build    : {
        outDir:'dist', emptyOutDir:true,  sourcemap:'hidden', copyPublicDir : false,
        minify: 'esbuild', // Vite's built-in minifier strips comments; drops the deprecated, redundant rollup-plugin-terser (B3)
        lib      : { formats:['iife'], entry:'src/index.js', name:'ScbdDrupalScbdFieldJs', fileName:() => 'index.min.js', cssFileName:'style' }, // lib build as opposed to app build
        rollupOptions: {
            external: ['vue'],
          output: {
            exports: 'named',
            globals: { vue: 'Vue' }
          },
        },
      }
}
export default defineConfig(config)


const vuePath = /\.vue(\?.+)?$/;

function contentFunction (sourceInputFile) {
    if (vuePath.test(sourceInputFile))
      return [sourceInputFile.replace(vuePath, '.vue')];
  
    return ['src/**/*.vue', 'index.html'];
  }
  
  function defaultExtractor(content) {
    if (content.startsWith('<template'))
      content = content.split('</template')[0] + '</template>';
  
    return content.match(/[\w-/:]+(?<!:)/g) || [];
  }
