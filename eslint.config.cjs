const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const js = require("@eslint/js");

const {
  FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

module.exports = defineConfig([globalIgnores(["**/dist/", "**/node_modules/"]), {
  extends: compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"),

  plugins: {
    "@typescript-eslint": typescriptEslint,
  },

  languageOptions: {
    globals: {
      ...globals.node,
    },

    parser: tsParser,
    ecmaVersion: 5,
    sourceType: "module",
  },

  rules: {
    "no-console": 0,
    indent: ["error", 2],
    quotes: ["error", "single"],
    semi: ["error", "always"],
    "max-len": ["warn", 120],
    "comma-dangle": ["error", {
      arrays: "only-multiline",
      objects: "only-multiline",
      imports: "only-multiline",
      exports: "only-multiline",
      functions: "only-multiline",
    }],

    "@typescript-eslint/no-unused-vars": ["error", {
      argsIgnorePattern: "^_",
    }],
  },
}]);