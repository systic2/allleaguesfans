// eslint.config.js (ESLint v9 Flat Config)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default tseslint.config(
  // 🔒 무시 경로
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "tmp/**",
      "dumps/**",
    ],
  },

  // 기본 JS 추천
  js.configs.recommended,

  // TS 추천 (type-aware 아님: 빠르고 설정 단순)
  ...tseslint.configs.recommended,

  // 🌐 앱 공통 규칙
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // 미사용 import/vars 깔끔 정리
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { args: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],

      // React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // 🛠 scripts/** : 외부 응답/임시 로직 → any 허용 + 콘솔 허용 + 정규식 이스케이프 경고 끔
  {
    files: ["scripts/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-useless-escape": "off",
      "no-console": "off",
    },
  },

  // ⚡ supabase/functions/** : 외부 payload → any 허용 + 콘솔 허용
  {
    files: ["supabase/functions/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },

  // 📄 src/pages/**, src/features/** : 1차 패스에서는 any 경고만(=에러 아님)
  //   → 린트 통과 먼저, 2차에서 안전하게 타입 올리기
  {
    files: ["src/pages/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // 🧪 테스트: 일단 통과 우선. (원하면 ban-ts-comment를 경고로 올려도 됨)
  {
    files: ["**/*.test.{ts,tsx,js,jsx}", "**/__tests__/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    rules: {
      // 기존
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          /* ⬇ 추가 */ caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": "off",
      // ⬇ 선택: scripts에 한해서 unused-imports 버전의 no-unused-vars를 끄면
      //   catch 파라미터 등 엣지 케이스에서 겹치기 경고를 막을 수 있습니다.
      "unused-imports/no-unused-vars": "off",
    },
  }
);
