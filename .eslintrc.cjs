module.exports = {
  root: true,
  extends: ['@nuxtjs/eslint-config-typescript', 'eslint-config-prettier'],
  rules: {
    'vue/multi-word-component-names': 'off',
  },
  overrides: [
    {
      files: ['*.vue'],
      rules: {
        'vue/multi-word-component-names': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
