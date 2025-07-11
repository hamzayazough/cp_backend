import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './modules/user.module';
import { PromoterModule } from './modules/promoter.module';
import { AdvertiserModule } from './modules/advertiser.module';
import { ProtectedController } from './controllers/protected.controller';
import { FirebaseAuthMiddleware } from './auth/firebase-auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    UserModule,
    PromoterModule,
    AdvertiserModule,
  ],
  controllers: [AppController, ProtectedController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(FirebaseAuthMiddleware)
      .forRoutes('protected', 'auth/*', 'promoter/*', 'advertiser/*');
  }
}
