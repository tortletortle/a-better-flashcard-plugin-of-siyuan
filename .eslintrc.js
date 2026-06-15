module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    // 错误预防
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-undef": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],

    // 代码风格
    "semi": ["warn", "always"],
    "quotes": ["warn", "double", { avoidEscape: true }],
    "no-trailing-spaces": "warn",
    "comma-dangle": ["warn", "always-multiline"],

    // 最佳实践
    "eqeqeq": ["warn", "always"],
    "curly": ["warn", "all"],
    "no-eval": "error",
  },
};
