/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Only match files inside __tests__ directories or *.test.ts files
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  // Exclude Next.js build output and node_modules from test scanning
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  moduleNameMapper: {
    // Map the @ alias to the src directory (matches tsconfig.json paths)
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          jsx: "react-jsx",
        },
      },
    ],
  },
};

module.exports = config;
