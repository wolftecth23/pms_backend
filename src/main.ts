import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Enable Gzip and Deflate response compression
  await app.register(compress, { encodings: ['gzip', 'deflate'] });

  // Set global prefix for all API endpoints
  app.setGlobalPrefix('api');

  // Register @fastify/multipart for handling file uploads
  // attachFieldsToBody: false means we process parts manually via req.parts()
  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25 MB
      files: 10, // Max 10 files per request
    },
  });

  // Serve uploaded files statically at both /uploads/* and /api/uploads/*
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  await app.register(staticFiles, {
    root: uploadsDir,
    prefix: '/uploads/',
  });

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT) || 5000;

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  }); // Enable CORS for external IP requests

  await app.listen(port);

  console.log(`🚀 Server running at http://localhost:${port}/api`);
  console.log(`📁 Uploads served at http://localhost:${port}/uploads/`);
}

bootstrap()
  .then(() => {
    console.log(`Server running successfully`);
  })
  .catch((err) => {
    console.error('Failed to start application', err);
    process.exit(1);
  });

// bootstrap();

// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 5000);
// }
// bootstrap();
