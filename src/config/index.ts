import 'dotenv/config';
import type { AppConfig } from '../types/index.js';

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

export const config: AppConfig = {
  port: parseInt(getEnvVar('PORT', false) || '3003', 10),
  apiKey: getEnvVar('API_KEY'),
  adminApi: {
    apiKey: getEnvVar('ADMIN_API_KEY'),
    baseUrl: getEnvVar('ADMIN_API_BASE_URL'),
  },
  browserbase: {
    apiKey: getEnvVar('BROWSERBASE_API_KEY'),
    projectId: getEnvVar('BROWSERBASE_PROJECT_ID'),
  },
  gemini: {
    apiKey: getEnvVar('GEMINI_API_KEY'),
  },
  cloudinary: {
    cloudName: getEnvVar('CLOUDINARY_CLOUD_NAME'),
    apiKey: getEnvVar('CLOUDINARY_API_KEY'),
    apiSecret: getEnvVar('CLOUDINARY_API_SECRET'),
  },
};
