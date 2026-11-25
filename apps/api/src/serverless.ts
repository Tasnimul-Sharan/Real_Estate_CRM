import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

let cachedHandler: ((req: any, res: any) => any) | null = null;

async function bootstrapHandler(): Promise<(req: any, res: any) => any> {
  if (cachedHandler) return cachedHandler;

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? ["http://localhost:3000"],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  if (process.env.ENABLE_API_DOCS === "true") {
    const config = new DocumentBuilder()
      .setTitle("Real Estate CRM API")
      .setDescription("CRM REST API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  }
  await app.init();
  cachedHandler = app.getHttpAdapter().getInstance();
  return cachedHandler!;
}

export default async function handler(req: any, res: any) {
  const fn = await bootstrapHandler();
  return fn(req, res);
}
