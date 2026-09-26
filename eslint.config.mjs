import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 dogrudan "flat config" olarak gelir (eskiden FlatCompat
// ile `next/core-web-vitals` genisletiliyordu; bu, ESLint 9 + config-next 16
// ile "Converting circular structure to JSON" hatasiyla coker ve `npm run lint`
// hic calismazdi).
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
  {
    rules: {
      // Formlar "kaydedildi" geri bildirimini effect icinde state ile gosteriyor
      // (bkz. lib/hooks/use-save-feedback.ts) - bilincli, guvenli bir desen; React
      // Compiler'in yeni katı kuralı bunu hata sayiyordu. Uyari olarak kalsin.
      "react-hooks/set-state-in-effect": "warn",
      // useActionState imzasi geregi ilk parametre (prevState) kullanilmasa da zorunlu.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^(_|prevState)", varsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
