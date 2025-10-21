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
  port: parseInt(getEnvVar('PORT', false) || '3000', 10),
  apiKey: getEnvVar('API_KEY'),
  adminApiUrl: getEnvVar('ADMIN_API_URL'),
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

// Validate config on load
export function validateConfig(): void {
  const requiredFields = [
    'apiKey',
    'adminApiUrl',
    'browserbase.apiKey',
    'browserbase.projectId',
    'gemini.apiKey',
    'cloudinary.cloudName',
    'cloudinary.apiKey',
    'cloudinary.apiSecret',
  ];

  for (const field of requiredFields) {
    const parts = field.split('.');
    let value: any = config;
    for (const part of parts) {
      value = value[part];
    }
    if (!value) {
      throw new Error(`Invalid configuration: ${field} is missing or empty`);
    }
  }
}
