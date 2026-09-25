import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ENYX-Smart Hub API',
      version: '1.0.0',
      description: 'API documentation for ENYX-Smart Hub - IoT-based potato packaging and warehouse management system',
      contact: {
        name: 'ENYX-Smart Hub Team',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'NOT_FOUND',
                },
                message: {
                  type: 'string',
                  example: 'Resource not found',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.controller.ts'],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: any) => {
  app.use('/rapidoc', express.static(path.join(__dirname, '../../public/rapidoc')));
  
  app.get('/api/docs', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });
  
  app.get('/api/docs.json', (req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export default specs;
