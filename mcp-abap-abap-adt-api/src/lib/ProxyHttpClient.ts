import http from 'node:http';
import { URL } from 'node:url';
import type { HttpClient } from 'abap-adt-api';
import type { HttpClientOptions, HttpClientResponse } from 'abap-adt-api/build/AdtHTTP.js';

/**
 * Lightweight HTTP client that bypasses axios, CSRF, cookies, and Basic Auth.
 * Sends raw HTTP requests directly to the local RFC proxy (e.g. localhost:9876).
 */
export class ProxyHttpClient implements HttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request(options: HttpClientOptions): Promise<HttpClientResponse> {
    const fullUrl = new URL(options.url, this.baseUrl + '/');

    if (options.qs) {
      for (const [k, v] of Object.entries(options.qs)) {
        if (v !== undefined && v !== null) {
          fullUrl.searchParams.set(k, String(v));
        }
      }
    }

    const method = options.method || 'GET';
    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };

    delete headers['authorization'];
    delete headers['Authorization'];

    return new Promise((resolve, reject) => {
      const req = http.request(
        fullUrl,
        {
          method,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            resolve({
              body,
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              headers: res.headers as any,
            });
          });
        }
      );

      req.on('error', reject);

      if (options.body) {
        req.write(options.body, 'utf-8');
      }
      req.end();
    });
  }
}
