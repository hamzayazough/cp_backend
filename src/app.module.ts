import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './modules/user.module';
import { PromoterModule } from './modules/promoter.module';
import { AdvertiserModule } from './modules/advertiser.module';
import { ViewsModule } from './modules/views.module';
import { StripeModule } from './stripe/stripe.module';
import { FirebaseAuthMiddleware } from './auth/firebase-auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute per IP (global default)
      },
    ]),
    DatabaseModule,
    AuthModule,
    StripeModule,
    UserModule,
    PromoterModule,
    AdvertiserModule,
    ViewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(FirebaseAuthMiddleware)
      .forRoutes('auth/*', 'promoter/*', 'advertiser/*');
  }
}
