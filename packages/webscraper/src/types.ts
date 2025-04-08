import type { AppLogger } from '@repo/logger';
import type { AxiosRequestConfig } from 'axios';

export interface ScraperOptions {
  proxy?: AxiosRequestConfig['proxy'];
  headers?: Record<string, string>;
  timeout?: number;
  logger?: AppLogger; // Add optional logger instance
} 